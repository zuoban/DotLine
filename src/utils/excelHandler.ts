import ExcelJS from 'exceljs';
import saveAs from 'file-saver';
import JSZip from 'jszip';
import { QrConfig, QrRowData } from '../types';
import { generateCompositeCode } from './canvasRenderer';

/**
 * 1. 下载标准模版
 */
export async function downloadExcelTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('码图批量导入模版');

  worksheet.columns = [
    { header: '输入文本', key: 'inputText', width: 35 },
    { header: '显示输入文本', key: 'showInputText', width: 15 },
    { header: '附加内容', key: 'extraText', width: 25 },
  ];

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
    { inputText: '6901234567890', showInputText: '是', extraText: 'EAN13标准商品码' },
    { inputText: 'SN987654321', showInputText: '是', extraText: '序列号条码' },
    { inputText: 'https://example.com/item/1001', showInputText: '否', extraText: '设备二维码-A' },
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
  showInputCol?: string;
  extraTextCol?: string;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Excel 文件中没有找到可用工作表');
  }

  const headers: string[] = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || '').trim();
  });

  let inputTextCol =
    headers.find(
      (h) =>
        h.includes('文本') ||
        h.includes('内容') ||
        h.includes('输入') ||
        h.includes('条码') ||
        h.includes('URL')
    ) ||
    headers[0] ||
    '';
  let showInputCol = headers.find((h) => h.includes('显示') || h.includes('是否'));
  let extraTextCol = headers.find(
    (h) => h.includes('附加') || h.includes('备注') || h.includes('自定义') || h.includes('说明')
  );

  const rows: QrRowData[] = [];
  const inputTextColIdx = headers.indexOf(inputTextCol) + 1;
  const showInputColIdx = showInputCol ? headers.indexOf(showInputCol) + 1 : -1;
  const extraTextColIdx = extraTextCol ? headers.indexOf(extraTextCol) + 1 : -1;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rawInputText = String(row.getCell(inputTextColIdx).value || '').trim();
    if (!rawInputText) return;

    let showInput = true;
    if (showInputColIdx > 0) {
      const val = String(row.getCell(showInputColIdx).value || '').trim().toLowerCase();
      if (val === '否' || val === 'false' || val === '0' || val === 'no' || val === 'n') {
        showInput = false;
      }
    }

    let extraText = '';
    if (extraTextColIdx > 0) {
      extraText = String(row.getCell(extraTextColIdx).value || '').trim();
    }

    rows.push({
      id: `row_${rowNumber}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      inputText: rawInputText,
      showInputText: showInput,
      extraText,
      status: 'pending',
    });
  });

  return {
    rows,
    headers,
    inputTextCol,
    showInputCol,
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
  let imageColIndex = -1;
  const targetHeaderName = config.codeMode === 'barcode' ? '条形码' : '二维码';

  headerRow.eachCell((cell, colNumber) => {
    const val = String(cell.value || '').trim();
    if (val === '二维码' || val === '条形码' || val === '条码') {
      imageColIndex = colNumber;
    }
  });

  if (imageColIndex === -1) {
    imageColIndex = headerRow.cellCount + 1;
    const cell = headerRow.getCell(imageColIndex);
    cell.value = targetHeaderName;
    cell.font = { name: '微软雅黑', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F46E5' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  }

  const isBarcode = config.codeMode === 'barcode';
  const total = rowsData.length;
  let rowIndexOffset = 2;
  let maxRenderedWidth = 140;

  for (let i = 0; i < total; i++) {
    const item = rowsData[i];
    if (onProgress) onProgress(i + 1, total);

    const { dataUrl, width, height } = await generateCompositeCode(
      item.inputText,
      config,
      item.showInputText,
      item.extraText
    );

    const imageId = workbook.addImage({
      base64: dataUrl,
      extension: 'png',
    });

    const currentRow = worksheet.getRow(rowIndexOffset + i);

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

    // 设置行高 (磅值 = 像素 * 0.75 + 上下留白)
    currentRow.height = Math.max(Math.round((imgHeight + 16) * 0.75), 45);

    worksheet.addImage(imageId, {
      tl: { col: imageColIndex - 1 + 0.05, row: rowIndexOffset + i - 1 + 0.05 },
      ext: { width: imgWidth, height: imgHeight },
      editAs: 'oneCell',
    });
  }

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

  for (let i = 0; i < total; i++) {
    const item = rowsData[i];
    if (onProgress) onProgress(i + 1, total);

    const { dataUrl } = await generateCompositeCode(
      item.inputText,
      config,
      item.showInputText,
      item.extraText
    );
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');

    const safeName = (item.extraText || item.inputText || `code_${i + 1}`)
      .replace(/[\\/:*?"<>|]/g, '_')
      .slice(0, 30);
    folder?.file(`${i + 1}_${safeName}.png`, base64Data, { base64: true });
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `码图压缩包_${Date.now()}.zip`);
}
