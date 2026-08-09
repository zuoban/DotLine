import React from 'react';
import {
  Barcode as BarcodeIcon,
  Crop,
  Maximize2,
  QrCode as QrIcon,
  RotateCcw,
  Settings2,
  Sliders,
  Sparkles,
  Type,
} from 'lucide-react';
import { AspectRatioOption, BarcodeFormat, QrConfig } from '../types';

interface ConfigPanelProps {
  config: QrConfig;
  onChange: (newConfig: QrConfig) => void;
  onReset: () => void;
}

const BARCODE_FORMATS: { label: string; value: BarcodeFormat; desc: string }[] = [
  { label: 'CODE128 (通用)', value: 'CODE128', desc: '支持任意 ASCII 字符、数字和字母' },
  { label: 'EAN13 (商品码)', value: 'EAN13', desc: '用于零售商品，必须为 12 或 13 位纯数字' },
  { label: 'CODE39 (标准码)', value: 'CODE39', desc: '大写字母、数字及常见特殊符号' },
  { label: 'EAN8 (短商品码)', value: 'EAN8', desc: '短包装商品，必须为 7 或 8 位纯数字' },
  { label: 'UPC (美规码)', value: 'UPC', desc: '北美零售通用，11 或 12 位纯数字' },
  { label: 'ITF14 (物流码)', value: 'ITF14', desc: '交错二五码，用于外箱，14位数字' },
  { label: 'MSI', value: 'MSI', desc: '仓库货架标识，纯数字' },
  { label: 'Pharmacode', value: 'pharmacode', desc: '医药包装专用码' },
];

const ASPECT_RATIOS: { label: string; value: AspectRatioOption }[] = [
  { label: '自动自适应', value: 'auto' },
  { label: '1:1 (正方形)', value: '1:1' },
  { label: '4:3 (标准图)', value: '4:3' },
  { label: '3:2 (照片图)', value: '3:2' },
  { label: '16:9 (宽屏图)', value: '16:9' },
  { label: '9:16 (长图)', value: '9:16' },
  { label: '自定义比例', value: 'custom' },
];

const SCALE_OPTIONS: { label: string; value: number; desc: string }[] = [
  { label: '1x 标准', value: 1, desc: '普通分辨率 (~300px)' },
  { label: '2x 高清', value: 2, desc: '视网膜/2K (~600px)' },
  { label: '3x 超清', value: 3, desc: '4K画质 (~1000px)' },
  { label: '4x 印刷高清', value: 4, desc: '高像素印刷用途 (~1400px)' },
];

const optionButtonClass =
  'min-h-11 rounded-xl border text-center text-xs font-medium transition-[color,background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 motion-reduce:transition-none';
const rangeInputClass =
  'h-11 w-full cursor-pointer rounded accent-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1';
const textInputClass =
  'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500';
