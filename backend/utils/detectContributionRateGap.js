const { getContributionRateThresholds, DISCLAIMER_HE } = require('../config/contributionRateThresholds');
const { detectFundContributionStatus } = require('./detectFundWithoutDeposit');
const { buildFundTimeline, isPayslipDocument } = require('./contributionTimeline');
const { normalizeAmount } = require('./numeric');
const { resolvePayslipPeriod, monthKey } = require('./payslipPeriod');

const FUND_TYPES = Object.freeze(['study_fund', 'pension']);

const ROLE_LABELS = Object.freeze({
  employee: 'עובד',
  employer: 'מעסיק',
  severance: 'פיצויים',
});

const FUND_CONFIG = Object.freeze({
  study_fund: {
    contributionKey: 'study_fund',
    baseField: 'base_salary_for_study_fund',
    employeeRateField: 'employee_rate_percent',
    employerRateField: 'employer_rate_percent',
    ambiguousCategory: 'ambiguous.contributions.study_roles',
    labelHe: 'קרן השתלמות',
    inconsistencyFindingId: 'study_fund_rate_inconsistency',
    belowMinimumFindingId: 'study_fund_rate_below_minimum',
    dataIncompleteFindingId: 'study_fund_rate_data_incomplete',
    sides: ['employee', 'employer'],
  },
  pension: {
    contributionKey: 'pension',
    baseField: 'base_salary_for_pension',
    employeeRateField: 'employee_rate_percent',
    employerRateField: 'employer_rate_percent',
    severanceRateField: 'severance_rate_percent',
    ambiguousCategory: 'ambiguous.contributions.pension_roles',
    labelHe: 'פנסיה',
    inconsistencyFindingId: 'pension_rate_inconsistency',
    belowMinimumFindingId: 'pension_rate_below_minimum',
    dataIncompleteFindingId: 'pension_rate_data_incomplete',
    sides: ['employee', 'employer', 'severance'],
  },
});

const MAX_PERIODS_IN_SUMMARY = 6;

const toAmount = value => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  try {
    return normalizeAmount(value);
  } catch {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
};

const toPercent = value => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const formatPercent = value => {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }
  return `${Number(value.toFixed(2))}%`;
};

const formatPeriodList = (periods, max = MAX_PERIODS_IN_SUMMARY) => {
  const unique = [...new Set(periods.filter(Boolean))];
  if (!unique.length) {
    return '';
  }
  if (unique.length <= max) {
    return unique.join(', ');
  }
  return `${unique.slice(0, max).join(', ')} ועוד ${unique.length - max}`;
};

const getWarningCategories = analysisData => {
  const categories = analysisData?.quality?.warning_categories;
  return Array.isArray(categories) ? categories : [];
};

const readSideValues = (fundBlock, config, role) => {
  if (role === 'employee') {
    return {
      amount: fundBlock?.employee,
      statedRate: fundBlock?.[config.employeeRateField] ?? fundBlock?.employeeRate,
    };
  }
  if (role === 'employer') {
    return {
      amount: fundBlock?.employer,
      statedRate: fundBlock?.[config.employerRateField] ?? fundBlock?.employerRate,
    };
  }
  return {
    amount: fundBlock?.severance,
    statedRate: fundBlock?.[config.severanceRateField] ?? fundBlock?.severanceRate,
  };
};

const adjustedBaseForJobPercent = (analysisData, base, thresholds) => {
  const normalizedBase = toAmount(base);
  if (normalizedBase == null || normalizedBase <= 0 || !thresholds.adjustForJobPercent) {
    return normalizedBase;
  }
  const jobPercent = toAmount(analysisData?.employment?.job_percent);
  if (jobPercent == null || jobPercent <= 0 || jobPercent >= 100) {
    return normalizedBase;
  }
  return +(normalizedBase * (jobPercent / 100)).toFixed(4);
};

