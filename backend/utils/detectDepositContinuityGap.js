const { getDepositContinuityConfig, DISCLAIMER_HE } = require('../config/depositContinuityConfig');
const { FUND_TYPES } = require('./detectFundWithoutDeposit');
const { buildFundTimeline } = require('./contributionTimeline');
const {
  monthKey,
  compareYearMonth,
  addMonths,
  iterateMonths,
  formatYearMonthLabel,
  parseDateLike,
} = require('./payslipPeriod');
const { isPayslipDocument } = require('./contributionTimeline');

const FUND_META = Object.freeze({
  study_fund: {
    labelHe: 'קרן השתלמות',
    onPayslipFindingId: 'study_fund_deposit_break_on_payslip',
    missingPayslipFindingId: 'study_fund_deposit_break_missing_payslip',
    uncertainFindingId: 'study_fund_deposit_timeline_uncertain',
  },
  pension: {
    labelHe: 'פנסיה',
    onPayslipFindingId: 'pension_deposit_break_on_payslip',
    missingPayslipFindingId: 'pension_deposit_break_missing_payslip',
    uncertainFindingId: 'pension_deposit_timeline_uncertain',
  },
});

const resolveEmploymentStartMonth = documents => {
  for (const doc of documents || []) {
    if (!isPayslipDocument(doc)) {
      continue;
    }
    const raw = doc.analysisData?.employment?.employment_start_date;
    const parsed = parseDateLike(raw);
    if (parsed) {
      return parsed;
    }
  }
  return null;
};

const applyLookback = (windowEnd, lookbackMonths) => {
  if (!windowEnd || lookbackMonths <= 0) {
    return null;
  }
  return addMonths(windowEnd.year, windowEnd.month, -(lookbackMonths - 1));
};

const isBeforeEmployment = (year, month, employmentStart) => {
  if (!employmentStart) {
    return false;
  }
  return compareYearMonth({ year, month }, employmentStart) < 0;
};

const countMonthsWithDeposit = entries =>
  entries.filter(entry => entry.classification === 'hasDeposit').length;

const countUncertainMonths = entries =>
  entries.filter(entry => entry.classification === 'uncertain').length;

const detectOnPayslipBreaks = (entries, config) => {
  const breaks = [];
  let i = 0;

  while (i < entries.length) {
    if (entries[i].classification !== 'hasDeposit') {
      i += 1;
      continue;
    }

    const depositStart = entries[i];
    let j = i + 1;
    const gapEntries = [];

    while (j < entries.length && entries[j].classification === 'noDepositOnPayslip') {
      gapEntries.push(entries[j]);
      j += 1;
    }

    if (gapEntries.length >= config.minGapMonths) {
      if (j < entries.length && entries[j].classification === 'hasDeposit') {
        breaks.push({
          type: 'internal',
          from: depositStart,
          gapMonths: gapEntries,
          to: entries[j],
        });
        i = j;
        continue;
      }
      if (j >= entries.length) {
        breaks.push({
          type: 'trailing',
          from: depositStart,
          gapMonths: gapEntries,
          to: null,
        });
      }
    }

    i = gapEntries.length > 0 ? j : i + 1;
  }

  return breaks;
};

const findDepositBeforeGap = (byMonth, gapFirstMonth) => {
  let { year, month } = gapFirstMonth;
  for (let i = 0; i < 120; i += 1) {
    const prev = addMonths(year, month, -1);
    year = prev.year;
    month = prev.month;
    const entry = byMonth.get(monthKey(year, month));
    if (entry?.classification === 'hasDeposit') {
      return entry;
    }
    if (entry?.classification === 'noDepositOnPayslip') {
      return null;
    }
  }
  return null;
};

