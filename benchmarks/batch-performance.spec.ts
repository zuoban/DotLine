import { expect, test, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance as nodePerformance } from 'node:perf_hooks';

const ROW_COUNTS = [100, 500, 1000, 2000] as const;
const REPORT_DIRECTORY = path.resolve('performance-results');
const REPORT_PATH = path.join(REPORT_DIRECTORY, 'batch-performance.json');
const PROBE_INTERVAL_MS = 20;

interface ProbeResult {
  maxMainThreadGapMs: number;
  peakMainThreadHeapMb: number | null;
  samples: number;
}

interface BenchmarkCase {
  rows: number;
  sourceBytes: number;
  outputBytes: number;
  parseMs: number;
  exportMs: number;
  parseMaxMainThreadGapMs: number;
  exportMaxMainThreadGapMs: number;
  parsePeakMainThreadHeapMb: number | null;
  exportPeakMainThreadHeapMb: number | null;
}

interface BenchmarkReport {
  schemaVersion: 1;
  generatedAt: string;
  environment: {
    ci: boolean;
    node: string;
    browser: string;
    platform: string;
    cpu: string;
  };
  cases: BenchmarkCase[];
  cancellation?: {
    rows: number;
    responseMs: number;
    maxMainThreadGapMs: number;
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

async function createWorkbookBuffer(rowCount: number): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Performance');
  worksheet.columns = [{ header: '输入文本', key: 'inputText', width: 24 }];
  worksheet.getColumn('inputText').numFmt = '@';

  const rows = Array.from({ length: rowCount }, (_, index) => ({
    inputText: `PERF-${String(index + 1).padStart(5, '0')}`,
  }));
  worksheet.addRows(rows);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function startResponsivenessProbe(page: Page): Promise<void> {
  await page.evaluate(({ intervalMs }) => {
    type MemoryPerformance = Performance & {
      memory?: { usedJSHeapSize: number };
    };
    type ProbeWindow = Window & typeof globalThis & {
      __dotlinePerformanceProbe?: {
        timer: number;
        lastTick: number;
        maxGap: number;
        peakHeapBytes: number | null;
        samples: number;
      };
    };

    const probeWindow = window as ProbeWindow;
    const readHeap = () =>
      (globalThis.performance as unknown as MemoryPerformance).memory?.usedJSHeapSize ?? null;
    const state = {
      timer: 0,
      lastTick: globalThis.performance.now(),
      maxGap: 0,
      peakHeapBytes: readHeap(),
      samples: 0,
    };
    state.timer = window.setInterval(() => {
      const now = globalThis.performance.now();
      state.maxGap = Math.max(state.maxGap, now - state.lastTick);
      state.lastTick = now;
      const heapBytes = readHeap();
      if (heapBytes !== null) {
        state.peakHeapBytes = Math.max(state.peakHeapBytes ?? 0, heapBytes);
      }
      state.samples += 1;
    }, intervalMs);
    probeWindow.__dotlinePerformanceProbe = state;
  }, { intervalMs: PROBE_INTERVAL_MS });
}

async function stopResponsivenessProbe(page: Page): Promise<ProbeResult> {
  return page.evaluate(() => {
    type ProbeWindow = Window & typeof globalThis & {
      __dotlinePerformanceProbe?: {
        timer: number;
        lastTick: number;
        maxGap: number;
        peakHeapBytes: number | null;
        samples: number;
      };
    };
    const probeWindow = window as ProbeWindow;
    const state = probeWindow.__dotlinePerformanceProbe;
    if (!state) throw new Error('性能探针尚未启动');
    window.clearInterval(state.timer);
    delete probeWindow.__dotlinePerformanceProbe;
    return {
      maxMainThreadGapMs: Math.round(state.maxGap * 10) / 10,
      peakMainThreadHeapMb:
        state.peakHeapBytes === null
          ? null
          : Math.round((state.peakHeapBytes / 1024 / 1024) * 10) / 10,
      samples: state.samples,
    };
  });
}

async function openBatchTool(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /1x 标准/ }).click();
  await page.locator('#config-qr-size').fill('120');
  await page.getByRole('switch', { name: /显示输入文本/ }).setChecked(false);
  await page.getByRole('tab', { name: /Excel 批量/ }).click();
  await expect(page.locator('#excel-file-upload')).toBeAttached();
}

