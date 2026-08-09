import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload, FolderArchive, RefreshCw, Layers, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { QrConfig, QrRowData } from '../types';
import { QrPreviewGrid } from './QrPreviewGrid';
import { MAX_IMPORT_ROWS, MAX_XLSX_FILE_SIZE } from '../utils/batchLimits';
import type { ExcelTaskStage } from '../utils/excelHandler';

interface BatchExcelTabProps {
  config: QrConfig;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '发生未知错误';
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function getExcelStageText(stage: ExcelTaskStage): string {
  switch (stage) {
    case 'reading': return '正在读取 Excel 文件...';
    case 'validating': return '正在检查 Excel 文件安全性...';
    case 'loading': return '正在后台加载工作簿...';
    case 'parsing': return '正在后台识别工作表和数据列...';
    case 'creating': return '正在后台创建 Excel 模板...';
    case 'rendering': return '正在后台生成码图并写入工作表...';
    case 'serializing': return '正在后台生成最终 Excel 文件...';
    default: return '正在后台处理 Excel...';
  }
}

export const BatchExcelTab: React.FC<BatchExcelTabProps> = ({ config }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rows, setRows] = useState<QrRowData[]>([]);
  const [inputTextCol, setInputTextCol] = useState<string>('');
  const [worksheetName, setWorksheetName] = useState<string>('');
  const [headerRowNumber, setHeaderRowNumber] = useState<number>(1);

