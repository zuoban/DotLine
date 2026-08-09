/// <reference lib="webworker" />

import { QrConfig } from '../types';
import { generateCompositeCode } from './canvasRenderer';

interface RenderRequest {
  type: 'render';
  id: number;
  inputText: string;
  config: QrConfig;
  overrideShowInputText?: boolean;
  overrideExtraText?: string;
}

interface CancelRequest {
  type: 'cancel';
  id: number;
}

const workerScope = self as DedicatedWorkerGlobalScope;
const canceledRequests = new Set<number>();

workerScope.onmessage = async (event: MessageEvent<RenderRequest | CancelRequest>) => {
  const request = event.data;
  if (request.type === 'cancel') {
    canceledRequests.add(request.id);
    return;
  }

  try {
    const result = await generateCompositeCode(
      request.inputText,
      request.config,
      request.overrideShowInputText,
      request.overrideExtraText,
    );
    if (!canceledRequests.has(request.id)) {
      workerScope.postMessage({ type: 'result', id: request.id, result });
    }
  } catch (error: unknown) {
    if (!canceledRequests.has(request.id)) {
      workerScope.postMessage({
        type: 'error',
        id: request.id,
        message: error instanceof Error ? error.message : '码图生成失败',
      });
    }
  } finally {
    canceledRequests.delete(request.id);
  }
};

export {};

