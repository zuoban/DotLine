import React, { useState } from 'react';
import { Download, FileSpreadsheet, Upload, FolderArchive, RefreshCw, Layers, CheckCircle2, AlertCircle } from 'lucide-react';
import { QrConfig, QrRowData } from '../types';
import { downloadExcelTemplate, parseExcelFile, exportExcelWithQRImages, downloadImagesZip } from '../utils/excelHandler';
import { QrPreviewGrid } from './QrPreviewGrid';

interface BatchExcelTabProps {
  config: QrConfig;
}

export const BatchExcelTab: React.FC<BatchExcelTabProps> = ({ config }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rows, setRows] = useState<QrRowData[]>([]);
  const [inputTextCol, setInputTextCol] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [progressText, setProgressText] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const isBarcode = config.codeMode === 'barcode';

  // 文件上传解析
  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await parseExcelFile(file);
      setSelectedFile(file);
      setRows(res.rows);
      setInputTextCol(res.inputTextCol);
      setStatusMessage({ type: 'success', msg: `成功读取 ${res.rows.length} 条数据记录` });
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', msg: `解析 Excel 失败: ${err.message || '格式错误'}` });
    } finally {
      setIsLoading(false);
    }
  };

  // 处理拖拽
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // 1. 导出嵌入二维码/条码的 Excel 文件
  const handleExportExcel = async () => {
    if (!selectedFile || rows.length === 0) return;
    setIsLoading(true);
    const label = isBarcode ? '条码图片' : '二维码图片';
    setProgressText(`正在生成合成${label}并插入 Excel 单元格...`);
    try {
      await exportExcelWithQRImages(selectedFile, rows, config, (current, total) => {
        setProgressText(`处理中 (${current}/${total})...`);
      });
      setStatusMessage({ type: 'success', msg: `成功导出包含嵌入${label}的 Excel 表格！` });
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', msg: `导出 Excel 失败: ${err.message}` });
    } finally {
      setIsLoading(false);
      setProgressText('');
    }
  };

  // 2. 导出图片 ZIP 包
  const handleExportZip = async () => {
    if (rows.length === 0) return;
    setIsLoading(true);
    setProgressText('正在打包码图 ZIP 压缩包...');
    try {
      await downloadImagesZip(rows, config, (current, total) => {
        setProgressText(`打包中 (${current}/${total})...`);
      });
      setStatusMessage({ type: 'success', msg: '批量图片压缩包下载成功！' });
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', msg: `打包下载失败: ${err.message}` });
    } finally {
      setIsLoading(false);
      setProgressText('');
    }
  };

  return (
    <div className="space-y-8">
      {/* 顶部模版下载与上传区域 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 规范模版下载 */}
        <div className="bg-gradient-to-br from-indigo-50/80 to-blue-50/50 rounded-2xl border border-indigo-100 p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-700 font-semibold text-base mb-2">
              <FileSpreadsheet className="w-5 h-5" />
              下载 Excel 标准模版
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              包含“输入文本”、“显示输入文本”、“附加内容”标准字段，可用于批量导入生成条形码或二维码。
            </p>
          </div>
          <button
            onClick={downloadExcelTemplate}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-all cursor-pointer w-full"
          >
            <Download className="w-4 h-4" />
            下载 Excel 模板文件 (.xlsx)
          </button>
        </div>

        {/* Excel 上传拖拽框 */}
        <div className="md:col-span-2 bg-white rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-400 transition-all p-6 flex flex-col items-center justify-center text-center cursor-pointer relative"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          <div className="bg-indigo-50 p-3 rounded-full text-indigo-600 mb-3">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            {selectedFile ? selectedFile.name : '拖拽 Excel 文件到此处，或点击选择上传'}
          </p>
          <p className="text-xs text-slate-400 mt-1">支持 .xlsx / .xls 格式</p>
        </div>
      </div>

      {/* 提示消息 */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border flex items-center gap-2.5 text-xs font-medium ${
          statusMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
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
                <p className="text-xs text-slate-500">已识别 {rows.length} 行数据，内容读取主列：[{inputTextCol}]</p>
              </div>
            </div>

            {/* 操作导出按钮 */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleExportExcel}
                disabled={isLoading}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-indigo-100 transition-all cursor-pointer"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                导出包含{isBarcode ? '条形码' : '二维码'}的 Excel
              </button>

              <button
                onClick={handleExportZip}
                disabled={isLoading}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-md transition-all cursor-pointer"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FolderArchive className="w-4 h-4" />}
                打包下载所有图片 (.zip)
              </button>
            </div>
          </div>

          {/* 进度提示 */}
          {isLoading && progressText && (
            <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center gap-3 text-xs text-indigo-700">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{progressText}</span>
            </div>
          )}

          {/* 码图预览网格 */}
          <QrPreviewGrid rows={rows} config={config} />
        </div>
      )}
    </div>
  );
};