  const [isLoading, setIsLoading] = useState(false);
  const [progressText, setProgressText] = useState<string>('');
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  const isBarcode = config.codeMode === 'barcode';
  const effectiveRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        extraText: row.extraText || config.extraText,
      })),
    [config.extraText, rows],
  );

  // 文件上传解析
  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setSelectedFile(null);
      setRows([]);
      setInputTextCol('');
      setWorksheetName('');
      setHeaderRowNumber(1);
      setStatusMessage({ type: 'error', msg: '请选择 .xlsx 文件；旧版 .xls 暂不支持。' });
      return;
    }

    if (file.size > MAX_XLSX_FILE_SIZE) {
      setSelectedFile(null);
      setRows([]);
      setInputTextCol('');
      setWorksheetName('');
      setHeaderRowNumber(1);
      setStatusMessage({ type: 'error', msg: '文件超过 25MB，请拆分后再导入。' });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);
    setProgressText('正在安全解析 Excel 文件...');
    setProgress(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const { parseExcelFile } = await import('../utils/excelClient');
      const res = await parseExcelFile(
        file,
        (stage) => setProgressText(getExcelStageText(stage)),
        controller.signal,
      );
      if (res.rows.length === 0) {
        throw new Error('没有找到可生成码图的有效数据行');
      }
      if (res.rows.length > MAX_IMPORT_ROWS) {
        throw new Error(`检测到 ${res.rows.length} 行数据，单次最多支持 ${MAX_IMPORT_ROWS} 行，请拆分文件`);
      }
      setSelectedFile(file);
      setRows(res.rows);
      setInputTextCol(res.inputTextCol);
      setWorksheetName(res.worksheetName);
      setHeaderRowNumber(res.headerRowNumber);
      const ignoredColumnMessage = res.ignoredShowInputCol
        ? `\n已忽略 Excel 中的“${res.ignoredShowInputCol}”列，显示规则以页面开关为准。`
        : '';
      setStatusMessage({
        type: 'success',
        msg: `成功读取 ${res.rows.length} 条数据记录${ignoredColumnMessage}`,
      });
    } catch (err: unknown) {
      if (isAbortError(err)) {
        setStatusMessage({ type: 'info', msg: '已取消 Excel 解析。' });
      } else {
        console.error(err);
        setSelectedFile(null);
        setRows([]);
        setInputTextCol('');
        setWorksheetName('');
        setHeaderRowNumber(1);
        setStatusMessage({ type: 'error', msg: `解析 Excel 失败：${getErrorMessage(err)}` });
      }
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setIsLoading(false);
      setProgressText('');
    }
  };

  // 处理拖拽
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isLoading && e.dataTransfer.files && e.dataTransfer.files[0]) {
      void handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadTemplate = async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    setStatusMessage(null);
    setProgressText('正在生成 Excel 模板...');
    try {
      const { downloadExcelTemplate } = await import('../utils/excelClient');
      await downloadExcelTemplate(
        (stage) => setProgressText(getExcelStageText(stage)),
        controller.signal,
      );
      setStatusMessage({ type: 'success', msg: 'Excel 模板已开始下载。' });
    } catch (err: unknown) {
      if (isAbortError(err)) {
        setStatusMessage({ type: 'info', msg: '已取消 Excel 模板生成。' });
      } else {
        setStatusMessage({ type: 'error', msg: `模板生成失败：${getErrorMessage(err)}` });
      }
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setIsLoading(false);
      setProgressText('');
    }
  };

  // 1. 导出嵌入二维码/条码的 Excel 文件
  const handleExportExcel = async () => {
    if (!selectedFile || rows.length === 0) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    setStatusMessage(null);
    setProgress({ current: 0, total: rows.length });
    const label = isBarcode ? '条码图片' : '二维码图片';
    setProgressText(`正在生成合成${label}并插入 Excel 单元格...`);
    try {
      const { exportExcelWithQRImages } = await import('../utils/excelClient');
      const result = await exportExcelWithQRImages(
        selectedFile,
        effectiveRows,
        config,
        (current, total) => {
          setProgress({ current, total });
          setProgressText(`处理中 (${current}/${total})...`);
        },
        controller.signal,
        (stage) => setProgressText(getExcelStageText(stage)),
      );
      const skippedMessage = result.errors.length > 0
        ? `，另有 ${result.errors.length} 行失败，错误原因已写入导出表格`
        : '';
      setStatusMessage({
        type: 'success',
        msg: `成功导出 ${result.exportedCount} 张${label}${skippedMessage}。`,
      });
    } catch (err: unknown) {
      if (isAbortError(err)) {
        setStatusMessage({ type: 'info', msg: '已取消 Excel 导出，未下载不完整文件。' });
      } else {
        console.error(err);
        setStatusMessage({ type: 'error', msg: `导出 Excel 失败：${getErrorMessage(err)}` });
      }
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setIsLoading(false);
      setProgressText('');
      setProgress(null);
    }
  };

  // 2. 导出图片 ZIP 包
  const handleExportZip = async () => {
    if (rows.length === 0) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    setStatusMessage(null);
    setProgress({ current: 0, total: rows.length });
    setProgressText('正在打包码图 ZIP 压缩包...');
    try {
      const { downloadImagesZip } = await import('../utils/excelHandler');
      const result = await downloadImagesZip(
        effectiveRows,
        config,
        (current, total) => {
          setProgress({ current, total });
          setProgressText(`打包中 (${current}/${total})...`);
        },
        controller.signal,
      );
      const skippedMessage = result.errors.length > 0
        ? `，${result.errors.length} 行失败记录已包含在压缩包中`
        : '';
      setStatusMessage({
        type: 'success',
        msg: `已打包 ${result.exportedCount} 张码图${skippedMessage}。`,
      });
    } catch (err: unknown) {
      if (isAbortError(err)) {
        setStatusMessage({ type: 'info', msg: '已取消 ZIP 打包，未下载不完整文件。' });
      } else {
        console.error(err);
        setStatusMessage({ type: 'error', msg: `打包下载失败：${getErrorMessage(err)}` });
      }
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setIsLoading(false);
      setProgressText('');
      setProgress(null);
    }
  };

  const handleCancel = () => {
    if (!abortControllerRef.current) return;
    setProgressText('正在取消当前任务...');
    abortControllerRef.current.abort();
  };

  return (
    <div className="space-y-8">
      {/* 顶部模版下载与上传区域 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 规范模版下载 */}
        <section className="bg-gradient-to-br from-indigo-50/80 to-blue-50/50 rounded-2xl border border-indigo-100 p-6 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-indigo-700 font-semibold text-base mb-2">
              <FileSpreadsheet className="w-5 h-5" />
              下载 Excel 标准模版
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              包含“输入文本”和“附加内容”标准字段；是否显示原输入文本，由页面“显示输入文本”开关统一控制。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleDownloadTemplate()}
            disabled={isLoading}
            className="min-h-11 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-colors cursor-pointer w-full"
          >
            <Download className="w-4 h-4" />
            下载 Excel 模板文件 (.xlsx)
          </button>
        </section>

        {/* Excel 上传拖拽框 */}
        <label
          htmlFor="excel-file-upload"
          className="md:col-span-2 min-h-44 bg-white rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-400 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15 transition-colors p-6 flex flex-col items-center justify-center text-center cursor-pointer relative"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          aria-busy={isLoading}
        >
          <input
            id="excel-file-upload"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={isLoading}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) void handleFileUpload(file);
              e.currentTarget.value = '';
            }}
            className="sr-only"
          />
          <div className="bg-indigo-50 p-3 rounded-full text-indigo-600 mb-3">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            {isLoading ? '正在处理文件，请稍候…' : selectedFile ? selectedFile.name : '拖拽 Excel 文件到此处，或点击选择上传'}
          </p>
          <p className="text-xs text-slate-600 mt-1">仅支持 .xlsx，最大 25MB / 2000 行</p>
        </label>
      </div>

      {isLoading && progressText && rows.length === 0 && (
        <div role="status" aria-live="polite" className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center gap-3 text-sm text-indigo-800">
          <RefreshCw className="w-4 h-4 animate-spin motion-reduce:animate-none" />
          <span className="flex-1">{progressText}</span>
          {abortControllerRef.current && (
            <button
              type="button"
              onClick={handleCancel}
              className="min-h-11 rounded-lg border border-indigo-200 bg-white px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              取消任务
            </button>
          )}
        </div>
      )}

      {/* 提示消息 */}
      {statusMessage && (
        <div
          role={statusMessage.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`max-h-52 overflow-y-auto whitespace-pre-line break-words p-4 rounded-xl border flex items-start gap-2.5 text-sm font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : statusMessage.type === 'info'
                ? 'bg-blue-50 text-blue-800 border-blue-200'
                : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : statusMessage.type === 'info' ? (
            <XCircle className="w-4 h-4 text-blue-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          {statusMessage.msg}
        </div>
      )}

      {/* 导入预览与核心导出操作区域 */}
      {rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-semibold text-slate-800 text-base">
                  数据记录预览与【{isBarcode ? `一维条码 - ${config.barcodeFormat}` : '二维码'}】排版预览
                </h3>
                <p className="text-xs text-slate-600">
                  已识别 {rows.length} 行数据 · 工作表：[{worksheetName}] · 表头第 {headerRowNumber} 行 · 主列：[{inputTextCol}]
                </p>
              </div>
            </div>

            {/* 操作导出按钮 */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                  onClick={handleExportExcel}
                  disabled={isLoading}
                  className="min-h-11 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-indigo-100 transition-colors cursor-pointer"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin motion-reduce:animate-none" /> : <FileSpreadsheet className="w-4 h-4" />}
                导出包含{isBarcode ? '条形码' : '二维码'}的 Excel
              </button>

              <button
                  onClick={handleExportZip}
                  disabled={isLoading}
                  className="min-h-11 flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 px-4 rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin motion-reduce:animate-none" /> : <FolderArchive className="w-4 h-4" />}
                打包下载所有图片 (.zip)
              </button>
            </div>
          </div>

          {/* 进度提示 */}
          {isLoading && progressText && (
            <div role="status" aria-live="polite" className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl space-y-2 text-sm text-indigo-800">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-4 h-4 animate-spin motion-reduce:animate-none" />
                <span className="flex-1">{progressText}</span>
                {abortControllerRef.current && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="min-h-11 rounded-lg border border-indigo-200 bg-white px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    取消任务
                  </button>
                )}
              </div>
              {progress && progress.total > 0 && (
                <progress
                  value={progress.current}
                  max={progress.total}
                  aria-label={`处理进度 ${progress.current}/${progress.total}`}
                  className="block w-full h-2 accent-indigo-600"
                />
              )}
            </div>
          )}

          {/* 码图预览网格 */}
          <QrPreviewGrid rows={effectiveRows} config={config} />
        </div>
      )}
    </div>
  );
};
