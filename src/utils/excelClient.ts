import saveAs from 'file-saver';
import { QrConfig, QrRowData } from '../types';
import type {
  BatchExportResult,
  BuiltExcelExport,
  ExcelTaskStage,
  ParsedExcelFile,
} from './excelHandler';

type ExcelWorkerRequest =
  | { type: 'parse'; fileName: string; fileBuffer: ArrayBuffer }
  | { type: 'template' }
  | {
      type: 'export';
      fileName: string;
      fileBuffer: ArrayBuffer;
      rowsData: QrRowData[];
      config: QrConfig;
    };

interface ExcelWorkerResponse {
  type: 'result' | 'error' | 'stage' | 'progress';
  result?: unknown;
  message?: string;
  stage?: ExcelTaskStage;
  current?: number;
  total?: number;
}

interface WorkerTaskOptions<T> {
  request: ExcelWorkerRequest;
  fallback: () => Promise<T>;
  onStage?: (stage: ExcelTaskStage) => void;
  onProgress?: (current: number, total: number) => void;
  signal?: AbortSignal;
  requiresOffscreenCanvas?: boolean;
}

let excelWorkerUnavailable = false;

function createAbortError(): Error {
  const error = new Error('操作已取消');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError();
}

async function readFileBuffer(file: File, signal?: AbortSignal): Promise<ArrayBuffer> {
  throwIfAborted(signal);
  if (!signal) return file.arrayBuffer();

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const handleAbort = () => reject(createAbortError());
    signal.addEventListener('abort', handleAbort, { once: true });
    void file.arrayBuffer().then(
      (buffer) => {
        signal.removeEventListener('abort', handleAbort);
        if (signal.aborted) reject(createAbortError());
        else resolve(buffer);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', handleAbort);
        reject(error);
      },
    );
  });
}

async function runExcelWorkerTask<T>({
  request,
  fallback,
  onStage,
  onProgress,
  signal,
  requiresOffscreenCanvas = false,
}: WorkerTaskOptions<T>): Promise<T> {
  throwIfAborted(signal);
  const canUseWorker =
    !excelWorkerUnavailable &&
    typeof Worker !== 'undefined' &&
    (!requiresOffscreenCanvas || typeof OffscreenCanvas !== 'undefined');
  if (!canUseWorker) return fallback();

  let worker: Worker;
  try {
    worker = new Worker(new URL('./excelProcessor.worker.ts', import.meta.url), {
      type: 'module',
      name: 'dotline-excel-processor',
    });
  } catch {
    excelWorkerUnavailable = true;
    return fallback();
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      signal?.removeEventListener('abort', handleAbort);
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const handleAbort = () => finish(() => reject(createAbortError()));
    const startFallback = () => {
      if (settled) return;
      settled = true;
      cleanup();
      excelWorkerUnavailable = true;
      if (signal?.aborted) {
        reject(createAbortError());
        return;
      }
      void fallback().then(resolve, reject);
    };

    worker.onmessage = (event: MessageEvent<ExcelWorkerResponse>) => {
      const response = event.data;
      if (response.type === 'stage' && response.stage) {
        onStage?.(response.stage);
        return;
      }
      if (
        response.type === 'progress' &&
        typeof response.current === 'number' &&
        typeof response.total === 'number'
      ) {
        onProgress?.(response.current, response.total);
        return;
      }
      if (response.type === 'error') {
        finish(() => reject(new Error(response.message || 'Excel 处理失败')));
        return;
      }
      if (response.type === 'result') {
        finish(() => resolve(response.result as T));
      }
    };
    worker.onerror = startFallback;
    signal?.addEventListener('abort', handleAbort, { once: true });

    try {
      const transfer = 'fileBuffer' in request ? [request.fileBuffer] : [];
      worker.postMessage(request, transfer);
    } catch {
      startFallback();
    }
  });
}

function saveWorkbook(buffer: ArrayBuffer, fileName: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, fileName);
}

export async function parseExcelFile(
  file: File,
  onStage?: (stage: ExcelTaskStage) => void,
  signal?: AbortSignal,
): Promise<ParsedExcelFile> {
  onStage?.('reading');
  const fileBuffer = await readFileBuffer(file, signal);
  throwIfAborted(signal);

  return runExcelWorkerTask<ParsedExcelFile>({
    request: { type: 'parse', fileName: file.name, fileBuffer },
    fallback: async () => {
      const handler = await import('./excelHandler');
      return handler.parseExcelFile(file, onStage, signal);
    },
    onStage,
    signal,
  });
}

export async function downloadExcelTemplate(
  onStage?: (stage: ExcelTaskStage) => void,
  signal?: AbortSignal,
): Promise<void> {
  const buffer = await runExcelWorkerTask<ArrayBuffer>({
    request: { type: 'template' },
    fallback: async () => {
      const handler = await import('./excelHandler');
      return handler.buildExcelTemplate(onStage, signal);
    },
    onStage,
    signal,
  });
  throwIfAborted(signal);
  saveWorkbook(buffer, '条码_二维码导入模版.xlsx');
}

export async function exportExcelWithQRImages(
  file: File,
  rowsData: QrRowData[],
  config: QrConfig,
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal,
  onStage?: (stage: ExcelTaskStage) => void,
): Promise<BatchExportResult> {
  onStage?.('reading');
  const fileBuffer = await readFileBuffer(file, signal);
  throwIfAborted(signal);

  const output = await runExcelWorkerTask<BuiltExcelExport>({
    request: {
      type: 'export',
      fileName: file.name,
      fileBuffer,
      rowsData,
      config,
    },
    fallback: async () => {
      const handler = await import('./excelHandler');
      return handler.buildExcelWithQRImages(
        file,
        rowsData,
        config,
        onProgress,
        signal,
        onStage,
      );
    },
    onStage,
    onProgress,
    signal,
    requiresOffscreenCanvas: true,
  });
  throwIfAborted(signal);

  const label = config.codeMode === 'barcode' ? '条形码' : '二维码';
  saveWorkbook(output.buffer, `批量${label}导出_${Date.now()}.xlsx`);
  return output.result;
}
