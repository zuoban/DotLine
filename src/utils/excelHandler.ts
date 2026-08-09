import ExcelJS from 'exceljs';
import saveAs from 'file-saver';
import JSZip from 'jszip';
import { QrConfig, QrRowData } from '../types';
import { generateCompositeCode } from './canvasRenderer';

const INPUT_HEADER_ALIASES = [
  '输入文本',
  '输入内容',
  '码内容',
  '编码内容',
  '条码内容',
  '条形码内容',
  '二维码内容',
  '扫码内容',
  '网址',
  '链接',
  'URL',
  'inputText',
  'input',
  'content',
  'text',
  'code',
  '条码',
  '条形码',
  '二维码',
];

// 旧模板可能仍包含这些列名：导入时将其视为辅助列并忽略，
// “是否显示输入文本”统一由页面配置控制。
const LEGACY_SHOW_INPUT_HEADER_ALIASES = [
  '显示输入文本',
  '是否显示输入文本',
  '显示文本',
  '是否显示',
  'showInputText',
  'showText',
];

const EXTRA_TEXT_HEADER_ALIASES = [
  '附加内容',
  '附加文本',
  '额外内容',
  '额外文本',
  '自定义内容',
  '备注',
  '说明',
  'extraText',
  'note',
  'description',
];

function normalizeHeader(value: string): string {
  return value.trim().replace(/[\s：:]+/g, '').toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function splitNumFmtSections(numFmt: string): string[] {
  const sections: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < numFmt.length; index++) {
    const char = numFmt[index];
    if (char === '"') quoted = !quoted;
    if (char === ';' && !quoted) {
      sections.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  sections.push(current);
  return sections;
}

function decodeNumFmtLiteral(value: string): string {
  return value
    .replace(/\[[^\]]*]/g, '')
    .replace(/"([^"]*)"/g, '$1')
    .replace(/\\(.)/g, '$1')
    .replace(/_.?/g, '')
    .replace(/\*./g, '');
}

function formatMultiRunIntegerValue(
  value: number,
  section: string,
  numberPatterns: RegExpMatchArray[],
  hasExplicitNegativeSection: boolean
): string | undefined {
  if (
    !Number.isSafeInteger(value) ||
    section.includes('%') ||
    numberPatterns.some((match) => /[,.]/.test(match[0])) ||
    /"[^"]*[0#?][^"]*"/.test(section)
  ) {
    return undefined;
  }

  const digits = String(Math.abs(value));
  let digitIndex = digits.length - 1;
  const formattedPatterns = Array<string>(numberPatterns.length).fill('');

  for (let patternIndex = numberPatterns.length - 1; patternIndex >= 0; patternIndex--) {
    const pattern = numberPatterns[patternIndex][0];
    let formatted = '';

    for (let index = pattern.length - 1; index >= 0; index--) {
      const placeholder = pattern[index];
      if (digitIndex >= 0) {
        formatted = digits[digitIndex--] + formatted;
      } else if (placeholder === '0') {
        formatted = `0${formatted}`;
      } else if (placeholder === '?') {
        formatted = ` ${formatted}`;
      }
    }
    formattedPatterns[patternIndex] = formatted;
  }

  // Excel 会把超出占位长度的高位数字保留在最左侧。
  if (digitIndex >= 0) {
    formattedPatterns[0] = `${digits.slice(0, digitIndex + 1)}${formattedPatterns[0]}`;
  }

  let formattedValue = '';
  let cursor = 0;
  numberPatterns.forEach((match, index) => {
    const start = match.index ?? cursor;
    formattedValue += decodeNumFmtLiteral(section.slice(cursor, start));
    formattedValue += formattedPatterns[index];
    cursor = start + match[0].length;
  });
  formattedValue += decodeNumFmtLiteral(section.slice(cursor));

  return value < 0 && !hasExplicitNegativeSection ? `-${formattedValue}` : formattedValue;
}

