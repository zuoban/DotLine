export type CodeMode = 'qr' | 'barcode';

export type BarcodeFormat =
  | 'CODE128'
  | 'CODE39'
  | 'EAN13'
  | 'EAN8'
  | 'UPC'
  | 'ITF14'
  | 'MSI'
  | 'pharmacode';

export type AspectRatioOption = 'auto' | '1:1' | '4:3' | '3:2' | '16:9' | '9:16' | 'custom';

export interface QrConfig {
  codeMode: CodeMode;                 // 模式: 'qr' | 'barcode'
  barcodeFormat: BarcodeFormat;       // 条码格式
  barcodeWidth: number;               // 单条线宽 (px)，默认 2
  barcodeHeight: number;              // 条码高度 (px)，默认 80
  autoWidthBarcode: boolean;          // 是否自动自适应拉长条码宽度填满卡片

  qrSize: number;                     // 二维码尺寸 (px)
  qrColor: string;                    // 码前景色 / 线条色
  bgColor: string;                    // 背景色
  margin: number;                     // 边距 (px)

  // 图像清晰度倍率 (Scale Factor)
  scale: number;                      // 高清缩放倍率，默认 2 (1x, 2x, 3x, 4x)

  // 输出图片横纵比设置
  aspectRatio: AspectRatioOption;     // 'auto' | '1:1' | '4:3' | '3:2' | '16:9' | '9:16' | 'custom'
  customAspectRatioWidth?: number;    // 自定义横向比例数，默认 16
  customAspectRatioHeight?: number;   // 自定义纵向比例数，默认 9

  // 文本显示设置
  showInputText: boolean;             // 是否在码下方显示输入文本
  inputFontSize: number;              // 输入文本字号 (px)
  inputFontColor: string;             // 输入文本字色

  extraText: string;                  // 自定义附加内容
  extraFontSize: number;             // 附加内容字号 (px)
  extraFontColor: string;            // 附加内容字色

  textPadding: number;                // 间距 (px)，默认 4
  paddingBottom: number;              // 画布底部外边距 (px)，默认 6
  fontFamily: string;                 // 字体名称
}

export const defaultConfig: QrConfig = {
  codeMode: 'qr',
  barcodeFormat: 'CODE128',
  barcodeWidth: 2,
  barcodeHeight: 80,
  autoWidthBarcode: true,
  qrSize: 220,
  qrColor: '#000000',
  bgColor: '#ffffff',
  margin: 1,
  scale: 2,                           // 默认 2x 高清导出
  aspectRatio: 'auto',
  customAspectRatioWidth: 16,
  customAspectRatioHeight: 9,
  showInputText: true,
  inputFontSize: 14,
  inputFontColor: '#1e293b',
  extraText: '',
  extraFontSize: 13,
  extraFontColor: '#000000',
  textPadding: 4,
  paddingBottom: 6,
  fontFamily: 'sans-serif',
};

export interface QrRowData {
  id: string;
  inputText: string;                  // 码内容 / 二维码文本
  showInputText: boolean;             // 是否显示输入文本
  extraText: string;                  // 附加文本
  status?: 'pending' | 'success' | 'error';
  errorMessage?: string;
  dataUrl?: string;                   // 生成的图片 Base64
  aspectRatio?: number;               // 宽高比（用于 Excel 自适应缩放）
}

export interface ExcelColumnMapping {
  inputTextCol: string;              // "输入文本" 列名
  showInputTextCol?: string;         // "显示输入文本" 列名
  extraTextCol?: string;             // "附加内容" 列名
}
