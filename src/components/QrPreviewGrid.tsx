import React, { useEffect, useRef, useState } from 'react';
import { QrConfig, QrRowData } from '../types';
import { generateCompositeCode } from '../utils/canvasRenderer';

interface QrPreviewGridProps {
  rows: QrRowData[];
  config: QrConfig;
}

const PREVIEW_LIMIT = 48;
const PREVIEW_DEBOUNCE_MS = 160;
const MAX_RENDER_CONCURRENCY = 3;

function createPendingRows(rows: QrRowData[]): QrRowData[] {
  return rows.slice(0, PREVIEW_LIMIT).map((row) => ({
    ...row,
    status: 'pending',
    dataUrl: undefined,
    aspectRatio: undefined,
    errorMessage: undefined,
  }));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return '格式错误，请检查输入内容。';
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

export const QrPreviewGrid: React.FC<QrPreviewGridProps> = ({ rows, config }) => {
  const [renderedRows, setRenderedRows] = useState<QrRowData[]>(() => createPendingRows(rows));
  const [isRendering, setIsRendering] = useState(rows.length > 0);
  const renderVersionRef = useRef(0);

  useEffect(() => {
    const version = renderVersionRef.current + 1;
    renderVersionRef.current = version;
    setIsRendering(rows.length > 0);

    const debounceTimer = window.setTimeout(() => {
      if (renderVersionRef.current !== version) return;

      const pendingRows = createPendingRows(rows);
      const previewConfig: QrConfig = { ...config, scale: 1 };
      setRenderedRows(pendingRows);

      if (pendingRows.length === 0) {
        setIsRendering(false);
        return;
      }

      let nextIndex = 0;
      let completedCount = 0;

      async function renderNext(): Promise<void> {
        while (renderVersionRef.current === version) {
          const index = nextIndex;
          nextIndex += 1;
          if (index >= pendingRows.length) return;

          const row = pendingRows[index];
          let renderedRow: QrRowData;
          try {
            const res = await generateCompositeCode(
              row.inputText,
              previewConfig,
              config.showInputText,
              row.extraText
            );
            renderedRow = {
              ...row,
              dataUrl: res.dataUrl,
              aspectRatio: res.width / res.height,
              status: 'success',
            };
          } catch (error: unknown) {
            renderedRow = {
              ...row,
              status: 'error',
              errorMessage: getErrorMessage(error),
            };
          }

          if (renderVersionRef.current !== version) return;

          setRenderedRows((currentRows) => {
            if (
              renderVersionRef.current !== version ||
              currentRows.length !== pendingRows.length
            ) {
              return currentRows;
            }
            const updatedRows = [...currentRows];
            updatedRows[index] = renderedRow;
            return updatedRows;
          });

          completedCount += 1;
          if (completedCount === pendingRows.length) {
            setIsRendering(false);
            return;
          }

          // 让浏览器有机会绘制已完成的卡片，再继续下一项。
          await yieldToBrowser();
          if (renderVersionRef.current !== version) return;
        }
      }

      const workerCount = Math.min(MAX_RENDER_CONCURRENCY, pendingRows.length);
      for (let workerIndex = 0; workerIndex < workerCount; workerIndex += 1) {
        void renderNext();
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(debounceTimer);
      if (renderVersionRef.current === version) {
        renderVersionRef.current += 1;
      }
    };
  }, [rows, config]);

  const isBarcode = config.codeMode === 'barcode';
  const previewCount = Math.min(rows.length, PREVIEW_LIMIT);
  const pendingCount = renderedRows.filter((item) => item.status === 'pending').length;
  const errorCount = renderedRows.filter((item) => item.status === 'error').length;
  const completedCount = renderedRows.length - pendingCount;

  let progressMessage = '暂无可预览的数据。';
  if (previewCount > 0 && isRendering) {
    progressMessage =
      renderedRows.length === previewCount && pendingCount > 0
        ? `正在生成预览，已完成 ${completedCount}/${previewCount} 条。`
        : '正在更新预览设置…';
  } else if (previewCount > 0 && errorCount > 0) {
    progressMessage = `预览完成，其中 ${errorCount} 条生成失败，请检查对应卡片的错误信息。`;
  } else if (previewCount > 0) {
    progressMessage = `预览生成完成，共 ${previewCount} 条。`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs text-slate-500">
            预览前 {previewCount} 条生成的{isBarcode ? '条形码' : '二维码'}
          </span>
          <p
            className={`mt-1 text-xs ${errorCount > 0 && !isRendering ? 'text-red-600' : 'text-slate-500'}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {progressMessage}
          </p>
        </div>
        {rows.length > PREVIEW_LIMIT && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            预览前{PREVIEW_LIMIT}条，完整导出将包含全部 {rows.length} 条数据
          </span>
        )}
      </div>

      <div
        className={`grid gap-4 ${
          isBarcode
            ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
            : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
        }`}
        aria-busy={isRendering}
      >
        {renderedRows.map((item, index) => (
          <div
            key={item.id || index}
            className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col items-center justify-between hover:shadow-md hover:border-indigo-200 transition-all group"
          >
            <div className="w-full flex justify-center bg-white p-2 rounded-lg border border-slate-100 mb-2 min-h-[110px] items-center">
              {item.status === 'error' ? (
                <div className="text-[11px] text-red-600 bg-red-50 p-2 rounded text-center">
                  生成失败：{item.errorMessage || `无法生成${isBarcode ? '条形码' : '二维码'}`}
                </div>
              ) : item.dataUrl ? (
                <img
                  src={item.dataUrl}
                  alt={`第 ${index + 1} 个${isBarcode ? '条形码' : '二维码'}预览`}
                  className="max-h-[130px] w-auto object-contain"
                />
              ) : (
                <div className="text-[11px] text-slate-500">正在生成预览…</div>
              )}
            </div>
            <div className="w-full text-center">
              <p className="text-[11px] font-medium text-slate-700 truncate" title={item.inputText}>
                {item.inputText}
              </p>
              {item.extraText && (
                <p className="truncate text-xs text-slate-600" title={item.extraText}>
                  {item.extraText}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
