import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { QrConfig } from '../types';

export interface RenderResult {
  dataUrl: string;
  width: number;
  height: number;
}

const MAX_INPUT_LENGTH = 4096;
const MAX_EXTRA_TEXT_LENGTH = 4096;
const MAX_SCALE = 4;
const MAX_CANVAS_DIMENSION = 8192;
const MAX_CANVAS_PIXELS = 16_777_216;
const MIN_CODE_CONTRAST_RATIO = 3;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}

function parseHexColor(value: string): [number, number, number] | null {
  const normalized = value.trim().replace(/^#/, '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((character) => `${character}${character}`).join('')
    : normalized.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;
  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
  ];
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const linearize = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}

function assertCodeContrast(foreground: string, background: string): void {
  const foregroundRgb = parseHexColor(foreground);
  const backgroundRgb = parseHexColor(background);
  if (!foregroundRgb || !backgroundRgb) return;

  const foregroundLuminance = relativeLuminance(foregroundRgb);
  const backgroundLuminance = relativeLuminance(backgroundRgb);
  const contrastRatio =
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
  if (contrastRatio < MIN_CODE_CONTRAST_RATIO) {
    throw new Error(
      `码颜色与背景颜色对比度不足（${contrastRatio.toFixed(2)}:1），可能无法扫描；请使用更深的码颜色或更浅的背景色。`
    );
  }
}

