import React from 'react';
import { Settings2, Type, Sliders, Barcode as BarcodeIcon, QrCode as QrIcon, Crop, Maximize2, Sparkles } from 'lucide-react';
import { QrConfig, BarcodeFormat, AspectRatioOption } from '../types';

interface ConfigPanelProps {
  config: QrConfig;
  onChange: (newConfig: QrConfig) => void;
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
  { label: '4x 300DPI', value: 4, desc: '印刷标贴级 (~1400px)' },
];

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onChange }) => {
  const updateField = <K extends keyof QrConfig>(field: K, value: QrConfig[K]) => {
    onChange({ ...config, [field]: value });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-6">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <Settings2 className="w-5 h-5 text-indigo-600" />
        <h2 className="font-semibold text-slate-800 text-base">样式与码制类型设置</h2>
      </div>

      {/* 码制模式切换 */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-700">选择编码模式</label>
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => updateField('codeMode', 'qr')}
            className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg transition-all ${
              config.codeMode === 'qr'
                ? 'bg-white text-indigo-600 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrIcon className="w-4 h-4" />
            二维码 (QR Code)
          </button>

          <button
            type="button"
            onClick={() => updateField('codeMode', 'barcode')}
            className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg transition-all ${
              config.codeMode === 'barcode'
                ? 'bg-white text-indigo-600 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarcodeIcon className="w-4 h-4" />
            一维条码 (Barcode)
          </button>
        </div>
      </div>

      {/* 图像分辨率 / 清晰度缩放倍率设置 */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          输出图片清晰度 (HD Scale)
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SCALE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateField('scale', opt.value)}
              className={`py-2 px-2 text-xs font-medium rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-0.5 ${
                (config.scale || 2) === opt.value
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{opt.label}</span>
              <span className="text-[10px] opacity-75 font-normal">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 码图尺寸与格式 */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5" />
          {config.codeMode === 'barcode' ? '一维条码属性' : '二维码属性'}
        </h3>

        {config.codeMode === 'barcode' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">条码编码标准</label>
              <select
                value={config.barcodeFormat}
                onChange={(e) => updateField('barcodeFormat', e.target.value as BarcodeFormat)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                {BARCODE_FORMATS.map((fmt) => (
                  <option key={fmt.value} value={fmt.value}>
                    {fmt.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                {BARCODE_FORMATS.find((f) => f.value === config.barcodeFormat)?.desc}
              </p>
            </div>

            {/* 条码宽度自适应拉长控制开关 */}
            <div className="flex items-center justify-between bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
              <div className="flex items-center gap-2">
                <Maximize2 className="w-4 h-4 text-indigo-600" />
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">条码宽度自适应拉长</span>
                  <span className="text-[11px] text-slate-500">自动扩展条码填满卡片可用宽度</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.autoWidthBarcode}
                onChange={(e) => updateField('autoWidthBarcode', e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  基准线宽 ({config.barcodeWidth}px)
                </label>
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="1"
                  value={config.barcodeWidth}
                  onChange={(e) => updateField('barcodeWidth', Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  条码高度 ({config.barcodeHeight}px)
                </label>
                <input
                  type="range"
                  min="40"
                  max="160"
                  step="5"
                  value={config.barcodeHeight}
                  onChange={(e) => updateField('barcodeHeight', Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                二维码尺寸 ({config.qrSize}px)
              </label>
              <input
                type="range"
                min="120"
                max="400"
                step="10"
                value={config.qrSize}
                onChange={(e) => updateField('qrSize', Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                内边距 ({config.margin})
              </label>
              <input
                type="range"
                min="0"
                max="4"
                step="1"
                value={config.margin}
                onChange={(e) => updateField('margin', Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* 通用前景色与背景色 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">码颜色</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.qrColor}
                onChange={(e) => updateField('qrColor', e.target.value)}
                className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5"
              />
              <span className="text-xs text-slate-600 uppercase font-mono">{config.qrColor}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">背景颜色</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.bgColor}
                onChange={(e) => updateField('bgColor', e.target.value)}
                className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5"
              />
              <span className="text-xs text-slate-600 uppercase font-mono">{config.bgColor}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 输出图片横纵比设置 */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Crop className="w-3.5 h-3.5" />
          输出图片横纵比例 (Aspect Ratio)
        </h3>

        <div className="grid grid-cols-3 gap-2">
          {ASPECT_RATIOS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateField('aspectRatio', opt.value)}
              className={`py-1.5 px-2 text-xs font-medium rounded-xl border transition-all text-center ${
                config.aspectRatio === opt.value
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 自定义比例数值输入 */}
        {config.aspectRatio === 'custom' && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
            <label className="block text-xs font-medium text-slate-700">自定义宽高比值 (宽 : 高)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100"
                value={config.customAspectRatioWidth || 16}
                onChange={(e) => updateField('customAspectRatioWidth', Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="宽"
              />
              <span className="text-slate-400 font-bold">:</span>
              <input
                type="number"
                min="1"
                max="100"
                value={config.customAspectRatioHeight || 9}
                onChange={(e) => updateField('customAspectRatioHeight', Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="高"
              />
            </div>
          </div>
        )}
      </div>

      {/* 下方文本排版 */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5" />
          下方文本排版设置
        </h3>

        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div>
            <span className="text-xs font-semibold text-slate-800 block">显示输入文本</span>
            <span className="text-[11px] text-slate-500">在码下方垂直居中展示原文本内容</span>
          </div>
          <input
            type="checkbox"
            checked={config.showInputText}
            onChange={(e) => updateField('showInputText', e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
          />
        </div>

        {config.showInputText && (
          <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                文本字号 ({config.inputFontSize}px)
              </label>
              <input
                type="range"
                min="10"
                max="24"
                value={config.inputFontSize}
                onChange={(e) => updateField('inputFontSize', Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">文本字色</label>
              <input
                type="color"
                value={config.inputFontColor}
                onChange={(e) => updateField('inputFontColor', e.target.value)}
                className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5"
              />
            </div>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              默认自定义附加文本 (可选)
            </label>
            <input
              type="text"
              placeholder="如：扫描关注 / 检验合格 / 内部标示"
              value={config.extraText}
              onChange={(e) => updateField('extraText', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                附加字号 ({config.extraFontSize}px)
              </label>
              <input
                type="range"
                min="10"
                max="24"
                value={config.extraFontSize}
                onChange={(e) => updateField('extraFontSize', Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">附加字色</label>
              <input
                type="color"
                value={config.extraFontColor}
                onChange={(e) => updateField('extraFontColor', e.target.value)}
                className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5"
              />
            </div>
          </div>
        </div>

        {/* 精细间距与边距调节 */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100/80">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              文本间距 ({config.textPadding}px)
            </label>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={config.textPadding}
              onChange={(e) => updateField('textPadding', Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              画布底边距 ({config.paddingBottom}px)
            </label>
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={config.paddingBottom}
              onChange={(e) => updateField('paddingBottom', Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