const detectMissingPayslipBreaks = (byMonth, windowStart, windowEnd, employmentStart, config) => {
  const breaks = [];
  let gapRun = [];

  const closeGapRun = afterEntry => {
    if (gapRun.length < config.minGapMonths) {
      gapRun = [];
      return;
    }
    const before = findDepositBeforeGap(byMonth, gapRun[0]);
    if (before && afterEntry?.classification === 'hasDeposit') {
      breaks.push({
        type: 'missing_payslip',
        gapMonths: [...gapRun],
        before,
        after: afterEntry,
      });
    }
    gapRun = [];
  };

  for (const { year, month } of iterateMonths(windowStart, windowEnd)) {
    if (isBeforeEmployment(year, month, employmentStart)) {
      continue;
    }
    const key = monthKey(year, month);
    if (!byMonth.has(key)) {
      gapRun.push({ year, month, key });
      continue;
    }
    closeGapRun(byMonth.get(key));
  }

  return breaks;
};

const collectBreakPeriodKeys = breaks => {
  const keys = new Set();
  for (const b of breaks) {
    if (b.type === 'missing_payslip') {
      b.gapMonths.forEach(m => keys.add(m.key));
    } else {
      b.gapMonths.forEach(m => keys.add(m.key));
    }
  }
  return keys;
};

const severityForOnPayslip = breaks => {
  const hasAmbiguous = breaks.some(b =>
    b.gapMonths.some(m => m.status.ambiguousRoles),
  );
  return hasAmbiguous ? 'info' : 'warning';
};

const severityForMissingPayslip = (breaks, config) => {
  const maxGap = Math.max(...breaks.map(b => b.gapMonths.length), 0);
  return maxGap >= config.missingPayslipGapWarningMonths ? 'warning' : 'info';
};

const formatMonthRange = months => {
  if (!months.length) {
    return '';
  }
  const labels = months.map(m => formatYearMonthLabel(m.year, m.month));
  if (labels.length === 1) {
    return labels[0];
  }
  return `${labels[0]}–${labels[labels.length - 1]}`;
};

const buildOnPayslipDetails = (meta, breaks) => {
  const parts = breaks.map(b => {
    const gapLabels = formatMonthRange(b.gapMonths.map(m => ({ year: m.year, month: m.month })));
    if (b.type === 'trailing') {
      return `הפקדות נפסקו מ-${gapLabels} ואילך (אחרי ${formatYearMonthLabel(b.from.year, b.from.month)})`;
    }
    return `חור ב-${gapLabels} בין ${formatYearMonthLabel(b.from.year, b.from.month)} ל-${formatYearMonthLabel(b.to.year, b.to.month)}`;
  });
  return `נפסק רצף הפקדות ל${meta.labelHe} בתלושים: ${parts.join('; ')}. ${DISCLAIMER_HE}`;
};

const buildMissingPayslipDetails = (meta, breaks) => {
  const parts = breaks.map(b => {
    const gapLabels = formatMonthRange(b.gapMonths);
    return `חודשים ללא תלוש (${gapLabels}) בין הפקדות ב-${formatYearMonthLabel(b.before.year, b.before.month)} ל-${formatYearMonthLabel(b.after.year, b.after.month)}. ניתן גם לבדוק כיסוי שנתי בדשבורד.`;
  });
  return `חשד לרצף הפקדות שבור ב${meta.labelHe}: ${parts.join('; ')}. ${DISCLAIMER_HE}`;
};

const buildContinuityMeta = (fundType, breaks, breakType) => {
  const periods = [];
  const documentIds = [];
  for (const b of breaks) {
    if (breakType === 'on_payslip') {
      b.gapMonths.forEach(m => {
        periods.push(m.key);
        if (m.documentId) {
          documentIds.push(m.documentId);
        }
      });
    } else {
      b.gapMonths.forEach(m => periods.push(m.key));
      if (b.before?.documentId) {
        documentIds.push(b.before.documentId);
      }
      if (b.after?.documentId) {
        documentIds.push(b.after.documentId);
      }
    }
  }
  return {
    fundType,
    findingKind: 'continuity',
    periods: [...new Set(periods)],
    documentIds: [...new Set(documentIds)],
  };
};

