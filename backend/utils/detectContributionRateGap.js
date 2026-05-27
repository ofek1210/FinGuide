const { getContributionRateThresholds, DISCLAIMER_HE } = require('../config/contributionRateThresholds');
const { detectFundContributionStatus } = require('./detectFundWithoutDeposit');
const { normalizeAmount } = require('./numeric');

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
    sides: ['employee', 'employer', 'severance'],
  },
});

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

const computeImpliedPercent = (amount, base) => {
  const normalizedAmount = toAmount(amount);
  const normalizedBase = toAmount(base);
  if (normalizedAmount == null || normalizedBase == null || normalizedBase <= 0) {
    return null;
  }
  return +((normalizedAmount / normalizedBase) * 100).toFixed(4);
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

const analyzeContributionRates = (analysisData, fundType, thresholdsInput) => {
  const config = FUND_CONFIG[fundType];
  const thresholds = thresholdsInput || getContributionRateThresholds();
  if (!config) {
    throw new Error(`Unsupported fundType: ${fundType}`);
  }

  const fundStatus = detectFundContributionStatus(analysisData, fundType);
  if (fundStatus.noDeposit || fundStatus.missingLine) {
    return { fundType, sides: [], applies: false, skipped: true, ambiguousRoles: fundStatus.ambiguousRoles };
  }

  const fundBlock = analysisData?.contributions?.[config.contributionKey] || {};
  const base = fundBlock[config.baseField];
  const warningCategories = getWarningCategories(analysisData);
  const ambiguousRoles = warningCategories.includes(config.ambiguousCategory);

  const sides = config.sides.map(role => {
    const { amount, statedRate } = readSideValues(fundBlock, config, role);
    const impliedPercent = computeImpliedPercent(amount, base);
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
    };
  });

  const applicableSides = sides.filter(
    side => side.consistencyGap || side.belowMinimum,
  );

  return {
    fundType,
    sides,
    applicableSides,
    applies: applicableSides.length > 0,
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

const severityForAnalysis = analysis =>
  analysis.confidence === 'low' || analysis.ambiguousRoles ? 'info' : 'warning';

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
      return `${side.roleLabel}: ${effective} (סף ייחוס ${minimum})`;
    });
  return `במסמך "${docLabel}" ${periodPart} אחוזי ${config.labelHe} מתחת לסף ייחוס (${lines.join('; ')}). ${DISCLAIMER_HE}`;
};

const buildContributionRateGapFindings = (documents, thresholdsInput) => {
  const thresholds = thresholdsInput || getContributionRateThresholds();
  const inconsistencyHits = { study_fund: [], pension: [] };
  const belowMinimumHits = { study_fund: [], pension: [] };

  (documents || []).forEach(doc => {
    if (!doc || doc.status !== 'completed') {
      return;
    }
    const analysisData = doc.analysisData;
    if (!analysisData || typeof analysisData !== 'object') {
      return;
    }

    const period = formatPeriodLabel(analysisData);
    const docLabel = doc.originalName || 'מסמך';
    const severityBase = { period, docLabel };

    FUND_TYPES.forEach(fundType => {
      const config = FUND_CONFIG[fundType];
      const analysis = analyzeContributionRates(analysisData, fundType, thresholds);
      if (!analysis.applies) {
        return;
      }

      const hasInconsistency = analysis.applicableSides.some(side => side.consistencyGap);
      const hasBelowMinimum = analysis.applicableSides.some(side => side.belowMinimum);
      const severity = severityForAnalysis(analysis);

      if (hasInconsistency) {
        inconsistencyHits[fundType].push({
          config,
          analysis,
          severity,
          details: buildInconsistencyDetails(config, analysis, period, docLabel),
          ...severityBase,
        });
      }

      if (hasBelowMinimum) {
        belowMinimumHits[fundType].push({
          config,
          analysis,
          severity,
          details: buildBelowMinimumDetails(config, analysis, period, docLabel),
          ...severityBase,
        });
      }
    });
  });

  const findings = [];

  const pushAggregated = (fundType, hits, idKey, titleSuffix) => {
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
      });
      return;
    }

    const periods = [...new Set(hits.map(hit => hit.period).filter(Boolean))];
    const periodText = periods.length > 0 ? ` בתקופות: ${periods.join(', ')}` : '';
    const maxSeverity = hits.some(hit => hit.severity === 'warning') ? 'warning' : 'info';
    findings.push({
      id,
      title: `פער באחוזי הפרשה – ${config.labelHe} (${titleSuffix})`,
      severity: maxSeverity,
      details: `נמצאו ${hits.length} תלושים עם ${titleSuffix} ב${config.labelHe}${periodText}. ${DISCLAIMER_HE}`,
      fundType,
    });
  };

  pushAggregated('study_fund', inconsistencyHits.study_fund, 'inconsistencyFindingId', 'תלוש');
  pushAggregated('pension', inconsistencyHits.pension, 'inconsistencyFindingId', 'תלוש');
  pushAggregated('study_fund', belowMinimumHits.study_fund, 'belowMinimumFindingId', 'מתחת לסף');
  pushAggregated('pension', belowMinimumHits.pension, 'belowMinimumFindingId', 'מתחת לסף');

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
};
