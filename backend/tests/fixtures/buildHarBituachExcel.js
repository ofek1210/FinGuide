

const XLSX = require('xlsx');

const DEFAULT_INSURANCE_ROWS = [
  { 'חברה': 'הפניקס', 'סוג': 'ביטוח חיים', 'פרמיה': 150, 'סכום': 500000, 'מספר פוליסה': 'L-001' },
  { 'חברה': 'מגדל', 'סוג': 'בריאות', 'פרמיה': 200, 'סכום': 100000, 'מספר פוליסה': 'H-001' },
];

function buildHarBituachExcel(rows = DEFAULT_INSURANCE_ROWS) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { buildHarBituachExcel, DEFAULT_INSURANCE_ROWS };