const computeImpliedPercent = (
  amount,
  base,
  analysisData = {},
  thresholdsInput,
) => {
  const thresholds = thresholdsInput || getContributionRateThresholds();
  const effectiveBase = adjustedBaseForJobPercent(analysisData, base, thresholds);
  const normalizedAmount = toAmount(amount);
  if (normalizedAmount == null || effectiveBase == null || effectiveBase <= 0) {
    return null;
  }
  return +((normalizedAmount / effectiveBase) * 100).toFixed(4);
};

const getMinimumForRole = (thresholds, fundType, role) => {
  const fundThresholds = thresholds[fundType];
  if (!fundThresholds) {
    return null;
  }
  if (role === 'employee') {
    return fundThresholds.employeeMinPercent;
  }
  if (role === 'employer') {
    return fundThresholds.employerMinPercent;
  }
  return fundThresholds.severanceMinPercent ?? null;
};

const resolveContributionBase = (analysisData, fundBlock, config) => {
  const fundBase = toAmount(fundBlock[config.baseField]);
  if (fundBase != null && fundBase > 0) {
    return fundBase;
  }
  return toAmount(analysisData?.salary?.gross_total);
};

const analyzeContributionRates = (analysisData, fundType, thresholdsInput) => {
  const config = FUND_CONFIG[fundType];
  const thresholds = thresholdsInput || getContributionRateThresholds();
  if (!config) {
    throw new Error(`Unsupported fundType: ${fundType}`);
  }

  const fundStatus = detectFundContributionStatus(analysisData, fundType);
  if (fundStatus.noDeposit || fundStatus.missingLine) {
    return {
      fundType,
      sides: [],
      applicableSides: [],
      dataIncompleteSides: [],
      applies: false,
      skipped: true,
      ambiguousRoles: fundStatus.ambiguousRoles,
    };
  }

  const fundBlock = analysisData?.contributions?.[config.contributionKey] || {};
  const base = resolveContributionBase(analysisData, fundBlock, config);
  const warningCategories = getWarningCategories(analysisData);
  const ambiguousRoles = warningCategories.includes(config.ambiguousCategory);

  const sides = config.sides.map(role => {
    const { amount, statedRate } = readSideValues(fundBlock, config, role);
    const impliedPercent = computeImpliedPercent(amount, base, analysisData, thresholds);
    const statedPercent = toPercent(statedRate);
    const minimumPercent = getMinimumForRole(thresholds, fundType, role);

    const hasConsistencyCheck =
      statedPercent != null &&
      impliedPercent != null &&
      toAmount(amount) > 0 &&
      toAmount(base) > 0;

    const consistencyGap =
      hasConsistencyCheck &&
      Math.abs(statedPercent - impliedPercent) > thresholds.inconsistencyTolerancePercent;

    const effectivePercent = statedPercent ?? impliedPercent;
    const belowMinimum =
      effectivePercent != null &&
      minimumPercent != null &&
      effectivePercent < minimumPercent;

    const dataIncomplete =
      statedPercent == null &&
      impliedPercent != null &&
      toAmount(amount) > 0 &&
      toAmount(base) > 0;

    return {
      role,
      roleLabel: ROLE_LABELS[role],
      amount: toAmount(amount),
      base: toAmount(base),
      statedPercent,
      impliedPercent,
      effectivePercent,
      minimumPercent,
      consistencyGap,
      belowMinimum,
      dataIncomplete,
    };
  });

  const applicableSides = sides.filter(
    side => side.consistencyGap || side.belowMinimum,
  );
  const dataIncompleteSides = sides.filter(side => side.dataIncomplete);

  return {
    fundType,
    sides,
    applicableSides,
    dataIncompleteSides,
    applies: applicableSides.length > 0 || dataIncompleteSides.length > 0,
    ambiguousRoles,
    confidence: ambiguousRoles ? 'low' : 'high',
  };
};

const formatPeriodLabel = analysisData => {
  const month = analysisData?.period?.month;
  if (typeof month === 'string' && month.trim()) {
    return month;
  }
  return null;
};

