import React, { useState, useEffect } from 'react';
import { Download, QrCode as QrIcon, Barcode as BarcodeIcon, Copy, Check, AlertCircle } from 'lucide-react';
import { QrConfig } from '../types';
import { generateCompositeCode } from '../utils/canvasRenderer';
import saveAs from 'file-saver';

interface SingleQrTabProps {
  config: QrConfig;
}

function getExampleText(config: QrConfig): string {
  if (config.codeMode === 'qr') return 'https://example.com/product/1001';

  switch (config.barcodeFormat) {
    case 'EAN13':
      return '6901234567892';
    case 'EAN8':
      return '12345670';
    case 'UPC':
      return '123456789012';
    case 'ITF14':
      return '12345678901231';
    case 'MSI':
      return '12345678';
    case 'pharmacode':
      return '12345';
    case 'CODE39':
      return 'DOTLINE-2026';
    case 'CODE128':
    default:
      return 'SN987654321';
  }
}

export const SingleQrTab: React.FC<SingleQrTabProps> = ({ config }) => {
  const [inputText, setInputText] = useState('https://github.com/dotline');
  const [customExtraText, setCustomExtraText] = useState('');

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    setIsGenerating(true);
    setPreviewUrl('');
    setErrorMessage('');
    setActionMessage(null);

    const timer = window.setTimeout(async () => {
      setIsGenerating(true);
      try {
        const extra = customExtraText || config.extraText;
        const res = await generateCompositeCode(inputText, config, config.showInputText, extra);
        if (active) {
          setPreviewUrl(res.dataUrl);
        }
      } catch (err: unknown) {
        if (active) {
          setPreviewUrl('');
          setErrorMessage(err instanceof Error ? err.message : '码图生成失败');
        }
      } finally {
        if (active) setIsGenerating(false);
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [inputText, customExtraText, config]);

  const handleDownload = () => {
    if (!previewUrl) return;
    const prefix = config.codeMode === 'barcode' ? 'barcode' : 'qrcode';
    saveAs(previewUrl, `${prefix}_${Date.now()}.png`);
  };

  const handleCopy = async () => {
    if (!previewUrl) return;
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('当前浏览器不支持复制图片，请使用下载功能');
      }
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopied(true);
      setActionMessage({ type: 'success', text: '图像已复制到剪贴板' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err: unknown) {
      console.error('复制失败', err);
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '复制失败，请改用下载功能',
      });
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
              <label htmlFor="single-code-input" className="block text-sm font-semibold text-slate-700">
                输入生成内容 / 序列号 / 网址 <span className="text-red-500">*</span>
              </label>
              {config.codeMode === 'barcode' && (
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline text-xs text-indigo-700 bg-indigo-50 px-2 py-1 rounded font-mono">
                    {config.barcodeFormat} 标准模式
                  </span>
                  <button
                    type="button"
                    onClick={() => setInputText(getExampleText(config))}
                    className="min-h-11 px-3 text-xs font-semibold text-indigo-700 hover:text-indigo-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg transition-colors"
                  >
                    使用示例
                  </button>
                </div>
              )}
            </div>

            <textarea
              id="single-code-input"
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              required
              maxLength={2048}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? 'single-code-error' : 'single-code-help'}
              placeholder={config.codeMode === 'barcode' ? `请输入规范内容，如 ${getExampleText(config)}` : '请输入生成的文本或 URL'}
              className="w-full min-h-24 px-3.5 py-2.5 text-base sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {errorMessage ? (
              <p id="single-code-error" role="alert" className="mt-2 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : (
              <p id="single-code-help" className="mt-2 text-xs text-slate-600">
                切换码制不会改写当前内容；格式不匹配时会在此提示。
              </p>
            )}
          </div>

          <div className="pt-2">
            <div>
              <label htmlFor="single-extra-text" className="block text-sm font-semibold text-slate-700 mb-1.5">
                自定义附加文本 (覆盖全局)
              </label>
              <input
                id="single-extra-text"
                type="text"
                value={customExtraText}
                onChange={(e) => setCustomExtraText(e.target.value)}
                maxLength={500}
                placeholder={config.extraText || '如：批号 B2026 / 样本说明'}
                className="w-full min-h-11 px-3.5 py-2 text-base sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 右侧实时效果预览 */}
      <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col items-center justify-center space-y-6">
        <h3 className="text-sm font-semibold text-slate-700 self-start">实时渲染预览</h3>

        <div className="bg-slate-100/70 p-6 rounded-2xl border border-slate-200 border-dashed min-h-[260px] w-full flex items-center justify-center">
          {isGenerating ? (
            <div role="status" aria-live="polite" className="text-center text-slate-600 text-sm animate-pulse motion-reduce:animate-none">
              正在更新预览...
            </div>
          ) : errorMessage ? (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-sm flex items-start gap-2 max-w-full">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt={`${config.codeMode === 'barcode' ? '条形码' : '二维码'}预览：${inputText.slice(0, 80)}`}
              className="max-h-[320px] max-w-full object-contain rounded-lg shadow-md bg-white border border-slate-100 p-2"
            />
          ) : (
            <div className="text-center text-slate-600 text-sm">请输入有效内容生成预览</div>
          )}
        </div>

        <div className="flex gap-3 w-full">
          <button
            onClick={handleDownload}
            disabled={!previewUrl || isGenerating}
            className="min-h-11 flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-xl shadow-md shadow-indigo-100 transition-colors text-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            下载图片
          </button>
          <button
            onClick={handleCopy}
            disabled={!previewUrl || isGenerating}
            className="min-h-11 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-medium py-2.5 px-4 rounded-xl transition-colors text-sm cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? '已复制' : '复制图像'}
          </button>
        </div>

        {actionMessage && (
          <p
            role={actionMessage.type === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            className={`w-full text-sm ${actionMessage.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`}
          >
            {actionMessage.text}
          </p>
        )}
      </div>
    </div>
  );
};