function requireNumberInRange(
  value: number,
  label: string,
  min: number,
  max: number
): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label}必须是 ${min} 到 ${max} 之间的有效数值。`);
  }
  return value;
}

function assertCanvasSize(width: number, height: number, label: string): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`${label}尺寸无效，请检查尺寸与宽高比设置。`);
  }

  const roundedWidth = Math.ceil(width);
  const roundedHeight = Math.ceil(height);
  if (roundedWidth > MAX_CANVAS_DIMENSION || roundedHeight > MAX_CANVAS_DIMENSION) {
    throw new Error(
      `${label}尺寸过大（${roundedWidth} × ${roundedHeight}px），单边不能超过 ${MAX_CANVAS_DIMENSION}px；请缩短内容或调低尺寸、倍率。`
    );
  }

  if (roundedWidth * roundedHeight > MAX_CANVAS_PIXELS) {
    throw new Error(
      `${label}像素总量过大（${roundedWidth} × ${roundedHeight}px）；请调低尺寸、倍率或调整宽高比。`
    );
  }
}

/**
 * 计算数字比例值 W / H
 */
function getTargetAspectRatio(config: QrConfig): number | null {
  switch (config.aspectRatio) {
    case '1:1':
      return 1;
    case '4:3':
      return 4 / 3;
    case '3:2':
      return 1.5;
    case '16:9':
      return 16 / 9;
    case '9:16':
      return 9 / 16;
    case 'custom':
      if (
        !Number.isFinite(config.customAspectRatioWidth) ||
        !Number.isFinite(config.customAspectRatioHeight) ||
        !config.customAspectRatioWidth ||
        !config.customAspectRatioHeight ||
        config.customAspectRatioWidth <= 0 ||
        config.customAspectRatioHeight <= 0
      ) {
        throw new Error('自定义宽高比必须使用大于 0 的有效数值。');
      }
      return config.customAspectRatioWidth / config.customAspectRatioHeight;
    case 'auto':
    default:
      return null;
  }
}

/**
 * 将长文本按最大宽度拆分成多行数组
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [];
  const lines: string[] = [];
  const words = text.split('');
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine + words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * 绘制组合（二维码或一维条形码）及文字图片（支持高清像素倍数渲染）
 */
export async function generateCompositeCode(
  inputText: string,
  config: QrConfig,
  overrideShowInputText?: boolean,
  overrideExtraText?: string
): Promise<RenderResult> {
  if (typeof inputText !== 'string' || !inputText.trim()) {
    throw new Error('请输入要生成的内容，内容不能只包含空白字符。');
  }

  const trimmedInput = inputText.trim();
  if (inputText.length > MAX_INPUT_LENGTH) {
    throw new Error(`生成内容过长，最多支持 ${MAX_INPUT_LENGTH} 个字符。`);
  }

  const scale = requireNumberInRange(config.scale ?? 2, '清晰度倍率', 1, MAX_SCALE);
  const margin = requireNumberInRange(config.margin, '码图边距', 0, 64);
  const showInput = overrideShowInputText ?? config.showInputText;
  const resolvedExtraText =
    overrideExtraText !== undefined && overrideExtraText !== null
      ? overrideExtraText
      : config.extraText;
  if (typeof resolvedExtraText !== 'string') {
    throw new Error('附加文本必须是字符串。');
  }
  if (resolvedExtraText.length > MAX_EXTRA_TEXT_LENGTH) {
    throw new Error(`附加文本过长，最多支持 ${MAX_EXTRA_TEXT_LENGTH} 个字符。`);
  }
  const extraTextToDraw = resolvedExtraText;
  assertCodeContrast(config.qrColor, config.bgColor);

  const inputFontSize = showInput
    ? requireNumberInRange(config.inputFontSize, '输入文本字号', 1, 256)
    : config.inputFontSize;
  const extraFontSize = extraTextToDraw
    ? requireNumberInRange(config.extraFontSize, '附加文本字号', 1, 256)
    : config.extraFontSize;
  const textPadding = requireNumberInRange(config.textPadding, '文本间距', 0, 2048);
  const paddingBottom = requireNumberInRange(config.paddingBottom, '画布底边距', 0, 2048);

  const codeCanvas = document.createElement('canvas');

  // 1. 离屏绘制基础码图 (带高清比例乘以 scale)
  if (config.codeMode === 'barcode') {
    const barcodeWidth = requireNumberInRange(config.barcodeWidth, '条码线宽', 0.1, 16);
    const barcodeHeight = requireNumberInRange(config.barcodeHeight, '条码高度', 1, 2048);
    const scaledBarcodeWidth = Math.max(1, barcodeWidth * scale);
    const scaledBarcodeHeight = Math.max(20, barcodeHeight * scale);
    const scaledBarcodeMargin = margin * 3 * scale;

    // JsBarcode 会先分配画布；用保守的模块数估算拦截明显超大的输入。
    const estimatedWidth =
      (trimmedInput.length * 16 + 128) * scaledBarcodeWidth + scaledBarcodeMargin * 2;
    const estimatedHeight = scaledBarcodeHeight + scaledBarcodeMargin * 2;
    assertCanvasSize(estimatedWidth, estimatedHeight, '条码画布');

    try {
      JsBarcode(codeCanvas, trimmedInput, {
        format: config.barcodeFormat,
        width: scaledBarcodeWidth,
        height: scaledBarcodeHeight,
        margin: scaledBarcodeMargin,
        displayValue: false,
        background: config.bgColor,
        lineColor: config.qrColor,
      });
    } catch (error: unknown) {
      throw new Error(
        `条码生成失败 [${config.barcodeFormat}]：${getErrorMessage(error, '内容格式不匹配')}`
      );
    }
  } else {
    // 二维码
    const qrSize = requireNumberInRange(config.qrSize, '二维码尺寸', 32, 2048);
    const scaledQrSize = qrSize * scale;
    assertCanvasSize(scaledQrSize, scaledQrSize, '二维码画布');

    try {
      await QRCode.toCanvas(codeCanvas, inputText, {
        width: scaledQrSize,
        margin,
        color: {
          dark: config.qrColor,
          light: config.bgColor,
        },
        errorCorrectionLevel: 'M',
      });
    } catch (error: unknown) {
      throw new Error(`二维码生成失败：${getErrorMessage(error, '内容格式不受支持')}`);
    }
  }

  assertCanvasSize(codeCanvas.width, codeCanvas.height, '码图画布');

  // 2. 测量内容的自然基础尺寸 (放大 scale 倍)
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) throw new Error('Canvas 2D context不可用');

  const minNaturalWidth = (config.codeMode === 'barcode' ? 220 : config.qrSize) * scale;
  const naturalWidth = Math.max(codeCanvas.width, minNaturalWidth);
  const textMaxWidth = Math.max(naturalWidth - 16 * scale, 100 * scale);

  const scaledInputFontSize = inputFontSize * scale;
  const scaledExtraFontSize = extraFontSize * scale;
  const scaledTextPadding = textPadding * scale;
  const scaledPaddingBottom = paddingBottom * scale;

  let inputLines: string[] = [];
  let extraLines: string[] = [];

  if (showInput) {
    measureCtx.font = `${scaledInputFontSize}px ${config.fontFamily}`;
    inputLines = wrapText(measureCtx, inputText, textMaxWidth);
  }

  if (extraTextToDraw) {
    measureCtx.font = `${scaledExtraFontSize}px ${config.fontFamily}`;
    extraLines = wrapText(measureCtx, extraTextToDraw, textMaxWidth);
  }

  const inputLineHeight = scaledInputFontSize * 1.2;
  const extraLineHeight = scaledExtraFontSize * 1.2;
  const textGap = Math.max(Math.round(scaledTextPadding * 0.75), 2 * scale);

  let totalTextHeight = 0;
  if (inputLines.length > 0) {
    totalTextHeight += inputLines.length * inputLineHeight + scaledTextPadding;
  }
  if (extraLines.length > 0) {
    totalTextHeight += extraLines.length * extraLineHeight + (inputLines.length > 0 ? textGap : scaledTextPadding);
  }

  const naturalHeight = codeCanvas.height + totalTextHeight + scaledPaddingBottom;

  // 3. 根据目标横纵比计算最终画布尺寸
  const targetRatio = getTargetAspectRatio(config);
  let finalWidth = naturalWidth;
  let finalHeight = naturalHeight;

  if (targetRatio && targetRatio > 0) {
    const naturalRatio = naturalWidth / naturalHeight;
    if (naturalRatio > targetRatio) {
      finalWidth = naturalWidth;
      finalHeight = Math.round(naturalWidth / targetRatio);
    } else if (naturalRatio < targetRatio) {
      finalHeight = naturalHeight;
      finalWidth = Math.round(naturalHeight * targetRatio);
    }
  }

  assertCanvasSize(finalWidth, finalHeight, '最终画布');

  // 4. 创建并绘制高清最终画布
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context不可用');

  canvas.width = finalWidth;
  canvas.height = finalHeight;

  // 填充背景
  ctx.fillStyle = config.bgColor;
  ctx.fillRect(0, 0, finalWidth, finalHeight);

  // 计算整体居中偏移值 (offsetX, offsetY)
  const offsetX = Math.round((finalWidth - naturalWidth) / 2);
  const offsetY = Math.round((finalHeight - naturalHeight) / 2);

  // A. 绘制码图
  if (config.codeMode === 'barcode' && config.autoWidthBarcode) {
    const targetCodeWidth = Math.max(finalWidth - 32 * scale, codeCanvas.width);
    const codeX = Math.round((finalWidth - targetCodeWidth) / 2);
    const codeY = offsetY;
    const previousImageSmoothing = ctx.imageSmoothingEnabled;
    if (targetCodeWidth !== codeCanvas.width) {
      ctx.imageSmoothingEnabled = false;
    }
    ctx.drawImage(codeCanvas, codeX, codeY, targetCodeWidth, codeCanvas.height);
    ctx.imageSmoothingEnabled = previousImageSmoothing;
  } else {
    const codeX = offsetX + Math.round((naturalWidth - codeCanvas.width) / 2);
    const codeY = offsetY;
    ctx.drawImage(codeCanvas, codeX, codeY);
  }

  // B. 绘制下方文字
  let currentY = offsetY + codeCanvas.height + scaledTextPadding;
  const centerX = finalWidth / 2;

  if (inputLines.length > 0) {
    ctx.font = `500 ${scaledInputFontSize}px ${config.fontFamily}`;
    ctx.fillStyle = config.inputFontColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (const line of inputLines) {
      ctx.fillText(line, centerX, currentY);
      currentY += inputLineHeight;
    }
    if (extraLines.length > 0) {
      currentY += textGap;
    }
  }

  if (extraLines.length > 0) {
    ctx.font = `${scaledExtraFontSize}px ${config.fontFamily}`;
    ctx.fillStyle = config.extraFontColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (const line of extraLines) {
      ctx.fillText(line, centerX, currentY);
      currentY += extraLineHeight;
    }
  }

  try {
    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
    };
  } catch (error: unknown) {
    throw new Error(`图片导出失败：${getErrorMessage(error, '浏览器无法处理当前画布尺寸')}`);
  }
}

/**
 * 保持兼容的简单函数包装
 */
export async function generateCompositeQR(
  inputText: string,
  config: QrConfig,
  overrideShowInputText?: boolean,
  overrideExtraText?: string
): Promise<string> {
  const result = await generateCompositeCode(
    inputText,
    config,
    overrideShowInputText,
    overrideExtraText
  );
  return result.dataUrl;
}
