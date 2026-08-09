import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../types';
import { renderCompositeCode } from './renderClient';

describe('renderCompositeCode', () => {
  it('falls back to the main renderer when Worker APIs are unavailable', async () => {
    await expect(renderCompositeCode('   ', defaultConfig)).rejects.toThrow('内容不能只包含空白字符');
  });

  it('rejects an already-aborted request before loading the renderer', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      renderCompositeCode('A001', defaultConfig, undefined, undefined, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

