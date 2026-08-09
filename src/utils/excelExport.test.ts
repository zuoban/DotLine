import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultConfig } from '../types';

const { saveAsMock, generateCompositeCodeMock } = vi.hoisted(() => ({
  saveAsMock: vi.fn(),
  generateCompositeCodeMock: vi.fn(async (...args: unknown[]) => {
    void args;
    return {
      dataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/XPq0WQAAAABJRU5ErkJggg==',
      width: 220,
      height: 220,
    };
  }),
}));

vi.mock('file-saver', () => ({ default: saveAsMock }));
vi.mock('./canvasRenderer', () => ({
  generateCompositeCode: generateCompositeCodeMock,
}));

import {
  downloadExcelTemplate,
  downloadImagesZip,
  exportExcelWithQRImages,
  parseExcelFile,
} from './excelHandler';

async function workbookFile(workbook: ExcelJS.Workbook): Promise<File> {
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return {
    name: 'fixture.xlsx',
    size: bytes.byteLength,
    arrayBuffer: async () => arrayBuffer,
  } as File;
}

beforeEach(() => {
  saveAsMock.mockReset();
  generateCompositeCodeMock.mockClear();
});

describe('downloadExcelTemplate', () => {
  it('creates a two-column template without a display-input column', async () => {
    await downloadExcelTemplate();

    expect(saveAsMock).toHaveBeenCalledOnce();
    expect(saveAsMock.mock.calls[0][1]).toBe('条码_二维码导入模版.xlsx');

    const templateBlob = saveAsMock.mock.calls[0][0] as Blob;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await templateBlob.arrayBuffer());
    const worksheet = workbook.getWorksheet('码图批量导入模版');

    expect(worksheet).toBeDefined();
    expect(worksheet?.columnCount).toBe(2);
    expect([
      worksheet?.getCell('A1').text,
      worksheet?.getCell('B1').text,
      worksheet?.getCell('C1').text,
    ]).toEqual(['输入文本', '附加内容', '']);
    expect(worksheet?.getCell('A2').text).toBe('6901234567892');
    expect(worksheet?.getCell('A2').numFmt).toBe('@');
    expect(worksheet?.getCell('B2').text).toBe('EAN13标准商品码');
  });
});

describe('exportExcelWithQRImages', () => {
  it('writes images back to original non-contiguous Excel rows without replacing input data', async () => {
    const sourceWorkbook = new ExcelJS.Workbook();
    const sourceSheet = sourceWorkbook.addWorksheet('Data');
    sourceSheet.addRow(['条码']);
    sourceSheet.addRow(['A001']);
    sourceSheet.addRow([]);
    sourceSheet.addRow(['B002']);
    sourceSheet.getRow(4).height = 200;

    const sourceFile = await workbookFile(sourceWorkbook);
    const parsed = await parseExcelFile(sourceFile);
    const hiddenInputConfig = { ...defaultConfig, showInputText: false };
    await exportExcelWithQRImages(sourceFile, parsed.rows, hiddenInputConfig);

    expect(saveAsMock).toHaveBeenCalledOnce();
    expect(generateCompositeCodeMock.mock.calls.map((call) => call[2])).toEqual([false, false]);
    const exportedBlob = saveAsMock.mock.calls[0][0] as Blob;
    const exportedWorkbook = new ExcelJS.Workbook();
    await exportedWorkbook.xlsx.load(await exportedBlob.arrayBuffer());
    const exportedSheet = exportedWorkbook.getWorksheet('Data');

    expect(exportedSheet).toBeDefined();
    expect(exportedSheet?.getCell('A2').text).toBe('A001');
    expect(exportedSheet?.getCell('A4').text).toBe('B002');
    expect(exportedSheet?.getCell('B1').text).toBe('生成二维码图片');
    expect(exportedSheet?.getRow(4).height).toBe(200);
    expect(exportedSheet?.getImages().map((image) => image.range.tl.nativeRow)).toEqual([1, 3]);
  });

  it('does not reuse or rename an ordinary QR-code data column as an image column', async () => {
    const sourceWorkbook = new ExcelJS.Workbook();
    const sourceSheet = sourceWorkbook.addWorksheet('Data');
    sourceSheet.addRow(['输入文本', '二维码']);
    sourceSheet.addRow(['A001', '已有二维码数据']);

    const sourceFile = await workbookFile(sourceWorkbook);
    const parsed = await parseExcelFile(sourceFile);
    await exportExcelWithQRImages(sourceFile, parsed.rows, defaultConfig);

    const exportedBlob = saveAsMock.mock.calls[0][0] as Blob;
    const exportedWorkbook = new ExcelJS.Workbook();
    await exportedWorkbook.xlsx.load(await exportedBlob.arrayBuffer());
    const exportedSheet = exportedWorkbook.getWorksheet('Data');

    expect(exportedSheet?.getCell('B1').text).toBe('二维码');
    expect(exportedSheet?.getCell('B2').text).toBe('已有二维码数据');
    expect(exportedSheet?.getCell('C1').text).toBe('生成二维码图片');
    expect(exportedSheet?.getImages()).toHaveLength(1);
    expect(exportedSheet?.getImages()[0].range.tl.nativeCol).toBe(2);
  });
});

describe('downloadImagesZip', () => {
  it('uses the page-wide display setting for every generated image', async () => {
    const hiddenInputConfig = { ...defaultConfig, showInputText: false };

    await downloadImagesZip(
      [
        {
          id: 'row_2',
          sourceRowNumber: 2,
          inputText: 'A001',
          extraText: '',
        },
        {
          id: 'row_3',
          sourceRowNumber: 3,
          inputText: 'B002',
          extraText: '',
        },
      ],
      hiddenInputConfig,
    );

    expect(generateCompositeCodeMock.mock.calls.map((call) => call[2])).toEqual([false, false]);
    expect(saveAsMock).toHaveBeenCalledOnce();
    expect(saveAsMock.mock.calls[0][1]).toMatch(/^码图压缩包_\d+\.zip$/);
  });
});
