import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { QrConfig } from '../types';

export interface RenderResult {
  dataUrl: string;
  width: number;
  height: number;
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
        config.customAspectRatioWidth &&
        config.customAspectRatioHeight &&
        config.customAspectRatioHeight > 0
      ) {
        return config.customAspectRatioWidth / config.customAspectRatioHeight;
      }
      return null;
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
 * 绘制组合（二维码或一维条形码）及文字图片（支持矢量级高清倍数渲染）
 */
export async function generateCompositeCode(
  inputText: string,
  config: QrConfig,
  overrideShowInputText?: boolean,
  overrideExtraText?: string
): Promise<RenderResult> {
  const scale = Math.max(1, config.scale || 2);
  const showInput = overrideShowInputText ?? config.showInputText;
  const extraTextToDraw =
    overrideExtraText !== undefined && overrideExtraText !== null
      ? overrideExtraText
      : config.extraText;

  const codeCanvas = document.createElement('canvas');

  // 1. 离屏绘制基础码图 (带高清比例乘以 scale)
  if (config.codeMode === 'barcode') {
    const rawText = inputText.trim() || '12345678';
    try {
      JsBarcode(codeCanvas, rawText, {
        format: config.barcodeFormat,
        width: Math.max(1, config.barcodeWidth * scale),
        height: Math.max(20, config.barcodeHeight * scale),
        margin: config.margin * 3 * scale,
        displayValue: false,
        background: config.bgColor,
        lineColor: config.qrColor,
      });
    } catch (err: any) {
      throw new Error(`条码生成失败 [${config.barcodeFormat}]: ${err.message || '内容格式不匹配'}`);
    }
  } else {
    // 二维码
    await QRCode.toCanvas(codeCanvas, inputText || ' ', {
      width: config.qrSize * scale,
      margin: config.margin,
      color: {
        dark: config.qrColor,
        light: config.bgColor,
      },
      errorCorrectionLevel: 'M',
    });
  }

  // 2. 测量内容的自然基础尺寸 (放大 scale 倍)
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) throw new Error('Canvas 2D context不可用');

  const minNaturalWidth = (config.codeMode === 'barcode' ? 220 : config.qrSize) * scale;
  const naturalWidth = Math.max(codeCanvas.width, minNaturalWidth);
  const textMaxWidth = Math.max(naturalWidth - 16 * scale, 100 * scale);

  const scaledInputFontSize = config.inputFontSize * scale;
  const scaledExtraFontSize = config.extraFontSize * scale;
  const scaledTextPadding = config.textPadding * scale;
  const scaledPaddingBottom = config.paddingBottom * scale;

  let inputLines: string[] = [];
  let extraLines: string[] = [];

  if (showInput && inputText) {
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
    ctx.drawImage(codeCanvas, codeX, codeY, targetCodeWidth, codeCanvas.height);
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

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
  };
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