const severityForAnalysis = (analysis, { impliedOnly = false } = {}) => {
  if (analysis.confidence === 'low' || analysis.ambiguousRoles) {
    return 'info';
  }
  if (impliedOnly) {
    return 'info';
  }
  return 'warning';
};

const buildInconsistencyDetails = (config, hit, period, docLabel) => {
  const periodPart = period ? `לתקופה ${period}` : 'בתלוש';
  const lines = hit.applicableSides
    .filter(side => side.consistencyGap)
    .map(
      side =>
        `${side.roleLabel}: מוצהר ${formatPercent(side.statedPercent)}, משתמע ${formatPercent(side.impliedPercent)}`,
    );
  return `במסמך "${docLabel}" ${periodPart} זוהה פער באחוזי ${config.labelHe} (${lines.join('; ')}). ${DISCLAIMER_HE}`;
};

const buildBelowMinimumDetails = (config, hit, period, docLabel) => {
  const periodPart = period ? `לתקופה ${period}` : 'בתלוש';
  const lines = hit.applicableSides
    .filter(side => side.belowMinimum)
    .map(side => {
      const effective = formatPercent(side.effectivePercent);
      const minimum = formatPercent(side.minimumPercent);
      const source =
        side.statedPercent == null ? 'משתמע' : 'מוצהר';
      return `${side.roleLabel}: ${effective} (${source}, סף ייחוס ${minimum})`;
    });
  return `במסמך "${docLabel}" ${periodPart} אחוזי ${config.labelHe} מתחת לסף ייחוס (${lines.join('; ')}). ${DISCLAIMER_HE}`;
};

const buildDataIncompleteDetails = (config, hit, period, docLabel) => {
  const periodPart = period ? `לתקופה ${period}` : 'בתלוש';
  const lines = hit.dataIncompleteSides.map(
    side =>
      `${side.roleLabel}: משתמע ${formatPercent(side.impliedPercent)} (אין אחוז מוצהר בתלוש)`,
  );
  return `במסמך "${docLabel}" ${periodPart} יש הפקדות ל${config.labelHe} ללא אחוז מוצהר (${lines.join('; ')}). מומלץ לעבד מחדש את התלוש או לבדוק ידנית. ${DISCLAIMER_HE}`;
};

const buildMeta = (hit, fundType, findingKind) => {
  const documentId = hit.documentId || null;
  return {
    fundType,
    findingKind,
    periods: hit.periodKey ? [hit.periodKey] : hit.period ? [hit.period] : [],
    documentIds: documentId ? [documentId] : [],
  };
};

