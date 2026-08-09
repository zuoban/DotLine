import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseExcelFile } from './excelClient';

function createFile(): File {
  const buffer = new Uint8Array([1, 2, 3]).buffer;
  return {
    name: 'fixture.xlsx',
    size: buffer.byteLength,
    arrayBuffer: async () => buffer,
  } as File;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Excel Worker client', () => {
  it('parses in a dedicated worker and forwards task stages', async () => {
    const terminateMock = vi.fn();
    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      postMessage() {
        queueMicrotask(() => {
          this.onmessage?.({ data: { type: 'stage', stage: 'parsing' } } as MessageEvent);
          this.onmessage?.({
            data: {
              type: 'result',
              result: {
                rows: [],
                headers: ['输入文本'],
                inputTextCol: '输入文本',
                worksheetName: 'Data',
                headerRowNumber: 1,
              },
            },
          } as MessageEvent);
        });
      }

      terminate = terminateMock;
    }
    vi.stubGlobal('Worker', FakeWorker);
    const stages: string[] = [];

    const result = await parseExcelFile(createFile(), (stage) => stages.push(stage));

    expect(result.worksheetName).toBe('Data');
    expect(stages).toEqual(['reading', 'parsing']);
    expect(terminateMock).toHaveBeenCalledOnce();
  });

  it('terminates the worker immediately when parsing is canceled', async () => {
    const terminateMock = vi.fn();
    let markWorkerStarted: (() => void) | undefined;
    const workerStarted = new Promise<void>((resolve) => {
      markWorkerStarted = resolve;
    });
    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      constructor() {
        markWorkerStarted?.();
      }
      postMessage() {}
      terminate = terminateMock;
    }
    vi.stubGlobal('Worker', FakeWorker);
    const controller = new AbortController();

    const parsing = parseExcelFile(createFile(), undefined, controller.signal);
    await workerStarted;
    controller.abort();

    await expect(parsing).rejects.toMatchObject({ name: 'AbortError' });
    expect(terminateMock).toHaveBeenCalledOnce();
  });
});
