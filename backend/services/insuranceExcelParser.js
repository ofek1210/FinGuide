'use strict';

const XLSX = require('xlsx');

const TYPE_KEYWORDS = {
  life:             ['חיים', 'life', 'ריסק'],
  health:           ['בריאות', 'health', 'מחלה', 'ניתוח'],
  disability:       ['אכ"ע', 'נכות', 'disability', 'אובדן כושר'],
  apartment:        ['דירה', 'apartment', 'בית', 'רכוש'],
  car:              ['רכב', 'car', 'חובה', 'מקיף'],
  mortgage:         ['משכנתא', 'mortgage'],
  critical_illness: ['מחלות קשות', 'critical', 'סיעודי', 'סיעוד'],
};

function detectPolicyType(text) {
  const lower = (text || '').toLowerCase();
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      return type;
    }
  }
  return 'other';
}

function safeNum(val) {
  const n = parseFloat(String(val ?? '').replace(/[,₪\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function safeDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s || null;
}

function parseInsuranceExcel(buffer, originalName) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const policies = [];

  for (const row of rows) {
    const allText = Object.values(row).join(' ');

    const find = (...keys) => {
      for (const key of keys) {
        for (const col of Object.keys(row)) {
          if (col.includes(key)) return row[col];
        }
      }
      return null;
    };

    const premium = safeNum(find('פרמיה', 'premium', 'תשלום', 'סכום חודשי'));
    const coverage = safeNum(find('סכום', 'coverage', 'ביטוח', 'כיסוי'));
    const provider = String(find('חברה', 'מבטח', 'provider', 'חברת') || '').trim() || null;
    const policyNum = String(find('פוליסה', 'מספר', 'policy') || '').trim() || null;
    const startDate = safeDate(find('תחילה', 'start', 'תאריך תחילה'));
    const endDate = safeDate(find('תפוגה', 'end', 'סיום', 'פקיעה'));

    if (!premium && !coverage && !provider) continue;

    policies.push({
      type: detectPolicyType(allText),
      provider,
      policyNumber: policyNum,
      monthlyPremium: premium,
      coverageAmount: coverage,
      startDate,
      endDate,
      status: 'active',
      sourceFile: originalName,
      rawData: row,
    });
  }

  return policies;
}

module.exports = { parseInsuranceExcel };
