import { expect, test, type Download, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';

async function createWorkbook(rowCount = 1): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('CrossBrowser');
  worksheet.addRow(['输入文本']);
  for (let index = 0; index < rowCount; index += 1) {
    worksheet.addRow([`CROSS-${String(index + 1).padStart(4, '0')}`]);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function readDownload(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function openApp(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('tab', { name: '单张生成', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
}

test('键盘可切换工作区并下载二维码', { tag: '@cross-browser' }, async ({ page }) => {
  await openApp(page);
  const singleTab = page.getByRole('tab', { name: '单张生成', exact: true });
  await singleTab.focus();
  await page.keyboard.press('End');
  const batchTab = page.getByRole('tab', { name: /Excel 批量/ });
  await expect(batchTab).toBeFocused();
  await expect(batchTab).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('Home');
  await expect(singleTab).toBeFocused();
  const input = page.getByLabel(/输入生成内容 \/ 序列号 \/ 网址/);
  await input.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('https://example.com/cross-browser');
  await expect(page.getByRole('img', { name: '二维码预览：https://example.com/cross-browser' })).toBeVisible();

  const downloadButton = page.getByRole('button', { name: '下载图片', exact: true });
  await downloadButton.focus();
  const downloadPromise = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^qrcode_\d+\.png$/);
  expect(await download.failure()).toBeNull();
});

test('缺少 OffscreenCanvas 时仍可解析并导出 Excel', { tag: '@cross-browser' }, async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'OffscreenCanvas', {
      configurable: true,
      value: undefined,
    });
  });
  await openApp(page);
  const batchTab = page.getByRole('tab', { name: /Excel 批量/ });
  await batchTab.focus();
  await page.keyboard.press('Enter');

  const fileInput = page.locator('#excel-file-upload');
  await fileInput.focus();
  await expect(fileInput).toBeFocused();
  await fileInput.setInputFiles({
    name: 'fallback.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await createWorkbook(),
  });
  await expect(page.getByText('成功读取 1 条数据记录', { exact: true })).toBeVisible();

  const exportButton = page.getByRole('button', {
    name: '导出包含二维码的 Excel',
    exact: true,
  });
  await exportButton.focus();
  const downloadPromise = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  const download = await downloadPromise;
  expect(await download.failure()).toBeNull();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(await readDownload(download)).buffer);
  expect(workbook.worksheets[0].getImages()).toHaveLength(1);
});

test('键盘可以取消 2000 行 Excel 导出', { tag: '@cross-browser' }, async ({ page }) => {
  test.setTimeout(90_000);
  await openApp(page);
  await page.getByRole('tab', { name: /Excel 批量/ }).click();
  const fileInput = page.locator('#excel-file-upload');
  await fileInput.focus();
  await fileInput.setInputFiles({
    name: 'cancel.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await createWorkbook(2000),
  });
  await expect(page.getByText('成功读取 2000 条数据记录', { exact: true })).toBeVisible({
    timeout: 30_000,
  });

  const exportButton = page.getByRole('button', {
    name: '导出包含二维码的 Excel',
    exact: true,
  });
  await exportButton.focus();
  await page.keyboard.press('Enter');
  const cancelButton = page.getByRole('button', { name: '取消任务', exact: true });
  await expect(cancelButton).toBeVisible();
  await cancelButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('已取消 Excel 导出，未下载不完整文件。', { exact: true })).toBeVisible();
});
