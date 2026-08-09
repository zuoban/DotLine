import { expect, test, type Download, type Locator, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library';

async function openApp(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('tab', { name: '单张生成', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
}

async function createLegacyBlankRowWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('数据');

  sheet.getCell('A1').value = '输入文本';
  sheet.getCell('B1').value = '显示输入文本';
  sheet.getCell('C1').value = '附加内容';

  sheet.getCell('A2').value = 'ROW-2';
  sheet.getCell('B2').value = '是';

  // Excel 第 3 行有意留空，用于覆盖原始行号映射。
  sheet.getCell('A4').value = 'ROW-4';
  sheet.getCell('B4').value = '否';

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

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <= window.innerWidth &&
          document.body.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
}

async function decodeGeneratedImage(image: Locator, format: BarcodeFormat): Promise<string> {
  const pixels = await image.evaluate(async (element) => {
    const source = element as HTMLImageElement;
    await source.decode();
    const canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('测试环境无法创建 Canvas context');
    context.drawImage(source, 0, 0);
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const luminance = new Array<number>(canvas.width * canvas.height);
    for (let sourceIndex = 0, targetIndex = 0; sourceIndex < rgba.length; sourceIndex += 4) {
      luminance[targetIndex] = Math.round(
        (rgba[sourceIndex] + 2 * rgba[sourceIndex + 1] + rgba[sourceIndex + 2]) / 4,
      );
      targetIndex += 1;
    }
    return { width: canvas.width, height: canvas.height, luminance };
  });

  const source = new RGBLuminanceSource(
    Uint8ClampedArray.from(pixels.luminance),
    pixels.width,
    pixels.height,
  );
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [format]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new MultiFormatReader().decode(bitmap, hints).getText();
}

test('默认二维码使用黑色文本并可下载 PNG', async ({ page }) => {
  await openApp(page);

  await expect(page.getByLabel('文本字色', { exact: true })).toHaveValue('#000000');

  const input = page.getByLabel(/输入生成内容 \/ 序列号 \/ 网址/);
  await input.fill('https://example.com/e2e');

  await expect(page.getByRole('img', { name: '二维码预览：https://example.com/e2e' })).toBeVisible();
  const downloadButton = page.getByRole('button', { name: '下载图片', exact: true });
  await expect(downloadButton).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);

  const downloadPromise = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^qrcode_\d+\.png$/);
  expect(await download.failure()).toBeNull();
});

test('码图渲染运行在独立 Web Worker 中', async ({ page }) => {
  const workerPromise = page.waitForEvent('worker');
  await openApp(page);
  const worker = await workerPromise;

  expect(worker.url()).toContain('codeRenderer.worker');
  await expect(page.getByRole('img', { name: /^二维码预览：/ })).toBeVisible();
});

test('生成后的二维码可以反向解码为原始内容', async ({ page }) => {
  await openApp(page);
  const value = 'https://example.com/scan-verification';
  await page.getByLabel(/输入生成内容 \/ 序列号 \/ 网址/).fill(value);
  const image = page.getByRole('img', { name: `二维码预览：${value}`, exact: true });
  await expect(image).toBeVisible();

  expect(await decodeGeneratedImage(image, BarcodeFormat.QR_CODE)).toBe(value);
});

test('常用一维码生成后可以反向解码', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /一维条码/ }).click();
  const input = page.getByLabel(/输入生成内容 \/ 序列号 \/ 网址/);
  const cases = [
    { option: 'CODE128', value: 'SN987654321', format: BarcodeFormat.CODE_128 },
    { option: 'CODE39', value: 'DOTLINE-2026', format: BarcodeFormat.CODE_39 },
    { option: 'EAN13', value: '6901234567892', format: BarcodeFormat.EAN_13 },
    { option: 'EAN8', value: '12345670', format: BarcodeFormat.EAN_8 },
    { option: 'UPC', value: '123456789012', format: BarcodeFormat.UPC_A },
    { option: 'ITF14', value: '12345678901231', format: BarcodeFormat.ITF },
  ] as const;

  for (const barcodeCase of cases) {
    await page.getByLabel('条码编码标准', { exact: true }).selectOption(barcodeCase.option);
    await page.getByRole('button', { name: '使用示例', exact: true }).click();
    await expect(input).toHaveValue(barcodeCase.value);
    const image = page.getByRole('img', {
      name: `条形码预览：${barcodeCase.value}`,
      exact: true,
    });
    await expect(image).toBeVisible();
    expect(await decodeGeneratedImage(image, barcodeCase.format)).toBe(barcodeCase.value);
  }
});