const analyzeFundContinuity = (documents, fundType, configInput) => {
  const config = configInput || getDepositContinuityConfig();
  const { byMonth, entries } = buildFundTimeline(documents, fundType, { continuityConfig: config });

  if (entries.length === 0) {
    return {
      onPayslipBreaks: [],
      missingPayslipBreaks: [],
      uncertainMonthCount: 0,
      breakPeriodKeys: new Set(),
      applies: false,
    };
  }

  const windowStart = { year: entries[0].year, month: entries[0].month };
  const windowEnd = { year: entries[entries.length - 1].year, month: entries[entries.length - 1].month };
  const employmentStart = resolveEmploymentStartMonth(documents);
  const lookbackStart = applyLookback(windowEnd, config.lookbackMonths);

  const filteredEntries =
    lookbackStart == null
      ? entries
      : entries.filter(e => compareYearMonth(e, lookbackStart) >= 0);

  const uncertainMonthCount = countUncertainMonths(filteredEntries);

  if (countMonthsWithDeposit(filteredEntries) < config.minMonthsWithDeposit) {
    return {
      onPayslipBreaks: [],
      missingPayslipBreaks: [],
      uncertainMonthCount,
      breakPeriodKeys: new Set(),
      applies: uncertainMonthCount >= config.uncertainMonthsThreshold,
    };
  }

  const effectiveStart =
    lookbackStart && compareYearMonth(lookbackStart, windowStart) > 0 ? lookbackStart : windowStart;

  const onPayslipBreaks = detectOnPayslipBreaks(filteredEntries, config);
  const missingPayslipBreaks = detectMissingPayslipBreaks(
    byMonth,
    effectiveStart,
    windowEnd,
    employmentStart,
    config,
  );

  const breakPeriodKeys = collectBreakPeriodKeys(onPayslipBreaks);

  return {
    onPayslipBreaks,
    missingPayslipBreaks,
    uncertainMonthCount,
    breakPeriodKeys,
    applies:
      onPayslipBreaks.length > 0 ||
      missingPayslipBreaks.length > 0 ||
      uncertainMonthCount >= config.uncertainMonthsThreshold,
  };
};

const buildDepositContinuityFindings = (documents, configInput) => {
  const config = configInput || getDepositContinuityConfig();
  const findings = [];
  const breakPeriodKeysByFund = {};

  FUND_TYPES.forEach(fundType => {
    const meta = FUND_META[fundType];
    const analysis = analyzeFundContinuity(documents, fundType, config);
    breakPeriodKeysByFund[fundType] = analysis.breakPeriodKeys;

    if (analysis.onPayslipBreaks.length > 0) {
      findings.push({
        id: meta.onPayslipFindingId,
        title: `נפסק רצף הפקדות – ${meta.labelHe} (בתלוש)`,
        severity: severityForOnPayslip(analysis.onPayslipBreaks),
        details: buildOnPayslipDetails(meta, analysis.onPayslipBreaks),
        fundType,
        meta: buildContinuityMeta(fundType, analysis.onPayslipBreaks, 'on_payslip'),
      });
    }

    if (analysis.missingPayslipBreaks.length > 0) {
      findings.push({
        id: meta.missingPayslipFindingId,
        title: `חשד לרצף שבור – ${meta.labelHe} (חודש ללא תלוש)`,
        severity: severityForMissingPayslip(analysis.missingPayslipBreaks, config),
        details: buildMissingPayslipDetails(meta, analysis.missingPayslipBreaks),
        fundType,
        meta: buildContinuityMeta(fundType, analysis.missingPayslipBreaks, 'missing_payslip'),
      });
    }

    if (analysis.uncertainMonthCount >= config.uncertainMonthsThreshold) {
      findings.push({
        id: meta.uncertainFindingId,
        title: `איכות נתונים – ${meta.labelHe} (חודשים לא ברורים)`,
        severity: 'info',
        details: `זוהו ${analysis.uncertainMonthCount} חודשים עם תלוש שבהם לא ניתן לקבוע בוודאות את מצב ההפקדות ל${meta.labelHe}. מומלץ לבדוק ידנית או להעלות תלוש מחדש. ${DISCLAIMER_HE}`,
        fundType,
        meta: { fundType, findingKind: 'continuity', periods: [], documentIds: [] },
      });
    }
  });

  return { findings, breakPeriodKeysByFund, config };
};

module.exports = {
  FUND_META,
  analyzeFundContinuity,
  buildDepositContinuityFindings,
  detectOnPayslipBreaks,
  detectMissingPayslipBreaks,
  collectBreakPeriodKeys,
};
