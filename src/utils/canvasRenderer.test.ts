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
});
