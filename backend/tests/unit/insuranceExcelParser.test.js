'use strict';

const XLSX = require('xlsx');
const { parseInsuranceExcel } = require('../../services/insuranceExcelParser');
const { buildHarBituachExcel } = require('../fixtures/buildHarBituachExcel');

function buildRealHarBituachExcel() {
  const rows = [
    [null, null, null, null, null, '01/06/2025'],
    [],
    [
      'תעודת זהות',
      'ענף ראשי',
      'חברה',
      'סוג מוצר',
      'ענף (משני)',
      'תקופת ביטוח',
      'פרמיה בש"ח',
      'סוג פרמיה',
      'מספר פוליסה',
      'סיווג תכנית',
      'פרטים נוספים',
    ],
    [null, 'תחום - בריאות ותאונות אישיות'],
    [
      '123456789',
      'בריאות ותאונות אישיות',
      'מגדל',
      'ביטוח בריאות',
      'בריאות',
      '01/01/2025 - 31/12/2025',
      220,
      'פרמיה חודשית',
      'HB-12345',
      'פרט',
      '',
    ],
    [null, 'תחום - ביטוח חיים'],
    [
      '123456789',
      'ביטוח חיים',
      'הפניקס',
      'ביטוח חיים',
      'חיים',
      '01/01/2025 - 31/12/2025',
      1800,
      'פרמיה שנתית',
      'L-98765',
      'פרט',
      '',
    ],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'HbResults');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('insuranceExcelParser', () => {
  it('parses real Har HaBituach export layout (header row + category rows)', () => {
    const buffer = buildRealHarBituachExcel();
    const policies = parseInsuranceExcel(buffer, 'har-bituach-real.xlsx');

    expect(policies.length).toBe(2);
    expect(policies[0].provider).toBe('מגדל');
    expect(policies[0].type).toBe('health');
    expect(policies[0].monthlyPremium).toBe(220);
    expect(policies[1].provider).toBe('הפניקס');
    expect(policies[1].type).toBe('life');
    expect(policies[1].annualPremium).toBe(1800);
  });

  it('still parses simplified test fixture format', () => {
    const buffer = buildHarBituachExcel();
    const policies = parseInsuranceExcel(buffer, 'har-bituach-simple.xlsx');

    expect(policies.length).toBeGreaterThan(0);
    expect(policies[0].provider).toBeTruthy();
  });
});
