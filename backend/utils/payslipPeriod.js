function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseYearMonth(value) {
  if (!value || typeof value !== 'string') return null;
  const m = value.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}

function parseDateLike(value) {
  if (!value || typeof value !== 'string') return null;
  const yyyyMmDd = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyyMmDd) {
    return { year: Number(yyyyMmDd[1]), month: Number(yyyyMmDd[2]) };
  }
  const ddMmYyyy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (ddMmYyyy) {
    const year = Number(ddMmYyyy[3].length === 2 ? `20${ddMmYyyy[3]}` : ddMmYyyy[3]);
    const month = Number(ddMmYyyy[2]);
    if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
    return { year, month };
  }
  const mmYyyy = value.match(/^(\d{1,2})\/(\d{4})$/);
  if (mmYyyy) {
    const year = Number(mmYyyy[2]);
    const month = Number(mmYyyy[1]);
    if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
    return { year, month };
  }
  return null;
}

function resolvePayslipPeriod(document) {
  const metadataYear = toFiniteNumber(document?.metadata?.periodYear);
  const metadataMonth = toFiniteNumber(document?.metadata?.periodMonth);
  if (metadataYear && metadataMonth && metadataMonth >= 1 && metadataMonth <= 12) {
    return {
      year: metadataYear,
      month: metadataMonth,
      source: 'metadata',
      incompletePeriod: false,
    };
  }

  const analysisPeriod = parseYearMonth(document?.analysisData?.period?.month);
  if (analysisPeriod) {
    return {
      ...analysisPeriod,
      source: 'analysis.period.month',
      incompletePeriod: false,
    };
  }

  const summaryDate = parseDateLike(document?.analysisData?.summary?.date);
  if (summaryDate) {
    return {
      ...summaryDate,
      source: 'summary.date',
      incompletePeriod: false,
    };
  }

  return {
    year: null,
    month: null,
    source: null,
    incompletePeriod: true,
  };
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function compareYearMonth(a, b) {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

function addMonths(year, month, delta) {
  let y = year;
  let m = month + delta;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return { year: y, month: m };
}

function* iterateMonths(from, to) {
  let current = { year: from.year, month: from.month };
  const end = { year: to.year, month: to.month };
  while (compareYearMonth(current, end) <= 0) {
    yield { year: current.year, month: current.month };
    current = addMonths(current.year, current.month, 1);
  }
}

function selectLatestDoc(existing, nextDoc) {
  const existingTime = new Date(
    existing.processedAt || existing.uploadedAt || existing.updatedAt || existing.createdAt || 0,
  ).getTime();
  const nextTime = new Date(
    nextDoc.processedAt || nextDoc.uploadedAt || nextDoc.updatedAt || nextDoc.createdAt || 0,
  ).getTime();
  return nextTime >= existingTime ? nextDoc : existing;
}

function formatYearMonthLabel(year, month) {
  return monthKey(year, month);
}

module.exports = {
  toFiniteNumber,
  parseYearMonth,
  parseDateLike,
  resolvePayslipPeriod,
  monthKey,
  compareYearMonth,
  addMonths,
  iterateMonths,
  selectLatestDoc,
  formatYearMonthLabel,
};
