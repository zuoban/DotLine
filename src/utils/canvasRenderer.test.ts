import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../types';
import { generateCompositeCode } from './canvasRenderer';

describe('generateCompositeCode', () => {
  it('rejects empty content instead of generating a placeholder code', async () => {
    await expect(generateCompositeCode('   ', defaultConfig)).rejects.toThrow('内容不能只包含空白字符');
  });
});