test('Pharmacode 示例会生成有效条形码', async ({ page }) => {
  await openApp(page);

  const barcodeMode = page.getByRole('button', { name: /一维条码/ });
  await barcodeMode.click();
  await expect(barcodeMode).toHaveAttribute('aria-pressed', 'true');

  await page.getByLabel('条码编码标准', { exact: true }).selectOption('pharmacode');
  await page.getByRole('button', { name: '使用示例', exact: true }).click();

  const input = page.getByLabel(/输入生成内容 \/ 序列号 \/ 网址/);
  await expect(input).toHaveValue('12345');
  await expect(page.getByRole('img', { name: '条形码预览：12345', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '下载图片', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('样式设置会跨刷新保存并可一键恢复默认', async ({ page }) => {
  await openApp(page);

  const qrSize = page.getByLabel(/二维码尺寸/);
  await qrSize.fill('300');
  await expect(qrSize).toHaveValue('300');

  await page.reload();
  await expect(page.getByLabel(/二维码尺寸/)).toHaveValue('300');

  await page.getByRole('button', { name: '恢复默认', exact: true }).click();
  await expect(page.getByLabel(/二维码尺寸/)).toHaveValue('220');
  await expect(page.getByLabel(/内边距/)).toHaveValue('4');

  await page.reload();
  await expect(page.getByLabel(/二维码尺寸/)).toHaveValue('220');
});

test('下载的 Excel 模板只包含输入文本和附加内容', async ({ page }) => {
  await openApp(page);

  await page.getByRole('tab', { name: /Excel 批量/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 Excel 模板文件 (.xlsx)', exact: true }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('条码_二维码导入模版.xlsx');
  expect(await download.failure()).toBeNull();

  const workbook = new ExcelJS.Workbook();
  const downloadedBuffer = await readDownload(download);
  await workbook.xlsx.load(Uint8Array.from(downloadedBuffer).buffer);
  const worksheet = workbook.worksheets[0];

  expect(worksheet.columnCount).toBe(2);
  expect([
    worksheet.getCell('A1').text,
    worksheet.getCell('B1').text,
    worksheet.getCell('C1').text,
  ]).toEqual(['输入文本', '附加内容', '']);
  expect(worksheet.getCell('A2').numFmt).toBe('@');
});

test('页面开关统一覆盖旧 Excel 列且空白行不会打乱导出位置', async ({ page }) => {
  await openApp(page);

  const batchTab = page.getByRole('tab', { name: /Excel 批量/ });
  await batchTab.click();
  await expect(batchTab).toHaveAttribute('aria-selected', 'true');

  const showInputTextSwitch = page.getByRole('switch', { name: /显示输入文本/ });
  await showInputTextSwitch.setChecked(false);
  await expect(showInputTextSwitch).not.toBeChecked();

  const buffer = await createLegacyBlankRowWorkbook();
  await page.locator('#excel-file-upload').setInputFiles({
    name: 'blank-row-fixture.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  });

  await expect(page.getByText(/^成功读取 2 条数据记录/)).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: '已忽略 Excel 中的“显示输入文本”列，显示规则以页面开关为准。' }),
  ).toBeVisible();
  await expect(
    page.getByText('已识别 2 行数据 · 工作表：[数据] · 表头第 1 行 · 主列：[输入文本]', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText('预览生成完成，共 2 条。', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /第 \d+ 个二维码预览/ })).toHaveCount(2);
  await expect(page.getByText('ROW-2', { exact: true })).toBeVisible();
  await expect(page.getByText('ROW-4', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);

  const previewImages = page.getByRole('img', { name: /第 \d+ 个二维码预览/ });
  const hiddenTextSizes = await previewImages.evaluateAll((elements) =>
    elements.map((element) => {
      const image = element as HTMLImageElement;
      return { width: image.naturalWidth, height: image.naturalHeight };
    }),
  );
  expect(hiddenTextSizes).toHaveLength(2);
  expect(hiddenTextSizes.every(({ width, height }) => width > 0 && height > 0)).toBe(true);

  await showInputTextSwitch.setChecked(true);
  await expect(showInputTextSwitch).toBeChecked();
  await expect
    .poll(async () => {
      const visibleTextSizes = await previewImages.evaluateAll((elements) =>
        elements.map((element) => {
          const image = element as HTMLImageElement;
          return { width: image.naturalWidth, height: image.naturalHeight };
        }),
      );
      return (
        visibleTextSizes.length === 2 &&
        visibleTextSizes.every(
          ({ height }, index) => height > (hiddenTextSizes[index]?.height ?? Number.POSITIVE_INFINITY),
        )
      );
    })
    .toBe(true);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出包含二维码的 Excel', exact: true }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^批量二维码导出_\d+\.xlsx$/);
  expect(await download.failure()).toBeNull();

  const exportedWorkbook = new ExcelJS.Workbook();
  const downloadedBuffer = await readDownload(download);
  await exportedWorkbook.xlsx.load(Uint8Array.from(downloadedBuffer).buffer);
  const exportedSheet = exportedWorkbook.worksheets[0];

  expect(exportedSheet).toBeDefined();
  expect(exportedSheet.getCell('A2').text).toBe('ROW-2');
  expect(exportedSheet.getCell('A3').text).toBe('');
  expect(exportedSheet.getCell('A4').text).toBe('ROW-4');

  let imageColumn = 0;
  exportedSheet.getRow(1).eachCell((cell, columnNumber) => {
    if (cell.text === '生成二维码图片') imageColumn = columnNumber;
  });
  expect(imageColumn).toBeGreaterThan(0);

  const imageRows = exportedSheet
    .getImages()
    .map((image) => Math.floor(image.range.tl.nativeRow))
    .sort((left, right) => left - right);
  expect(imageRows).toEqual([1, 3]);
});

test('375px 手机布局无横向滚动且核心工作区优先', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openApp(page);

  await expect(page.getByRole('heading', { name: '二维码 / 条码生成器', exact: true })).toBeVisible();
  await expect(page.getByRole('tablist', { name: '生成方式', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /^二维码预览：/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(2);
  for (const tab of await tabs.all()) {
    const box = await tab.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
  }

  const workspace = page.getByRole('region', { name: '码图生成工作区', exact: true });
  const settings = page.getByRole('complementary', { name: '生成样式设置', exact: true });
  const workspaceBox = await workspace.boundingBox();
  const settingsBox = await settings.boundingBox();

  expect(workspaceBox).not.toBeNull();
  expect(settingsBox).not.toBeNull();
  expect(workspaceBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(
    settingsBox?.y ?? Number.NEGATIVE_INFINITY,
  );
  await expect(settings).toHaveCSS('position', 'static');

  await page.getByRole('tab', { name: /Excel 批量/ }).click();
  await expect(page.getByRole('heading', { name: '下载 Excel 标准模版', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