const buildContributionRateGapFindings = (documents, thresholdsInput) => {
  const thresholds = thresholdsInput || getContributionRateThresholds();
  const inconsistencyHits = { study_fund: [], pension: [] };
  const belowMinimumHits = { study_fund: [], pension: [] };
  const dataIncompleteHits = { study_fund: [], pension: [] };

  (documents || []).forEach(doc => {
    if (!doc || doc.status !== 'completed' || !isPayslipDocument(doc)) {
      return;
    }
    const {analysisData} = doc;
    if (!analysisData || typeof analysisData !== 'object') {
      return;
    }

    const period = formatPeriodLabel(analysisData);
    const periodResolved = resolvePayslipPeriod(doc);
    const periodKey =
      !periodResolved.incompletePeriod && periodResolved.year
        ? monthKey(periodResolved.year, periodResolved.month)
        : period;
    if (periodResolved.incompletePeriod || !periodKey) {
      return;
    }
    const docLabel = doc.originalName || 'מסמך';
    const documentId = doc._id?.toString?.() || doc._id || null;

    FUND_TYPES.forEach(fundType => {
      const timeline = buildFundTimeline([doc], fundType);
      const monthEntry = timeline.entries[0];
      if (!monthEntry) {
        return;
      }
      if (
        monthEntry &&
        (monthEntry.classification === 'uncertain' || monthEntry.classification === 'noFund')
      ) {
        return;
      }

      const config = FUND_CONFIG[fundType];
      const analysis = analyzeContributionRates(analysisData, fundType, thresholds);
      if (!analysis.applies) {
        return;
      }

      const severityBase = {
        period,
        periodKey,
        docLabel,
        documentId,
        config,
        analysis,
      };

      const hasInconsistency = analysis.applicableSides.some(side => side.consistencyGap);
      const hasBelowMinimum = analysis.applicableSides.some(side => side.belowMinimum);
      const hasDataIncomplete = analysis.dataIncompleteSides.length > 0;

      if (hasInconsistency) {
        inconsistencyHits[fundType].push({
          ...severityBase,
          severity: severityForAnalysis(analysis),
          details: buildInconsistencyDetails(config, analysis, period, docLabel),
        });
      }

      if (hasBelowMinimum) {
        const impliedOnly = analysis.applicableSides
          .filter(side => side.belowMinimum)
          .every(side => side.statedPercent == null);
        belowMinimumHits[fundType].push({
          ...severityBase,
          severity: severityForAnalysis(analysis, { impliedOnly }),
          details: buildBelowMinimumDetails(config, analysis, period, docLabel),
        });
      }

      if (hasDataIncomplete) {
        dataIncompleteHits[fundType].push({
          ...severityBase,
          severity: 'info',
          details: buildDataIncompleteDetails(config, analysis, period, docLabel),
        });
      }
    });
  });

  const findings = [];

  const pushAggregated = (fundType, hits, idKey, titleSuffix, findingKind) => {
    if (!hits.length) {
      return;
    }
    const config = FUND_CONFIG[fundType];
    const id = config[idKey];
    if (hits.length === 1) {
      const [hit] = hits;
      findings.push({
        id,
        title: `פער באחוזי הפרשה – ${config.labelHe} (${titleSuffix})`,
        severity: hit.severity,
        details: hit.details,
        fundType,
        meta: buildMeta(hit, fundType, findingKind),
      });
      return;
    }

    const periods = hits.map(hit => hit.periodKey || hit.period).filter(Boolean);
    const periodText = formatPeriodList(periods);
    const maxSeverity = hits.some(hit => hit.severity === 'warning') ? 'warning' : 'info';
    const documentIds = [...new Set(hits.map(hit => hit.documentId).filter(Boolean))];
    findings.push({
      id,
      title: `פער באחוזי הפרשה – ${config.labelHe} (${titleSuffix})`,
      severity: maxSeverity,
      details: `נמצאו ${hits.length} תלושים עם ${titleSuffix} ב${config.labelHe}${periodText ? ` בתקופות: ${periodText}` : ''}. ${DISCLAIMER_HE}`,
      fundType,
      meta: {
        fundType,
        findingKind,
        periods: [...new Set(periods)],
        documentIds,
      },
    });
  };

  pushAggregated(
    'study_fund',
    inconsistencyHits.study_fund,
    'inconsistencyFindingId',
    'תלוש',
    'rate',
  );
  pushAggregated('pension', inconsistencyHits.pension, 'inconsistencyFindingId', 'תלוש', 'rate');
  pushAggregated(
    'study_fund',
    belowMinimumHits.study_fund,
    'belowMinimumFindingId',
    'מתחת לסף',
    'rate',
  );
  pushAggregated(
    'pension',
    belowMinimumHits.pension,
    'belowMinimumFindingId',
    'מתחת לסף',
    'rate',
  );
  pushAggregated(
    'study_fund',
    dataIncompleteHits.study_fund,
    'dataIncompleteFindingId',
    'נתוני אחוז חסרים',
    'rate',
  );
  pushAggregated(
    'pension',
    dataIncompleteHits.pension,
    'dataIncompleteFindingId',
    'נתוני אחוז חסרים',
    'rate',
  );

  return findings;
};

const buildAllRateGapFindings = documents => buildContributionRateGapFindings(documents);

module.exports = {
  FUND_TYPES,
  FUND_CONFIG,
  analyzeContributionRates,
  buildContributionRateGapFindings,
  buildAllRateGapFindings,
  computeImpliedPercent,
  formatPeriodList,
  adjustedBaseForJobPercent,
};