const colorInputClass =
  'h-11 w-11 cursor-pointer rounded-lg border border-slate-200 p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1';

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onChange, onReset }) => {
  const updateField = <K extends keyof QrConfig>(field: K, value: QrConfig[K]) => {
    onChange({ ...config, [field]: value });
  };

  const activeBarcodeFormat = BARCODE_FORMATS.find((format) => format.value === config.barcodeFormat);

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Settings2 className="h-5 w-5 shrink-0 text-indigo-600" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 text-base font-semibold text-slate-800">样式与码制类型设置</h2>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          恢复默认
        </button>
      </div>

      <fieldset className="min-w-0 space-y-2">
        <legend className="text-xs font-semibold text-slate-700">选择编码模式</legend>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            aria-pressed={config.codeMode === 'qr'}
            onClick={() => updateField('codeMode', 'qr')}
            className={`${optionButtonClass} flex items-center justify-center gap-2 px-2 ${
              config.codeMode === 'qr'
                ? 'border-transparent bg-white font-semibold text-indigo-600 shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>二维码 <span className="hidden sm:inline">(QR Code)</span></span>
          </button>

          <button
            type="button"
            aria-pressed={config.codeMode === 'barcode'}
            onClick={() => updateField('codeMode', 'barcode')}
            className={`${optionButtonClass} flex items-center justify-center gap-2 px-2 ${
              config.codeMode === 'barcode'
                ? 'border-transparent bg-white font-semibold text-indigo-600 shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarcodeIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>一维条码 <span className="hidden sm:inline">(Barcode)</span></span>
          </button>
        </div>
      </fieldset>

      <div className="border-t border-slate-100 pt-4">
        <fieldset className="min-w-0 space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              输出图片清晰度 (HD Scale)
            </span>
          </legend>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SCALE_OPTIONS.map((option) => {
              const isSelected = (config.scale || 2) === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => updateField('scale', option.value)}
                  className={`${optionButtonClass} flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-2 py-2 ${
                    isSelected
                      ? 'border-indigo-200 bg-indigo-50 font-semibold text-indigo-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{option.label}</span>
                  <span className="text-[11px] font-normal leading-tight">{option.desc}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <fieldset className="min-w-0 space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
              {config.codeMode === 'barcode' ? '一维条码属性' : '二维码属性'}
            </span>
          </legend>

          {config.codeMode === 'barcode' ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="config-barcode-format" className="mb-1 block text-xs font-medium text-slate-700">
                  条码编码标准
                </label>
                <select
                  id="config-barcode-format"
                  value={config.barcodeFormat}
                  aria-describedby="config-barcode-format-description"
                  onChange={(event) => updateField('barcodeFormat', event.target.value as BarcodeFormat)}
                  className={textInputClass}
                >
                  {BARCODE_FORMATS.map((format) => (
                    <option key={format.value} value={format.value}>
                      {format.label}
                    </option>
                  ))}
                </select>
                <p id="config-barcode-format-description" className="mt-1 text-[11px] leading-4 text-slate-500">
                  {activeBarcodeFormat?.desc}
                </p>
              </div>

              <label
                htmlFor="config-auto-width-barcode"
                className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Maximize2 className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
                  <span>
                    <span className="block text-xs font-semibold text-slate-800">条码宽度自适应拉长</span>
                    <span className="block text-[11px] leading-4 text-slate-600">自动扩展条码填满卡片可用宽度</span>
                  </span>
                </span>
                <span className="flex min-h-11 min-w-11 shrink-0 items-center justify-center">
                  <input
                    id="config-auto-width-barcode"
                    type="checkbox"
                    role="switch"
                    checked={config.autoWidthBarcode}
                    onChange={(event) => updateField('autoWidthBarcode', event.target.checked)}
                    className="h-5 w-5 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </span>
              </label>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4">
                <div>
                  <label htmlFor="config-barcode-width" className="block text-xs font-medium text-slate-700">
                    基准线宽 ({config.barcodeWidth}px)
                  </label>
                  <input
                    id="config-barcode-width"
                    type="range"
                    min="1"
                    max="4"
                    step="1"
                    value={config.barcodeWidth}
                    onChange={(event) => updateField('barcodeWidth', Number(event.target.value))}
                    className={rangeInputClass}
                  />
                </div>

                <div>
                  <label htmlFor="config-barcode-height" className="block text-xs font-medium text-slate-700">
                    条码高度 ({config.barcodeHeight}px)
                  </label>
                  <input
                    id="config-barcode-height"
                    type="range"
                    min="40"
                    max="160"
                    step="5"
                    value={config.barcodeHeight}
                    onChange={(event) => updateField('barcodeHeight', Number(event.target.value))}
                    className={rangeInputClass}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4">
              <div>
                <label htmlFor="config-qr-size" className="block text-xs font-medium text-slate-700">
                  二维码尺寸 ({config.qrSize}px)
                </label>
                <input
                  id="config-qr-size"
                  type="range"
                  min="120"
                  max="400"
                  step="10"
                  value={config.qrSize}
                  onChange={(event) => updateField('qrSize', Number(event.target.value))}
                  className={rangeInputClass}
                />
              </div>

              <div>
                <label htmlFor="config-qr-margin" className="block text-xs font-medium text-slate-700">
                  内边距 ({config.margin})
                </label>
                <input
                  id="config-qr-margin"
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={config.margin}
                  aria-describedby="config-qr-margin-help"
                  onChange={(event) => updateField('margin', Number(event.target.value))}
                  className={rangeInputClass}
                />
                <p id="config-qr-margin-help" className="mt-1 text-[11px] leading-4 text-slate-500">
                  建议保持 4 个模块静区；更小边距可能降低扫码成功率。
                </p>
              </div>
            </div>
          )}

          <fieldset className="grid min-w-0 grid-cols-2 gap-4">
            <legend className="sr-only">码图颜色</legend>
            <div>
              <label htmlFor="config-qr-color" className="mb-1 block text-xs font-medium text-slate-700">码颜色</label>
              <div className="flex items-center gap-2">
                <input
                  id="config-qr-color"
                  type="color"
                  value={config.qrColor}
                  onChange={(event) => updateField('qrColor', event.target.value)}
                  className={colorInputClass}
                />
                <span className="min-w-0 truncate font-mono text-xs uppercase text-slate-600">{config.qrColor}</span>
              </div>
            </div>

            <div>
              <label htmlFor="config-background-color" className="mb-1 block text-xs font-medium text-slate-700">背景颜色</label>
              <div className="flex items-center gap-2">
                <input
                  id="config-background-color"
                  type="color"
                  value={config.bgColor}
                  onChange={(event) => updateField('bgColor', event.target.value)}
                  className={colorInputClass}
                />
                <span className="min-w-0 truncate font-mono text-xs uppercase text-slate-600">{config.bgColor}</span>
              </div>
            </div>
          </fieldset>
        </fieldset>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <fieldset className="min-w-0 space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Crop className="h-3.5 w-3.5" aria-hidden="true" />
              输出图片横纵比例 (Aspect Ratio)
            </span>
          </legend>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ASPECT_RATIOS.map((option) => {
              const isSelected = config.aspectRatio === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => updateField('aspectRatio', option.value)}
                  className={`${optionButtonClass} px-2 py-2 ${
                    isSelected
                      ? 'border-indigo-200 bg-indigo-50 font-semibold text-indigo-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {config.aspectRatio === 'custom' && (
            <fieldset className="min-w-0 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <legend className="px-1 text-xs font-medium text-slate-700">自定义宽高比值 (宽 : 高)</legend>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <label htmlFor="config-aspect-width" className="sr-only">自定义宽度比例</label>
                  <input
                    id="config-aspect-width"
                    type="number"
                    min="1"
                    max="100"
                    value={config.customAspectRatioWidth || 16}
                    onChange={(event) => updateField('customAspectRatioWidth', Math.max(1, Number(event.target.value)))}
                    className={textInputClass}
                    placeholder="宽"
                  />
                </div>
                <span className="font-bold text-slate-500" aria-hidden="true">:</span>
                <div className="min-w-0 flex-1">
                  <label htmlFor="config-aspect-height" className="sr-only">自定义高度比例</label>
                  <input
                    id="config-aspect-height"
                    type="number"
                    min="1"
                    max="100"
                    value={config.customAspectRatioHeight || 9}
                    onChange={(event) => updateField('customAspectRatioHeight', Math.max(1, Number(event.target.value)))}
                    className={textInputClass}
                    placeholder="高"
                  />
                </div>
              </div>
            </fieldset>
          )}
        </fieldset>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <fieldset className="min-w-0 space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5" aria-hidden="true" />
              下方文本排版设置
            </span>
          </legend>

          <label
            htmlFor="config-show-input-text"
            className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
          >
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-slate-800">显示输入文本</span>
              <span className="block text-[11px] leading-4 text-slate-600">统一应用于单张生成、Excel 批量预览与导出</span>
            </span>
            <span className="flex min-h-11 min-w-11 shrink-0 items-center justify-center">
              <input
                id="config-show-input-text"
                type="checkbox"
                role="switch"
                checked={config.showInputText}
                onChange={(event) => updateField('showInputText', event.target.checked)}
                className="h-5 w-5 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </span>
          </label>

          {config.showInputText && (
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              <div>
                <label htmlFor="config-input-font-size" className="block text-xs font-medium text-slate-700">
                  文本字号 ({config.inputFontSize}px)
                </label>
                <input
                  id="config-input-font-size"
                  type="range"
                  min="10"
                  max="24"
                  value={config.inputFontSize}
                  onChange={(event) => updateField('inputFontSize', Number(event.target.value))}
                  className={rangeInputClass}
                />
              </div>
              <div>
                <label htmlFor="config-input-font-color" className="mb-1 block text-xs font-medium text-slate-700">文本字色</label>
                <input
                  id="config-input-font-color"
                  type="color"
                  value={config.inputFontColor}
                  onChange={(event) => updateField('inputFontColor', event.target.value)}
                  className={colorInputClass}
                />
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <div>
              <label htmlFor="config-extra-text" className="mb-1 block text-xs font-medium text-slate-700">
                默认自定义附加文本 (可选)
              </label>
              <input
                id="config-extra-text"
                type="text"
                placeholder="如：扫描关注 / 检验合格 / 内部标示"
                value={config.extraText}
                onChange={(event) => updateField('extraText', event.target.value)}
                className={textInputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              <div>
                <label htmlFor="config-extra-font-size" className="block text-xs font-medium text-slate-700">
                  附加字号 ({config.extraFontSize}px)
                </label>
                <input
                  id="config-extra-font-size"
                  type="range"
                  min="10"
                  max="24"
                  value={config.extraFontSize}
                  onChange={(event) => updateField('extraFontSize', Number(event.target.value))}
                  className={rangeInputClass}
                />
              </div>
              <div>
                <label htmlFor="config-extra-font-color" className="mb-1 block text-xs font-medium text-slate-700">附加字色</label>
                <input
                  id="config-extra-font-color"
                  type="color"
                  value={config.extraFontColor}
                  onChange={(event) => updateField('extraFontColor', event.target.value)}
                  className={colorInputClass}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 border-t border-slate-100/80 pt-2 sm:grid-cols-2 sm:gap-4">
            <div>
              <label htmlFor="config-text-padding" className="block text-xs font-medium text-slate-700">
                文本间距 ({config.textPadding}px)
              </label>
              <input
                id="config-text-padding"
                type="range"
                min="0"
                max="20"
                step="1"
                value={config.textPadding}
                onChange={(event) => updateField('textPadding', Number(event.target.value))}
                className={rangeInputClass}
              />
            </div>

            <div>
              <label htmlFor="config-padding-bottom" className="block text-xs font-medium text-slate-700">
                画布底边距 ({config.paddingBottom}px)
              </label>
              <input
                id="config-padding-bottom"
                type="range"
                min="0"
                max="30"
                step="1"
                value={config.paddingBottom}
                onChange={(event) => updateField('paddingBottom', Number(event.target.value))}
                className={rangeInputClass}
              />
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  );
};
