import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseExcelFile } from './excelHandler';

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

describe('parseExcelFile', () => {
  it('ignores the legacy display column and preserves original row numbers across blanks', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');
    worksheet.addRow(['显示输入文本', '附加内容', '输入文本']);
    worksheet.addRow(['否', '第一条', 'A001']);
    worksheet.addRow([]);
    worksheet.addRow(['是', '第二条', 'B002']);

    const result = await parseExcelFile(await workbookFile(workbook));

    expect(result.inputTextCol).toBe('输入文本');
    expect(result.ignoredShowInputCol).toBe('显示输入文本');
    expect(result.rows).toMatchObject([
      { sourceRowNumber: 2, inputText: 'A001', extraText: '第一条' },
      { sourceRowNumber: 4, inputText: 'B002', extraText: '第二条' },
    ]);
    expect(result.rows.every((row) => !('showInputText' in row))).toBe(true);
  });

  it('keeps zero values, formatted leading zeroes, formulas, hyperlinks and rich text', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');
    worksheet.addRow(['输入文本']);

    worksheet.getCell('A2').value = 0;

    worksheet.getCell('A3').value = 123;
    worksheet.getCell('A3').numFmt = '000000';

    worksheet.getCell('A4').value = { formula: '1+1', result: 2 };
    worksheet.getCell('A4').numFmt = '000';

    worksheet.getCell('A5').value = {
      text: 'https://example.com/item',
      hyperlink: 'https://example.com/item',
    };

    worksheet.getCell('A6').value = {
      richText: [{ text: 'SN-' }, { text: '006' }],
    };

    worksheet.getCell('A7').value = 1234567890;
    worksheet.getCell('A7').numFmt = '000-000-0000';

    const result = await parseExcelFile(await workbookFile(workbook));

    expect(result.rows.map((row) => row.inputText)).toEqual([
      '0',
      '000123',
      '002',
      'https://example.com/item',
      'SN-006',
      '123-456-7890',
    ]);
    expect(result.ignoredShowInputCol).toBeUndefined();
  });

  it('rejects a workbook without an explicit content column', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');
    worksheet.addRow(['显示输入文本', '附加内容']);
    worksheet.addRow(['是', '备注']);

    await expect(parseExcelFile(await workbookFile(workbook))).rejects.toThrow('未找到有效的输入内容列');
  });

  it('does not select a description column during fuzzy input detection', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');
    worksheet.addRow(['商品编码说明', '商品条码']);
    worksheet.addRow(['用于说明编码规则', 'A001']);

    const result = await parseExcelFile(await workbookFile(workbook));

    expect(result.inputTextCol).toBe('商品条码');
    expect(result.rows[0].inputText).toBe('A001');
  });
});
