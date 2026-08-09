import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../types';
import { generateCompositeCode } from './canvasRenderer';

describe('generateCompositeCode', () => {
  it('rejects empty content instead of generating a placeholder code', async () => {
    await expect(generateCompositeCode('   ', defaultConfig)).rejects.toThrow('内容不能只包含空白字符');
  });

  it('rejects foreground and background colors that are too similar to scan reliably', async () => {
    await expect(
      generateCompositeCode('https://example.com', {
        ...defaultConfig,
        qrColor: '#777777',
        bgColor: '#999999',
      }),
    ).rejects.toThrow('对比度不足');
  });

  it('rejects non-numeric MSI input with an explicit checksum-mode message', async () => {
    await expect(
      generateCompositeCode('12A34', {
        ...defaultConfig,
        codeMode: 'barcode',
        barcodeFormat: 'MSI',
      }),
    ).rejects.toThrow('MSI（无校验位模式）仅支持纯数字');
  });

  it.each(['2', '131071', '12abc', '0003'])(
    'rejects non-canonical Pharmacode input %s',
    async (inputText) => {
      await expect(
        generateCompositeCode(inputText, {
          ...defaultConfig,
          codeMode: 'barcode',
          barcodeFormat: 'pharmacode',
        }),
      ).rejects.toThrow('Pharmacode 仅支持 3 到 131070 之间且不含前导零的整数');
    },
  );
});
