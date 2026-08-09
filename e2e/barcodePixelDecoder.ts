import type { Locator, Page } from '@playwright/test';

export interface BarcodeRun {
  dark: boolean;
  width: number;
}

export interface BarcodeScanline {
  imageWidth: number;
  leftQuietZone: number;
  rightQuietZone: number;
  runs: BarcodeRun[];
}

function moduleCount(width: number, moduleWidth: number, label: string): number {
  const ratio = width / moduleWidth;
  const rounded = Math.round(ratio);
  if (rounded < 1 || Math.abs(ratio - rounded) > 0.3) {
    throw new Error(`${label}宽度 ${width}px 不是基础模块 ${moduleWidth}px 的整数倍`);
  }
  return rounded;
}

async function readBarcodeSource(page: Page, sourceUrl: string): Promise<BarcodeScanline> {
  return page.evaluate(async (url) => {
    const source = new Image();
    source.src = url;
    await source.decode();
    const canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('测试环境无法创建 Canvas context');
    context.drawImage(source, 0, 0);

    const row = context.getImageData(0, Math.floor(canvas.height / 2), canvas.width, 1).data;
    const darkPixels = Array.from({ length: canvas.width }, (_, index) => {
      const offset = index * 4;
      const luminance =
        (row[offset] * 299 + row[offset + 1] * 587 + row[offset + 2] * 114) / 1000;
      return row[offset + 3] > 127 && luminance < 128;
    });
    const firstDark = darkPixels.indexOf(true);
    const lastDark = darkPixels.lastIndexOf(true);
    if (firstDark < 0 || lastDark < firstDark) throw new Error('未在导出图片中找到条码线条');

    const runs: BarcodeRun[] = [];
    let dark = darkPixels[firstDark];
    let width = 0;
    for (let index = firstDark; index <= lastDark; index += 1) {
      if (darkPixels[index] === dark) {
        width += 1;
      } else {
        runs.push({ dark, width });
        dark = darkPixels[index];
        width = 1;
      }
    }
    runs.push({ dark, width });

    return {
      imageWidth: canvas.width,
      leftQuietZone: firstDark,
      rightQuietZone: canvas.width - lastDark - 1,
      runs,
    };
  }, sourceUrl);
}

export async function readBarcodeScanline(image: Locator): Promise<BarcodeScanline> {
  const sourceUrl = await image.getAttribute('src');
  if (!sourceUrl) throw new Error('条码预览缺少图片地址');
  return readBarcodeSource(image.page(), sourceUrl);
}

export async function readBarcodePngScanline(
  page: Page,
  pngBuffer: Buffer,
): Promise<BarcodeScanline> {
  return readBarcodeSource(page, `data:image/png;base64,${pngBuffer.toString('base64')}`);
}

export function decodeMsi(scanline: BarcodeScanline): string {
  const moduleWidth = Math.min(...scanline.runs.map(({ width }) => width));
  const binary = scanline.runs
    .map(({ dark, width }) =>
      (dark ? '1' : '0').repeat(moduleCount(width, moduleWidth, 'MSI 条纹'))
    )
    .join('');

  if (!binary.startsWith('110') || !binary.endsWith('1001')) {
    throw new Error('MSI 起止标记无效或扫描方向错误');
  }
  const body = binary.slice(3, -4);
  if (body.length === 0 || body.length % 12 !== 0) {
    throw new Error('MSI 数据区长度无效');
  }

  let value = '';
  for (let offset = 0; offset < body.length; offset += 12) {
    const encodedDigit = body.slice(offset, offset + 12);
    let bits = '';
    for (let bitOffset = 0; bitOffset < 12; bitOffset += 3) {
      const symbol = encodedDigit.slice(bitOffset, bitOffset + 3);
      if (symbol === '100') bits += '0';
      else if (symbol === '110') bits += '1';
      else throw new Error(`MSI 数字包含无效条纹 ${symbol}`);
    }
    value += Number.parseInt(bits, 2).toString(10);
  }
  return value;
}

export function decodePharmacode(scanline: BarcodeScanline): string {
  const gapWidths = scanline.runs.filter(({ dark }) => !dark).map(({ width }) => width);
  if (gapWidths.length === 0) throw new Error('Pharmacode 至少需要两条码条');
  const sortedGapWidths = [...gapWidths].sort((left, right) => left - right);
  const moduleWidth = sortedGapWidths[Math.floor(sortedGapWidths.length / 2)] / 2;
  if (!Number.isFinite(moduleWidth) || moduleWidth <= 0) {
    throw new Error('Pharmacode 基础模块宽度无效');
  }

  let value = 0;
  scanline.runs.forEach((run) => {
    const modules = moduleCount(run.width, moduleWidth, 'Pharmacode 条纹');
    if (!run.dark) {
      if (modules !== 2) throw new Error(`Pharmacode 间距应为 2 个模块，实际为 ${modules}`);
      return;
    }
    if (modules !== 1 && modules !== 3) {
      throw new Error(`Pharmacode 码条应为 1 或 3 个模块，实际为 ${modules}`);
    }
    value = value * 2 + (modules === 1 ? 1 : 2);
  });

  if (value < 3 || value > 131070) throw new Error(`Pharmacode 解码值 ${value} 超出标准范围`);
  return String(value);
}