function formatNumberValue(value: number, numFmt: string | undefined, fallback: string): string {
  if (!numFmt || /^general$/i.test(numFmt.trim())) return fallback || String(value);

  const sections = splitNumFmtSections(numFmt);
  const sectionIndex = value < 0 && sections[1] ? 1 : value === 0 && sections[2] ? 2 : 0;
  const section = sections[sectionIndex] || sections[0];

  // 科学计数、分数和条件格式不在这里重新实现，保留 ExcelJS 提供的展示文本。
  if (/[eE][+-]?0|\?+\/\?+|\[[<>=]/.test(section)) return fallback || String(value);

  const cleanedSection = section.replace(/\[[^\]]*]/g, '');
  const numberPatternMatches = Array.from(
    cleanedSection.matchAll(/[0#?][0#?,]*(?:\.[0#?]+)?/g)
  );
  const numberPatternMatch = numberPatternMatches[0];
  if (!numberPatternMatch || numberPatternMatch.index === undefined) return fallback || String(value);

  const hasExplicitNegativeSection = value < 0 && Boolean(sections[1]);
  if (numberPatternMatches.length > 1) {
    return (
      formatMultiRunIntegerValue(
        value,
        cleanedSection,
        numberPatternMatches,
        hasExplicitNegativeSection
      ) ?? (fallback || String(value))
    );
  }

  const numberPattern = numberPatternMatch[0];
  const [integerPattern, fractionPattern = ''] = numberPattern.split('.');
  const minimumIntegerDigits = Math.min(Math.max((integerPattern.match(/0/g) || []).length, 1), 21);
  const minimumFractionDigits = (fractionPattern.match(/0/g) || []).length;
  const maximumFractionDigits = Math.min(fractionPattern.replace(/[^0#?]/g, '').length, 20);
  const hasPercent = cleanedSection.includes('%');
  const numericValue = (hasExplicitNegativeSection ? Math.abs(value) : value) * (hasPercent ? 100 : 1);

  const formattedNumber = new Intl.NumberFormat('en-US', {
    useGrouping: integerPattern.includes(','),
    minimumIntegerDigits,
    minimumFractionDigits,
    maximumFractionDigits: Math.max(minimumFractionDigits, maximumFractionDigits),
  }).format(numericValue);

  const start = numberPatternMatch.index;
  const prefix = decodeNumFmtLiteral(cleanedSection.slice(0, start));
  const suffix = decodeNumFmtLiteral(cleanedSection.slice(start + numberPattern.length));
  return `${prefix}${formattedNumber}${suffix}`;
}

function formatDateValue(value: Date, numFmt: string | undefined): string {
  const pad = (part: number, size = 2) => String(part).padStart(size, '0');
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + 1;
  const day = value.getUTCDate();
  const hour = value.getUTCHours();
  const minute = value.getUTCMinutes();
  const second = value.getUTCSeconds();

  if (!numFmt || /^general$/i.test(numFmt.trim())) {
    const datePart = `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
    return hour || minute || second ? `${datePart} ${pad(hour)}:${pad(minute)}:${pad(second)}` : datePart;
  }

  const format = splitNumFmtSections(numFmt)[0].replace(/\[[^\]]*]/g, '');
  const usesTwelveHourClock = /AM\/PM|A\/P/i.test(format);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return format.replace(
    /"[^"]*"|\\.|AM\/PM|A\/P|yyyy|yy|mmmmm|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s/gi,
    (token, offset: number) => {
      if (token.startsWith('"')) return token.slice(1, -1);
      if (token.startsWith('\\')) return token.slice(1);

      const lower = token.toLowerCase();
      if (lower === 'am/pm') return hour >= 12 ? 'PM' : 'AM';
      if (lower === 'a/p') return hour >= 12 ? 'P' : 'A';
      if (lower === 'yyyy') return pad(year, 4);
      if (lower === 'yy') return pad(year % 100);
      if (lower === 'dddd') return weekdayNames[value.getUTCDay()];
      if (lower === 'ddd') return weekdayNames[value.getUTCDay()].slice(0, 3);
      if (lower === 'dd') return pad(day);
      if (lower === 'd') return String(day);
      if (lower === 'hh') return pad(usesTwelveHourClock ? hour % 12 || 12 : hour);
      if (lower === 'h') return String(usesTwelveHourClock ? hour % 12 || 12 : hour);
      if (lower === 'ss') return pad(second);
      if (lower === 's') return String(second);

      if (/^m+$/i.test(token)) {
        const before = format.slice(0, offset);
        const after = format.slice(offset + token.length);
        const isMinute = /h{1,2}[^ymdhms]*$/i.test(before) || /^[^ymdhms]*s{1,2}/i.test(after);
        if (isMinute) return lower === 'mm' ? pad(minute) : String(minute);
        if (lower === 'mmmmm') return monthNames[month - 1][0];
        if (lower === 'mmmm') return monthNames[month - 1];
        if (lower === 'mmm') return monthNames[month - 1].slice(0, 3);
        return lower === 'mm' ? pad(month) : String(month);
      }

      return token;
    }
  );
}

/** 将 ExcelJS 的各种单元格值转换成用户在表格中期望看到的文本。 */
function cellToText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';

  let resolvedValue: unknown = value;
  if (isRecord(value)) {
    if ('result' in value) {
      resolvedValue = value.result;
    } else if (Array.isArray(value.richText)) {
      resolvedValue = value.richText
        .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
        .join('');
    } else if ('hyperlink' in value) {
      resolvedValue = typeof value.text === 'string' && value.text ? value.text : value.hyperlink;
    } else if (typeof value.error === 'string') {
      resolvedValue = value.error;
    }
  }

  if (resolvedValue === null || resolvedValue === undefined) return '';
  if (resolvedValue instanceof Date) return formatDateValue(resolvedValue, cell.numFmt);

  const displayText = cell.text || '';
  if (typeof resolvedValue === 'number') {
    return formatNumberValue(resolvedValue, cell.numFmt, displayText);
  }
  if (typeof resolvedValue === 'boolean') return resolvedValue ? 'true' : 'false';
  if (typeof resolvedValue === 'string') return resolvedValue;
  return displayText || String(resolvedValue);
}

function readHeaders(worksheet: ExcelJS.Worksheet): string[] {
  const headerRow = worksheet.getRow(1);
  const columnCount = Math.max(headerRow.cellCount, worksheet.columnCount);
  return Array.from({ length: columnCount }, (_, index) => cellToText(headerRow.getCell(index + 1)).trim());
}

function findExactColumn(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const index = headers.findIndex((header) => normalizeHeader(header) === normalizedAlias);
    if (index >= 0) return index + 1;
  }
  return -1;
}

function isAuxiliaryOrOutputHeader(header: string): boolean {
  const normalized = normalizeHeader(header);
  const exactAuxiliaryAliases = [...LEGACY_SHOW_INPUT_HEADER_ALIASES, ...EXTRA_TEXT_HEADER_ALIASES]
    .map(normalizeHeader);
  return (
    exactAuxiliaryAliases.includes(normalized) ||
    /^(显示|是否显示|附加|额外|备注|说明|自定义)/.test(normalized) ||
    /(说明|备注|描述|注释|comment|description|remark|note)/i.test(normalized) ||
    /(图片|图像|码图|生成|输出)/.test(normalized)
  );
}

function findInputColumn(headers: string[]): number {
  const exactColumn = findExactColumn(headers, INPUT_HEADER_ALIASES);
  if (exactColumn > 0) return exactColumn;

  // 兼容“商品条码”等业务表头，但明确排除显示、附加说明和已生成图片列。
  const fuzzyColumn = headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return (
      Boolean(normalized) &&
      !isAuxiliaryOrOutputHeader(header) &&
      /(输入|文本|内容|编码|条码|二维码|url|网址|链接|code)/i.test(normalized)
    );
  });
  return fuzzyColumn >= 0 ? fuzzyColumn + 1 : -1;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return '未知错误';
}

function createRowsError(errors: string[]): Error {
  return new Error(`有 ${errors.length} 行无法生成码图：\n${errors.join('\n')}`);
}

function getExcelRowNumber(item: QrRowData): number | undefined {
  return Number.isInteger(item.sourceRowNumber) && item.sourceRowNumber >= 2
    ? item.sourceRowNumber
    : undefined;
}

/**
 * 1. 下载标准模版
 */
export async function downloadExcelTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('码图批量导入模版');

  worksheet.columns = [
    { header: '输入文本', key: 'inputText', width: 35 },
    { header: '附加内容', key: 'extraText', width: 25 },
  ];
  worksheet.getColumn('inputText').numFmt = '@';

  const headerRow = worksheet.getRow(1);
  headerRow.font = { name: '微软雅黑', size: 11, bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4F46E5' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  const sampleRows = [
    { inputText: '6901234567892', extraText: 'EAN13标准商品码' },
    { inputText: 'SN987654321', extraText: '序列号条码' },
    { inputText: 'https://example.com/item/1001', extraText: '设备二维码-A' },
  ];

  sampleRows.forEach((data) => {
    worksheet.addRow(data);
  });

  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'E2E8F0' } },
        left: { style: 'thin', color: { argb: 'E2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
        right: { style: 'thin', color: { argb: 'E2E8F0' } },
      };
      cell.alignment = cell.alignment || { vertical: 'middle', horizontal: 'left' };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, '条码_二维码导入模版.xlsx');
}

/**
 * 2. 解析上传的 Excel 文件
 */
export async function parseExcelFile(file: File): Promise<{
  rows: QrRowData[];
  headers: string[];
  inputTextCol: string;
  ignoredShowInputCol?: string;
  extraTextCol?: string;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Excel 文件中没有找到可用工作表');
  }

  const headers = readHeaders(worksheet);
  const inputTextColIdx = findInputColumn(headers);
  if (inputTextColIdx < 1) {
    throw new Error(
      '未找到有效的输入内容列。请将表头命名为“输入文本”“输入内容”“条码内容”“二维码内容”或“URL”等明确名称。'
    );
  }

  const ignoredShowInputColIdx = findExactColumn(headers, LEGACY_SHOW_INPUT_HEADER_ALIASES);
  const extraTextColIdx = findExactColumn(headers, EXTRA_TEXT_HEADER_ALIASES);
  const inputTextCol = headers[inputTextColIdx - 1];
  const ignoredShowInputCol =
    ignoredShowInputColIdx > 0 ? headers[ignoredShowInputColIdx - 1] : undefined;
  const extraTextCol = extraTextColIdx > 0 ? headers[extraTextColIdx - 1] : undefined;

  const rows: QrRowData[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rawInputText = cellToText(row.getCell(inputTextColIdx)).trim();
    if (!rawInputText) return;

    let extraText = '';
    if (extraTextColIdx > 0) {
      extraText = cellToText(row.getCell(extraTextColIdx)).trim();
    }

    rows.push({
      id: `row_${rowNumber}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      sourceRowNumber: rowNumber,
      inputText: rawInputText,
      extraText,
      status: 'pending',
    });
  });

  return {
    rows,
    headers,
    inputTextCol,
    ignoredShowInputCol,
    extraTextCol,
  };
}

/**
 * 3. 导入数据生成并导出包含嵌入图片的 Excel 文件（基于实际生成的图片宽高比自适应算磅值和列宽）
 */
export async function exportExcelWithQRImages(
  file: File,
  rowsData: QrRowData[],
  config: QrConfig,
  onProgress?: (index: number, total: number) => void
) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('未找到可用工作表');
  }

  const headerRow = worksheet.getRow(1);
  const headers = readHeaders(worksheet);
  const inputColumnIndex = findInputColumn(headers);
  if (inputColumnIndex < 1) {
    throw new Error('原始 Excel 中未找到有效的输入内容列，请重新导入表头明确的文件。');
  }

  const isBarcode = config.codeMode === 'barcode';
  const targetHeaderName = isBarcode ? '生成条形码图片' : '生成二维码图片';
  const reusableHeaders = isBarcode
    ? ['生成条形码图片', '条形码图片', '条形码图像', '条形码码图']
    : ['生成二维码图片', '二维码图片', '二维码图像', '二维码码图'];
  let imageColIndex = findExactColumn(headers, reusableHeaders);

  if (imageColIndex === -1) {
    imageColIndex = Math.max(headerRow.cellCount, worksheet.columnCount) + 1;
    const cell = headerRow.getCell(imageColIndex);
    cell.font = { name: '微软雅黑', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F46E5' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  }
  // 复用时统一为明确的图片输出列名；普通“二维码 / 条形码”数据列不会进入复用候选。
  headerRow.getCell(imageColIndex).value = targetHeaderName;

  const total = rowsData.length;
  let maxRenderedWidth = 140;
  const rowErrors: string[] = [];
  const usedSourceRows = new Set<number>();

  for (let i = 0; i < total; i++) {
    const item = rowsData[i];
    const sourceRowNumber = getExcelRowNumber(item);

    try {
      if (!sourceRowNumber) {
        throw new Error(`第 ${i + 1} 条数据缺少有效的原始 Excel 行号，请重新导入文件`);
      }
      if (sourceRowNumber > worksheet.rowCount) {
        throw new Error('原始行号超出当前工作表范围');
      }
      if (usedSourceRows.has(sourceRowNumber)) {
        throw new Error('原始行号重复，无法确定图片应写入的位置');
      }
      usedSourceRows.add(sourceRowNumber);
      if (!item.inputText.trim()) throw new Error('输入内容为空');

      const { dataUrl, width, height } = await generateCompositeCode(
        item.inputText,
        config,
        config.showInputText,
        item.extraText
      );

      const imageId = workbook.addImage({
        base64: dataUrl,
        extension: 'png',
      });

      const currentRow = worksheet.getRow(sourceRowNumber);

      // 计算导出尺寸（避免变形，基于像素宽高比适配）
      const aspect = width / height;
      let imgWidth = 140;
      let imgHeight = 140;

      if (isBarcode) {
        imgWidth = 240;
        imgHeight = Math.round(240 / aspect);
      } else {
        if (aspect >= 1) {
          imgWidth = 150;
          imgHeight = Math.round(150 / aspect);
        } else {
          imgHeight = 150;
          imgWidth = Math.round(150 * aspect);
        }
      }

      if (imgWidth > maxRenderedWidth) {
        maxRenderedWidth = imgWidth;
      }

      // 设置行高时保留原工作表中更大的行高。
      const requiredRowHeight = Math.max(Math.round((imgHeight + 16) * 0.75), 45);
      currentRow.height = Math.max(currentRow.height || 0, requiredRowHeight);

      worksheet.addImage(imageId, {
        tl: { col: imageColIndex - 1 + 0.05, row: sourceRowNumber - 1 + 0.05 },
        ext: { width: imgWidth, height: imgHeight },
        editAs: 'oneCell',
      });
    } catch (error) {
      const rowLabel = sourceRowNumber ? `Excel 第 ${sourceRowNumber} 行` : `第 ${i + 1} 条数据`;
      rowErrors.push(`${rowLabel}：${getErrorMessage(error)}`);
    } finally {
      if (onProgress) onProgress(i + 1, total);
    }
  }

  if (rowErrors.length > 0) throw createRowsError(rowErrors);

  // 动态调整表格“码图”列宽 (以字符长度计量，约每 7 像素为一个字符)
  const dynamicColWidth = Math.max(Math.ceil(maxRenderedWidth / 6.8) + 3, isBarcode ? 36 : 24);
  worksheet.getColumn(imageColIndex).width = dynamicColWidth;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const label = isBarcode ? '条形码' : '二维码';
  saveAs(blob, `批量${label}导出_${Date.now()}.xlsx`);
}

/**
 * 4. 批量图片打包为 ZIP 下载
 */
export async function downloadImagesZip(
  rowsData: QrRowData[],
  config: QrConfig,
  onProgress?: (current: number, total: number) => void
) {
  const zip = new JSZip();
  const folderName = config.codeMode === 'barcode' ? 'barcode_images' : 'qrcode_images';
  const folder = zip.folder(folderName);
  const total = rowsData.length;
  const rowErrors: string[] = [];

  for (let i = 0; i < total; i++) {
    const item = rowsData[i];
    const sourceRowNumber = getExcelRowNumber(item);

    try {
      if (!sourceRowNumber) {
        throw new Error(`第 ${i + 1} 条数据缺少有效的原始 Excel 行号，请重新导入文件`);
      }
      if (!item.inputText.trim()) throw new Error('输入内容为空');

      const { dataUrl } = await generateCompositeCode(
        item.inputText,
        config,
        config.showInputText,
        item.extraText
      );
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');

      const safeName = (item.extraText || item.inputText || `code_${i + 1}`)
        .replace(/[\\/:*?"<>|]/g, '_')
        .slice(0, 30);
      folder?.file(`${i + 1}_${safeName}.png`, base64Data, { base64: true });
    } catch (error) {
      const rowLabel = sourceRowNumber ? `Excel 第 ${sourceRowNumber} 行` : `第 ${i + 1} 条数据`;
      rowErrors.push(`${rowLabel}：${getErrorMessage(error)}`);
    } finally {
      if (onProgress) onProgress(i + 1, total);
    }
  }

  if (rowErrors.length > 0) throw createRowsError(rowErrors);

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `码图压缩包_${Date.now()}.zip`);
}