async function saveReport(report: BenchmarkReport): Promise<void> {
  await mkdir(REPORT_DIRECTORY, { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

test('100/500/1000/2000 行批量性能基准', async ({ page, browserName }, testInfo) => {
  test.setTimeout(15 * 60_000);
  const report: BenchmarkReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    environment: {
      ci: Boolean(process.env.CI),
      node: process.version,
      browser: `${browserName} ${page.context().browser()?.version() ?? 'unknown'}`,
      platform: `${os.platform()} ${os.release()} ${os.arch()}`,
      cpu: os.cpus()[0]?.model ?? 'unknown',
    },
    cases: [],
  };
  await saveReport(report);

  for (const rowCount of ROW_COUNTS) {
    await test.step(`${rowCount} 行解析与导出`, async () => {
      await openBatchTool(page);
      const sourceBuffer = await createWorkbookBuffer(rowCount);

      await startResponsivenessProbe(page);
      const parseStartedAt = nodePerformance.now();
      await page.locator('#excel-file-upload').setInputFiles({
        name: `performance-${rowCount}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: sourceBuffer,
      });
      await expect(page.getByText(`成功读取 ${rowCount} 条数据记录`, { exact: true })).toBeVisible();
      const parseMs = nodePerformance.now() - parseStartedAt;
      const parseProbe = await stopResponsivenessProbe(page);

      await expect(page.getByText('预览生成完成，共 48 条。', { exact: true })).toBeVisible({
        timeout: 60_000,
      });

      await startResponsivenessProbe(page);
      const downloadPromise = page.waitForEvent('download');
      const exportStartedAt = nodePerformance.now();
      await page.getByRole('button', { name: '导出包含二维码的 Excel', exact: true }).click();
      const download = await downloadPromise;
      expect(await download.failure()).toBeNull();
      const downloadPath = await download.path();
      const outputBytes = downloadPath ? (await stat(downloadPath)).size : 0;
      const exportMs = nodePerformance.now() - exportStartedAt;
      const exportProbe = await stopResponsivenessProbe(page);

      report.cases.push({
        rows: rowCount,
        sourceBytes: sourceBuffer.byteLength,
        outputBytes,
        parseMs: round(parseMs),
        exportMs: round(exportMs),
        parseMaxMainThreadGapMs: parseProbe.maxMainThreadGapMs,
        exportMaxMainThreadGapMs: exportProbe.maxMainThreadGapMs,
        parsePeakMainThreadHeapMb: parseProbe.peakMainThreadHeapMb,
        exportPeakMainThreadHeapMb: exportProbe.peakMainThreadHeapMb,
      });
      await saveReport(report);

      expect(parseProbe.maxMainThreadGapMs).toBeLessThan(1000);
      expect(exportProbe.maxMainThreadGapMs).toBeLessThan(1000);
    });
  }

  await test.step('2000 行任务取消响应', async () => {
    const exportWorkerPromise = page.waitForEvent('worker', {
      predicate: (worker) => worker.url().includes('excelProcessor.worker'),
    });
    await startResponsivenessProbe(page);
    await page.getByRole('button', { name: '导出包含二维码的 Excel', exact: true }).click();
    await exportWorkerPromise;
    const cancelButton = page.getByRole('button', { name: '取消任务', exact: true });
    await expect(cancelButton).toBeVisible();

    const cancelStartedAt = nodePerformance.now();
    await cancelButton.click();
    await expect(page.getByText('已取消 Excel 导出，未下载不完整文件。', { exact: true })).toBeVisible();
    const responseMs = nodePerformance.now() - cancelStartedAt;
    const cancelProbe = await stopResponsivenessProbe(page);
    report.cancellation = {
      rows: 2000,
      responseMs: round(responseMs),
      maxMainThreadGapMs: cancelProbe.maxMainThreadGapMs,
    };
    await saveReport(report);

    expect(responseMs).toBeLessThan(1500);
    expect(cancelProbe.maxMainThreadGapMs).toBeLessThan(1000);
  });

  await testInfo.attach('batch-performance-report', {
    path: REPORT_PATH,
    contentType: 'application/json',
  });
});
