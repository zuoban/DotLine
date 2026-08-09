import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../types';
import { sanitizeStoredConfig } from './configStorage';

describe('sanitizeStoredConfig', () => {
  it('preserves valid preferences while clamping unsafe numeric values', () => {
    const config = sanitizeStoredConfig({
      ...defaultConfig,
      codeMode: 'barcode',
      barcodeFormat: 'EAN13',
      qrSize: 9999,
      scale: 4,
      extraText: '批次 A',
    });

    expect(config).toMatchObject({
      codeMode: 'barcode',
      barcodeFormat: 'EAN13',
      qrSize: 400,
      scale: 4,
      extraText: '批次 A',
    });
  });

  it('falls back to safe defaults for invalid enums, colors and types', () => {
    const config = sanitizeStoredConfig({
      codeMode: 'invalid',
      barcodeFormat: 'UNKNOWN',
      qrColor: 'red',
      bgColor: null,
      showInputText: 'yes',
    });

    expect(config.codeMode).toBe(defaultConfig.codeMode);
    expect(config.barcodeFormat).toBe(defaultConfig.barcodeFormat);
    expect(config.qrColor).toBe(defaultConfig.qrColor);
    expect(config.bgColor).toBe(defaultConfig.bgColor);
    expect(config.showInputText).toBe(defaultConfig.showInputText);
  });
});

