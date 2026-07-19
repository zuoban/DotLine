import React, { useEffect, useState } from 'react';
import { QrConfig, QrRowData } from '../types';
import { generateCompositeCode } from '../utils/canvasRenderer';

interface QrPreviewGridProps {
  rows: QrRowData[];
  config: QrConfig;
}

export const QrPreviewGrid: React.FC<QrPreviewGridProps> = ({ rows, config }) => {
  const [renderedRows, setRenderedRows] = useState<QrRowData[]>([]);

  useEffect(() => {
    let isCancelled = false;

    async function renderAll() {
      const updated = await Promise.all(
        rows.slice(0, 48).map(async (row) => {
          try {
            const res = await generateCompositeCode(
              row.inputText,
              config,
              row.showInputText,
              row.extraText
            );
            return {
              ...row,
              dataUrl: res.dataUrl,
              aspectRatio: res.width / res.height,
              status: 'success' as const,
            };
          } catch (e: any) {
            return {
              ...row,
              status: 'error' as const,
              errorMessage: e.message || '格式错误',
            };
          }
        })
      );
      if (!isCancelled) {
        setRenderedRows(updated);
      }
    }

    renderAll();

    return () => {
      isCancelled = true;
    };
  }, [rows, config]);

  const isBarcode = config.codeMode === 'barcode';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          预览前 {Math.min(rows.length, 48)} 条生成的{isBarcode ? '条形形码' : '二维码'}
        </span>
        {rows.length > 48 && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            预览前48条，完整导出将包含全部 {rows.length} 条数据
          </span>
        )}
      </div>

      <div className={`grid gap-4 ${
        isBarcode
          ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
          : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
      }`}>
        {renderedRows.map((item, index) => (
          <div
            key={item.id || index}
            className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col items-center justify-between hover:shadow-md hover:border-indigo-200 transition-all group"
          >
            <div className="w-full flex justify-center bg-white p-2 rounded-lg border border-slate-100 mb-2 min-h-[110px] items-center">
              {item.status === 'error' ? (
                <div className="text-[11px] text-red-500 bg-red-50 p-2 rounded text-center">
                  {item.errorMessage || '无法生成条码'}
                </div>
              ) : item.dataUrl ? (
                <img
                  src={item.dataUrl}
                  alt={`Code ${index + 1}`}
                  className="max-h-[130px] w-auto object-contain"
                />
              ) : (
                <div className="text-[11px] text-slate-400">渲染中...</div>
              )}
            </div>
            <div className="w-full text-center">
              <p className="text-[11px] font-medium text-slate-700 truncate" title={item.inputText}>
                {item.inputText}
              </p>
              {item.extraText && (
                <p className="text-[10px] text-slate-400 truncate" title={item.extraText}>
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
