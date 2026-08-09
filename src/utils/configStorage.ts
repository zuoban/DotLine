import {
  AspectRatioOption,
  BarcodeFormat,
  CodeMode,
  defaultConfig,
  QrConfig,
} from '../types';

const STORAGE_KEY = 'dotline.config.v1';
const STORAGE_VERSION = 1;
const CODE_MODES = new Set<CodeMode>(['qr', 'barcode']);
const BARCODE_FORMATS = new Set<BarcodeFormat>([
  'CODE128',
  'CODE39',
  'EAN13',
  'EAN8',
  'UPC',
  'ITF14',
  'MSI',
  'pharmacode',
]);
const ASPECT_RATIOS = new Set<AspectRatioOption>([
  'auto',
  '1:1',
  '4:3',
  '3:2',
  '16:9',
  '9:16',
  'custom',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function stringValue(value: unknown, fallback: string, maxLength: number): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

function colorValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export function sanitizeStoredConfig(value: unknown): QrConfig {
  if (!isRecord(value)) return { ...defaultConfig };

  return {
    codeMode:
      typeof value.codeMode === 'string' && CODE_MODES.has(value.codeMode as CodeMode)
        ? value.codeMode as CodeMode
        : defaultConfig.codeMode,
    barcodeFormat:
      typeof value.barcodeFormat === 'string' && BARCODE_FORMATS.has(value.barcodeFormat as BarcodeFormat)
        ? value.barcodeFormat as BarcodeFormat
        : defaultConfig.barcodeFormat,
    barcodeWidth: numberInRange(value.barcodeWidth, defaultConfig.barcodeWidth, 1, 4),
    barcodeHeight: numberInRange(value.barcodeHeight, defaultConfig.barcodeHeight, 40, 160),
    autoWidthBarcode: booleanValue(value.autoWidthBarcode, defaultConfig.autoWidthBarcode),
    qrSize: numberInRange(value.qrSize, defaultConfig.qrSize, 120, 400),
    qrColor: colorValue(value.qrColor, defaultConfig.qrColor),
    bgColor: colorValue(value.bgColor, defaultConfig.bgColor),
    margin: numberInRange(value.margin, defaultConfig.margin, 0, 4),
    scale: [1, 2, 3, 4].includes(value.scale as number)
      ? value.scale as number
      : defaultConfig.scale,
    aspectRatio:
      typeof value.aspectRatio === 'string' && ASPECT_RATIOS.has(value.aspectRatio as AspectRatioOption)
        ? value.aspectRatio as AspectRatioOption
        : defaultConfig.aspectRatio,
    customAspectRatioWidth: numberInRange(
      value.customAspectRatioWidth,
      defaultConfig.customAspectRatioWidth ?? 16,
      1,
      100,
    ),
    customAspectRatioHeight: numberInRange(
      value.customAspectRatioHeight,
      defaultConfig.customAspectRatioHeight ?? 9,
      1,
      100,
    ),
    showInputText: booleanValue(value.showInputText, defaultConfig.showInputText),
    inputFontSize: numberInRange(value.inputFontSize, defaultConfig.inputFontSize, 10, 24),
    inputFontColor: colorValue(value.inputFontColor, defaultConfig.inputFontColor),
    extraText: stringValue(value.extraText, defaultConfig.extraText, 4096),
    extraFontSize: numberInRange(value.extraFontSize, defaultConfig.extraFontSize, 10, 24),
    extraFontColor: colorValue(value.extraFontColor, defaultConfig.extraFontColor),
    textPadding: numberInRange(value.textPadding, defaultConfig.textPadding, 0, 20),
    paddingBottom: numberInRange(value.paddingBottom, defaultConfig.paddingBottom, 0, 30),
    fontFamily: stringValue(value.fontFamily, defaultConfig.fontFamily, 100),
  };
}

export function loadStoredConfig(): QrConfig {
  if (typeof window === 'undefined') return { ...defaultConfig };

  try {
    const storedValue = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (!isRecord(storedValue) || storedValue.version !== STORAGE_VERSION) {
      return { ...defaultConfig };
    }
    return sanitizeStoredConfig(storedValue.config);
  } catch {
    return { ...defaultConfig };
  }
}

export function saveStoredConfig(config: QrConfig): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, config }),
    );
  } catch {
    // 无痕模式或存储配额不足时继续使用内存中的配置。
  }
}

