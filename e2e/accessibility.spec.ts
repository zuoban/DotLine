import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';

async function openApp(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('img', { name: /^二维码预览：/ })).toBeVisible();
}

async function createWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Accessibility');
  worksheet.addRow(['输入文本', '附加内容']);
  worksheet.addRow(['A11Y-001', '无障碍测试']);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function seriousViolations(
  violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
) {
  return violations.filter(({ impact }) => impact === 'critical' || impact === 'serious');
}

function violationSummary(violations: ReturnType<typeof seriousViolations>): string {
  return violations
    .map((violation) =>
      `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => `  - ${node.target.join(' ')}`).join('\n')}`
    )
    .join('\n\n');
}

async function expectNoSeriousViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const violations = seriousViolations(results.violations);
  expect(violations, violationSummary(violations)).toEqual([]);
}

test('单张生成页面无严重 axe 问题', async ({ page }) => {
  await openApp(page);
  await expectNoSeriousViolations(page);
});

test('Excel 数据预览页面无严重 axe 问题', async ({ page }) => {
  await openApp(page);
  await page.getByRole('tab', { name: /Excel 批量/ }).click();
  await page.locator('#excel-file-upload').setInputFiles({
    name: 'accessibility.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await createWorkbook(),
  });
  await expect(page.getByText('成功读取 1 条数据记录', { exact: true })).toBeVisible();
  await expect(page.getByText('预览生成完成，共 1 条。', { exact: true })).toBeVisible();
  await expectNoSeriousViolations(page);
});
