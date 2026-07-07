

const XLSX = require('xlsx');
const {
  parseClearinghouseExcel,
  mapActivityStatus,
} = require('../../services/pensionClearinghouseParser');

function buildClearinghouseFixtureBuffer() {
  const wb = XLSX.utils.book_new();

  const products = [
    ['שם מוצר', 'סוג מוצר', 'שם חברה מנהלת', 'מספר פוליסה', 'סטטוס', 'סך הכל חיסכון', 'שיעור דמי ניהול מהפקדות', 'שיעור דמי ניהול שנתי מחיסכון צבור', 'תשואה מתחילת השנה'],
    ['מיטב מקיפה', 'פנסיה חדשה מקיפה', 'מיטב', 'POL-001', 'פעיל', 120436.25, 1.25, 0.11, 4.78],
    ['כלל גמל', 'קופת גמל להשקעה', 'כלל', 'POL-002', 'לא פעיל', 8500, 0.9, 0.08, 2.1],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(products), 'פרטי המוצרים שלי');

  const deposits = [
    ['מספר פוליסה', 'תאריך ערך', 'חודש שכר', 'שם מעסיק', 'הפקדות עובד', 'הפקדות מעסיק', 'הפקדות מעסיק לפיצויים'],
    ['POL-001', '01/05/2026', '05/2026', 'חברת דוגמה', 1080, 1500, 300],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(deposits), 'מעקב הפקדות');

  const insurance = [
    ['מספר פוליסה', 'סוג הכיסוי הביטוחי', 'קצבה חודשית', 'סכום חד פעמי'],
    ['POL-001', 'כיסוי למקרה מוות', 5000, null],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(insurance), 'כיסויים ביטוחיים');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('pensionClearinghouseParser', () => {
  it('mapActivityStatus maps Hebrew status strings', () => {
    expect(mapActivityStatus('פעיל')).toBe('ACTIVE');
    expect(mapActivityStatus('לא פעיל')).toBe('INACTIVE');
  });

  it('parseClearinghouseExcel reads 3 sheets and attaches deposits + coverages', () => {
    const buffer = buildClearinghouseFixtureBuffer();
    const parsed = parseClearinghouseExcel(buffer);

    expect(parsed.funds).toHaveLength(2);
    const active = parsed.funds.find(f => f.accountNumber === 'POL-001');
    expect(active.currentBalance).toBe(120436.25);
    expect(active.activityStatus).toBe('ACTIVE');
    expect(active.managementFeeAccumulation).toBeCloseTo(0.0011, 5);
    expect(active.insuranceCoverages).toHaveLength(1);
    expect(active.deposits).toHaveLength(1);
    expect(active.monthlyEmployeeDeposit).toBe(1080);

    const inactive = parsed.funds.find(f => f.accountNumber === 'POL-002');
    expect(inactive.activityStatus).toBe('INACTIVE');
    expect(inactive.isActive).toBe(false);
  });
});
