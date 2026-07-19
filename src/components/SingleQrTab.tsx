import React, { useState, useEffect } from 'react';
import { Download, QrCode as QrIcon, Barcode as BarcodeIcon, Copy, Check, AlertCircle } from 'lucide-react';
import { QrConfig } from '../types';
import { generateCompositeCode } from '../utils/canvasRenderer';
import saveAs from 'file-saver';

interface SingleQrTabProps {
  config: QrConfig;
}

export const SingleQrTab: React.FC<SingleQrTabProps> = ({ config }) => {
  const [inputText, setInputText] = useState('6901234567890');
  const [customExtraText, setCustomExtraText] = useState('');
  const [showInputText, setShowInputText] = useState(true);

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // 当格式或输入切换时重置适宜示例数据
  useEffect(() => {
    if (config.codeMode === 'barcode') {
      if (config.barcodeFormat === 'EAN13' && !/^\d{12,13}$/.test(inputText)) {
        setInputText('6901234567890');
      } else if (config.barcodeFormat === 'EAN8' && !/^\d{7,8}$/.test(inputText)) {
        setInputText('12345670');
      } else if (config.barcodeFormat === 'UPC' && !/^\d{11,12}$/.test(inputText)) {
        setInputText('123456789012');
      } else if (inputText.startsWith('http')) {
        setInputText('SN987654321');
      }
    } else {
      if (inputText === '6901234567890' || inputText === 'SN987654321') {
        setInputText('https://github.com/dotline');
      }
    }
  }, [config.codeMode, config.barcodeFormat]);

  useEffect(() => {
    let active = true;
    async function updatePreview() {
      setIsGenerating(true);
      setErrorMessage('');
      try {
        const extra = customExtraText || config.extraText;
        const res = await generateCompositeCode(inputText, config, showInputText, extra);
        if (active) {
          setPreviewUrl(res.dataUrl);
        }
      } catch (err: any) {
        if (active) {
          setPreviewUrl('');
          setErrorMessage(err.message || '码图生成失败');
        }
      } finally {
        if (active) setIsGenerating(false);
      }
    }
    updatePreview();
    return () => {
      active = false;
    };
  }, [inputText, customExtraText, showInputText, config]);

  const handleDownload = () => {
    if (!previewUrl) return;
    const prefix = config.codeMode === 'barcode' ? 'barcode' : 'qrcode';
    saveAs(previewUrl, `${prefix}_${Date.now()}.png`);
  };

  const handleCopy = async () => {
    if (!previewUrl) return;
    try {
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败', err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* 左侧输入控制 */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          {config.codeMode === 'barcode' ? (
            <BarcodeIcon className="w-5 h-5 text-indigo-600" />
          ) : (
            <QrIcon className="w-5 h-5 text-indigo-600" />
          )}
          <h2 className="font-semibold text-slate-800 text-base">
            {config.codeMode === 'barcode' ? `单条一维码格式选择与生成 [${config.barcodeFormat}]` : '单个二维码生成参数'}
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                输入生成内容 / 序列号 / 网址 <span className="text-red-500">*</span>
              </label>
              {config.codeMode === 'barcode' && (
                <span className="text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-mono">
                  {config.barcodeFormat} 标准模式
                </span>
              )}
            </div>

            <textarea
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={config.codeMode === 'barcode' ? '请输入数字或规范字符，如 6901234567890' : '请输入生成的文本或 URL'}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                自定义附加文本 (覆盖全局)
              </label>
              <input
                type="text"
                value={customExtraText}
                onChange={(e) => setCustomExtraText(e.target.value)}
                placeholder={config.extraText || '如：批号 B2026 / 样本说明'}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl w-full">
                <input
                  type="checkbox"
                  checked={showInputText}
                  onChange={(e) => setShowInputText(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-xs font-medium text-slate-700">显示下方输入原文本</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧实时效果预览 */}
      <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col items-center justify-center space-y-6">
        <h3 className="text-sm font-semibold text-slate-700 self-start">实时渲染预览</h3>

        <div className="bg-slate-100/70 p-6 rounded-2xl border border-slate-200 border-dashed min-h-[260px] w-full flex items-center justify-center">
          {isGenerating ? (
            <div className="text-center text-slate-400 text-xs animate-pulse">渲染中...</div>
          ) : errorMessage ? (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-xs flex items-start gap-2 max-w-full">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="max-h-[320px] max-w-full object-contain rounded-lg shadow-md bg-white border border-slate-100 p-2"
            />
          ) : (
            <div className="text-center text-slate-400 text-xs">请输入有效内容生成预览</div>
          )}
        </div>

        <div className="flex gap-3 w-full">
          <button
            onClick={handleDownload}
            disabled={!previewUrl}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl shadow-md shadow-indigo-100 transition-all text-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            下载图片
          </button>
          <button
            onClick={handleCopy}
            disabled={!previewUrl}
            className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-medium py-2.5 px-4 rounded-xl transition-all text-sm cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? '已复制' : '复制图像'}
          </button>
        </div>
      </div>
    </div>
  );
};
