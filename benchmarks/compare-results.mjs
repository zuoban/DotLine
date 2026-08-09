import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const reportPath = process.env.PERFORMANCE_REPORT_PATH || 'performance-results/batch-performance.json';
const baselinePath = process.env.PERFORMANCE_BASELINE_PATH || '';
const budgetPath = process.env.PERFORMANCE_BUDGET_PATH || 'benchmarks/performance-budgets.json';
const comparisonPath = 'performance-results/comparison.json';

async function readJson(filePath, required = true) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (!required && error && error.code === 'ENOENT') return null;
    throw new Error(`无法读取性能文件 ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function regressionPercent(current, baseline) {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline <= 0) return null;
  return ((current - baseline) / baseline) * 100;
}

function formatMs(value) {
  return Number.isFinite(value) ? `${Math.round(value)} ms` : 'n/a';
}

function formatMb(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} MB` : 'n/a';
}

function escapeWorkflowMessage(message) {
  return message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

const current = await readJson(reportPath);
const budgets = await readJson(budgetPath);
const baseline = baselinePath ? await readJson(baselinePath, false) : null;
const warnings = [];

for (const currentCase of current.cases) {
  const caseBudget = budgets.cases[String(currentCase.rows)];
  if (!caseBudget) {
    warnings.push(`${currentCase.rows} 行缺少绝对性能预算。`);
    continue;
  }
  if (currentCase.parseMs > caseBudget.maxParseMs) {
    warnings.push(`${currentCase.rows} 行解析耗时 ${formatMs(currentCase.parseMs)}，超过预算 ${formatMs(caseBudget.maxParseMs)}。`);
  }
  if (currentCase.exportMs > caseBudget.maxExportMs) {
    warnings.push(`${currentCase.rows} 行导出耗时 ${formatMs(currentCase.exportMs)}，超过预算 ${formatMs(caseBudget.maxExportMs)}。`);
  }
  if (currentCase.parseMaxMainThreadGapMs > budgets.maxMainThreadGapMs) {
    warnings.push(`${currentCase.rows} 行解析的主线程最大间隔 ${formatMs(currentCase.parseMaxMainThreadGapMs)}，超过 ${formatMs(budgets.maxMainThreadGapMs)}。`);
  }
  if (currentCase.exportMaxMainThreadGapMs > budgets.maxMainThreadGapMs) {
    warnings.push(`${currentCase.rows} 行导出的主线程最大间隔 ${formatMs(currentCase.exportMaxMainThreadGapMs)}，超过 ${formatMs(budgets.maxMainThreadGapMs)}。`);
  }
  const peakHeapMb = Math.max(
    currentCase.parsePeakMainThreadHeapMb ?? 0,
    currentCase.exportPeakMainThreadHeapMb ?? 0,
  );
  if (peakHeapMb > budgets.maxMainThreadHeapMb) {
    warnings.push(`${currentCase.rows} 行主线程堆内存峰值 ${formatMb(peakHeapMb)}，超过 ${formatMb(budgets.maxMainThreadHeapMb)}。`);
  }

  const baselineCase = baseline?.cases?.find((item) => item.rows === currentCase.rows);
  if (baselineCase) {
    for (const [metric, label] of [['parseMs', '解析'], ['exportMs', '导出']]) {
      const regression = regressionPercent(currentCase[metric], baselineCase[metric]);
      if (regression !== null && regression > budgets.maxRegressionPercent) {
        warnings.push(
          `${currentCase.rows} 行${label}耗时较 main 基线退化 ${regression.toFixed(1)}%，超过 ${budgets.maxRegressionPercent}% 告警线。`,
        );
      }
    }
  }
}

if (current.cancellation?.responseMs > budgets.maxCancelResponseMs) {
  warnings.push(
    `取消响应 ${formatMs(current.cancellation.responseMs)}，超过 ${formatMs(budgets.maxCancelResponseMs)} 目标。`,
  );
}

const rows = current.cases.map((item) => {
  const peakHeapMb = Math.max(
    item.parsePeakMainThreadHeapMb ?? 0,
    item.exportPeakMainThreadHeapMb ?? 0,
  );
  return `| ${item.rows} | ${formatMs(item.parseMs)} | ${formatMs(item.exportMs)} | ${formatMs(Math.max(item.parseMaxMainThreadGapMs, item.exportMaxMainThreadGapMs))} | ${formatMb(peakHeapMb)} | ${(item.outputBytes / 1024 / 1024).toFixed(2)} MB |`;
});
const summary = [
  '## DotLine 批量性能报告',
  '',
  '| 行数 | 解析 | 导出 | 最大主线程间隔 | 主线程堆峰值 | 导出文件 |',
  '| ---: | ---: | ---: | ---: | ---: | ---: |',
  ...rows,
  '',
  `取消响应：${formatMs(current.cancellation?.responseMs)}`,
  '',
  baseline ? `已与最近一次 main 基线比较，退化告警线为 ${budgets.maxRegressionPercent}%。` : '未找到历史 main 基线，本次仅检查绝对预算。',
  '',
  warnings.length > 0
    ? `⚠️ ${warnings.length} 项性能告警：\n\n${warnings.map((warning) => `- ${warning}`).join('\n')}`
    : '✅ 未发现性能退化。',
  '',
].join('\n');

await mkdir(path.dirname(comparisonPath), { recursive: true });
await writeFile(comparisonPath, `${JSON.stringify({ warnings, baselineFound: Boolean(baseline) }, null, 2)}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
}
if (process.env.GITHUB_ACTIONS === 'true') {
  for (const warning of warnings) {
    process.stdout.write(`::warning title=Performance regression::${escapeWorkflowMessage(warning)}\n`);
  }
}
process.stdout.write(`${summary}\n`);
