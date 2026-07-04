'use strict';

const path = require('path');
const fs = require('fs');
const { parseHarHaKesefExcel, parseHarHaKesefText, resolveFundType, parseProductType } = require('../../services/harHaKesefService');

const FIXTURE_DIR = path.join(__dirname, '../fixtures/har-hakesef');

describe('harHaKesefService', () => {
  it('parseHarHaKesefExcel extracts 4 funds from sample report', () => {
    const result = parseHarHaKesefExcel(path.join(FIXTURE_DIR, 'sample-report.xlsx'));

    expect(result.source).toBe('har_hakesef');
    expect(result.exportDate).toBe('15/03/2026');
    expect(result.funds).toHaveLength(4);
    expect(result.summary.totalFunds).toBe(4);
    expect(result.summary.totalBalance).toBe(400000);
    expect(result.summary.fundTypes).toEqual(
      expect.arrayContaining(['pension_comprehensive', 'provident_fund', 'study_fund', 'managers_insurance']),
    );
  });

  it('maps fund types and normalizes management fees', () => {
    const result = parseHarHaKesefExcel(path.join(FIXTURE_DIR, 'sample-report.xlsx'));
    const pension = result.funds.find(f => f.fundType === 'pension_comprehensive');

    expect(pension).toMatchObject({
      fundName: 'מגדל מקיפה',
      provider: 'מגדל',
      currentBalance: 185000,
      monthlyEmployeeDeposit: 1080,
      monthlyEmployerDeposit: 1500,
      managementFeeAccumulation: 0.006,
      managementFeeDeposit: 0.001,
      riskLevel: 'high',
      status: 'active',
    });
  });

  it('parseHarHaKesefText extracts funds from layout text', () => {
    const text = fs.readFileSync(path.join(FIXTURE_DIR, 'sample-report-text.txt'), 'utf8');
    const result = parseHarHaKesefText(text);

    expect(result.funds.length).toBeGreaterThanOrEqual(3);
    expect(result.summary.totalBalance).toBeGreaterThan(0);
  });

  it('resolveFundType maps Hebrew product names', () => {
    expect(resolveFundType('פנסיה מקיפה')).toBe('pension_comprehensive');
    expect(resolveFundType('קרן השתלמות')).toBe('study_fund');
    expect(resolveFundType('קופת גמל')).toBe('provident_fund');
    expect(resolveFundType('ביטוח מנהלים')).toBe('managers_insurance');
  });

  it('parseProductType splits embedded status from product label', () => {
    expect(parseProductType('קרן פנסיה - פעילה')).toEqual({
      rawName: 'קרן פנסיה - פעילה',
      cleanType: 'קרן פנסיה',
      status: 'ACTIVE',
    });
    expect(parseProductType('קופת גמל - לא פעילה')).toEqual({
      rawName: 'קופת גמל - לא פעילה',
      cleanType: 'קופת גמל',
      status: 'INACTIVE',
    });
    expect(parseProductType('קרן השתלמות - שבוטל')).toEqual({
      rawName: 'קרן השתלמות - שבוטל',
      cleanType: 'קרן השתלמות',
      status: 'INACTIVE',
    });
  });

  it('returns empty funds with warning when headers missing', () => {
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['שורה', 'ללא', 'כותרות'], ['a', 'b', 'c']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = parseHarHaKesefExcel(buf);
    expect(result.funds).toHaveLength(0);
    expect(result.summary.parseWarnings.length).toBeGreaterThan(0);
  });
});
