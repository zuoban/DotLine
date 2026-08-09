/// <reference lib="webworker" />

import { QrConfig, QrRowData } from '../types';
import { generateCompositeCode } from './canvasRenderer';
import {
  buildExcelTemplate,
  buildExcelWithQRImages,
  ExcelTaskStage,
  parseExcelFile,
} from './excelHandler';

interface ParseRequest {
  type: 'parse';
  fileName: string;
  fileBuffer: ArrayBuffer;
}

interface TemplateRequest {
  type: 'template';
}

interface ExportRequest {
  type: 'export';
  fileName: string;
  fileBuffer: ArrayBuffer;
  rowsData: QrRowData[];
  config: QrConfig;
}

type ExcelWorkerRequest = ParseRequest | TemplateRequest | ExportRequest;

const workerScope = self as DedicatedWorkerGlobalScope;

function createWorkerFile(fileName: string, fileBuffer: ArrayBuffer): File {
  return {
    name: fileName,
    size: fileBuffer.byteLength,
    arrayBuffer: async () => fileBuffer,
  } as File;
}

function reportStage(stage: ExcelTaskStage): void {
  workerScope.postMessage({ type: 'stage', stage });
}

workerScope.onmessage = async (event: MessageEvent<ExcelWorkerRequest>) => {
  const request = event.data;

  try {
    if (request.type === 'parse') {
      const result = await parseExcelFile(
        createWorkerFile(request.fileName, request.fileBuffer),
        reportStage,
      );
      workerScope.postMessage({ type: 'result', result });
      return;
    }

    if (request.type === 'template') {
      const buffer = await buildExcelTemplate(reportStage);
      workerScope.postMessage({ type: 'result', result: buffer }, [buffer]);
      return;
    }

    const output = await buildExcelWithQRImages(
      createWorkerFile(request.fileName, request.fileBuffer),
      request.rowsData,
      request.config,
      (current, total) => {
        workerScope.postMessage({ type: 'progress', current, total });
      },
      undefined,
      reportStage,
      generateCompositeCode,
    );
    workerScope.postMessage({ type: 'result', result: output }, [output.buffer]);
  } catch (error: unknown) {
    workerScope.postMessage({
      type: 'error',
      message: error instanceof Error && error.message ? error.message : 'Excel 处理失败',
    });
  }
};

export {};
