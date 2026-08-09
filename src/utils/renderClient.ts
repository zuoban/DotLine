import { QrConfig } from '../types';
import type { RenderResult } from './canvasRenderer';

interface WorkerResponse {
  type: 'result' | 'error';
  id: number;
  result?: RenderResult;
  message?: string;
}

interface PendingRender {
  resolve: (result: RenderResult) => void;
  reject: (error: Error) => void;
  fallback: () => Promise<RenderResult>;
  removeAbortListener?: () => void;
}

let renderWorker: Worker | null = null;
let workerUnavailable = false;
let nextRequestId = 1;
const pendingRenders = new Map<number, PendingRender>();

function createAbortError(): Error {
  const error = new Error('操作已取消');
  error.name = 'AbortError';
  return error;
}

function fallbackAllPending(): void {
  pendingRenders.forEach((pending) => {
    pending.removeAbortListener?.();
    void pending.fallback().then(pending.resolve, pending.reject);
  });
  pendingRenders.clear();
}

function getRenderWorker(): Worker | null {
  if (workerUnavailable || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return null;
  }
  if (renderWorker) return renderWorker;

  try {
    renderWorker = new Worker(new URL('./codeRenderer.worker.ts', import.meta.url), {
      type: 'module',
      name: 'dotline-code-renderer',
    });
    renderWorker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const pending = pendingRenders.get(response.id);
      if (!pending) return;
      pendingRenders.delete(response.id);
      pending.removeAbortListener?.();

      if (response.type === 'result' && response.result) {
        pending.resolve(response.result);
      } else {
        pending.reject(new Error(response.message || '码图生成失败'));
      }
    };
    renderWorker.onerror = () => {
      workerUnavailable = true;
      renderWorker?.terminate();
      renderWorker = null;
      fallbackAllPending();
    };
    return renderWorker;
  } catch {
    workerUnavailable = true;
    renderWorker = null;
    return null;
  }
}

async function renderOnMainThread(
  inputText: string,
  config: QrConfig,
  overrideShowInputText?: boolean,
  overrideExtraText?: string,
  signal?: AbortSignal,
): Promise<RenderResult> {
  if (signal?.aborted) throw createAbortError();
  const { generateCompositeCode } = await import('./canvasRenderer');
  if (signal?.aborted) throw createAbortError();
  const result = await generateCompositeCode(
    inputText,
    config,
    overrideShowInputText,
    overrideExtraText,
  );
  if (signal?.aborted) throw createAbortError();
  return result;
}

export async function renderCompositeCode(
  inputText: string,
  config: QrConfig,
  overrideShowInputText?: boolean,
  overrideExtraText?: string,
  signal?: AbortSignal,
): Promise<RenderResult> {
  if (signal?.aborted) throw createAbortError();
  const worker = getRenderWorker();
  if (!worker) {
    return renderOnMainThread(
      inputText,
      config,
      overrideShowInputText,
      overrideExtraText,
      signal,
    );
  }

  const id = nextRequestId;
  nextRequestId += 1;

  return new Promise<RenderResult>((resolve, reject) => {
    const pending: PendingRender = {
      resolve,
      reject,
      fallback: () => renderOnMainThread(
        inputText,
        config,
        overrideShowInputText,
        overrideExtraText,
        signal,
      ),
    };
    if (signal) {
      const handleAbort = () => {
        if (!pendingRenders.delete(id)) return;
        worker.postMessage({ type: 'cancel', id });
        reject(createAbortError());
      };
      signal.addEventListener('abort', handleAbort, { once: true });
      pending.removeAbortListener = () => signal.removeEventListener('abort', handleAbort);
    }

    pendingRenders.set(id, pending);
    worker.postMessage({
      type: 'render',
      id,
      inputText,
      config,
      overrideShowInputText,
      overrideExtraText,
    });
  });
}
