const { normalizeAmount } = require('./numeric');
const { resolvePayslipPeriod, monthKey } = require('./payslipPeriod');

const FUND_TYPES = Object.freeze(['study_fund', 'pension']);

const FUND_CONFIG = Object.freeze({
  study_fund: {
    contributionKey: 'study_fund',
    baseField: 'base_salary_for_study_fund',
    employeeQualityField: 'study_employee',
    employerQualityField: 'study_employer',
    missingLineCategory: 'missing.contributions.study_line',
    ambiguousRolesCategory: 'ambiguous.contributions.study_roles',
    labelHe: 'קרן השתלמות',
    findingId: 'study_fund_no_deposit',
    onboardingMismatchId: 'onboarding_study_fund_mismatch',
    onboardingFlag: 'hasStudyFund',
  },
  pension: {
    contributionKey: 'pension',
    baseField: 'base_salary_for_pension',
    employeeQualityField: 'pension_employee',
    employerQualityField: 'pension_employer',
    missingLineCategory: 'missing.contributions.pension_line',
    ambiguousRolesCategory: 'ambiguous.contributions.pension_roles',
    labelHe: 'פנסיה',
    findingId: 'pension_no_deposit',
    onboardingMismatchId: 'onboarding_pension_mismatch',
    onboardingFlag: 'hasPension',
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

const sumDeposits = (employee, employer) => {
  const emp = toAmount(employee);
  const empl = toAmount(employer);
  if (emp === null && empl === null) {
    return { total: 0, hasAnyValue: false };
  }
  return {
    total: (emp ?? 0) + (empl ?? 0),
    hasAnyValue: emp !== null || empl !== null,
  };
};

const severanceOnlyDeposit = (fundType, fundBlock) => {
  if (fundType !== 'pension') {
    return false;
  }
  const employee = toAmount(fundBlock?.employee) ?? 0;
  const employer = toAmount(fundBlock?.employer) ?? 0;
  const severance = toAmount(fundBlock?.severance) ?? 0;
  return severance > 0 && employee === 0 && employer === 0;
};

const getWarningCategories = analysisData => {
  const categories = analysisData?.quality?.warning_categories;
  return Array.isArray(categories) ? categories : [];
};

const qualityFieldHasCandidate = (analysisData, fieldName) => {
  const field = analysisData?.quality?.fields?.[fieldName];
  return Boolean(field && field.abstained === false);
};

const readStoredDetection = (contributions, fundType) => {
  const block = contributions?.[FUND_CONFIG[fundType].contributionKey];
  const detection = block?.detection;
  if (!detection || typeof detection !== 'object') {
    return null;
  }
  return detection;
};

/**
 * Detect fund section presence and deposit status for one payslip analysis payload.
 */
const detectFundContributionStatus = (analysisData, fundType) => {
  const config = FUND_CONFIG[fundType];
  if (!config) {
    throw new Error(`Unsupported fundType: ${fundType}`);
  }

  const reasons = [];
  const warningCategories = getWarningCategories(analysisData);
  const contributions = analysisData?.contributions || {};
  const fundBlock = contributions[config.contributionKey] || {};
  const storedDetection = readStoredDetection(contributions, fundType);

  const employee = fundBlock.employee;
  const employer = fundBlock.employer;
  const base = fundBlock[config.baseField];
  const { total: depositTotal } = sumDeposits(employee, employer);

  const missingLine = warningCategories.includes(config.missingLineCategory);
  const ambiguousRoles = warningCategories.includes(config.ambiguousRolesCategory);

  let fundSectionDetected = false;

  if (storedDetection?.sectionDetected === true) {
    fundSectionDetected = true;
    reasons.push('section_detected_from_ocr_metadata');
  }

  const baseAmount = toAmount(base);
  if (baseAmount !== null && baseAmount > 0) {
    fundSectionDetected = true;
    reasons.push('base_salary_for_fund_present');
  }

  if (
    qualityFieldHasCandidate(analysisData, config.employeeQualityField) ||
    qualityFieldHasCandidate(analysisData, config.employerQualityField)
  ) {
    fundSectionDetected = true;
    reasons.push('contribution_quality_candidates_present');
  }

  if (!missingLine && !fundSectionDetected) {
    const hasContributionObject =
      fundBlock && typeof fundBlock === 'object' && Object.keys(fundBlock).length > 0;
    if (hasContributionObject && !missingLine) {
      fundSectionDetected = true;
      reasons.push('contribution_block_without_missing_line_warning');
    }
  }

  if (missingLine) {
    fundSectionDetected = false;
    reasons.push('missing_fund_line_warning');
  }

  let noDeposit = false;
  if (storedDetection?.noDeposit === true) {
    noDeposit = true;
    reasons.push('no_deposit_from_ocr_metadata');
  } else {
    noDeposit = depositTotal === 0;
    if (noDeposit) {
      reasons.push('employee_and_employer_deposits_zero_or_missing');
    }
  }
  if (noDeposit && severanceOnlyDeposit(fundType, fundBlock)) {
    noDeposit = false;
    reasons.push('pension_severance_only_considered_as_deposit');
  }

  let confidence = 'high';
  if (ambiguousRoles) {
    confidence = 'low';
    reasons.push('ambiguous_contribution_roles');
  } else if (!storedDetection && !baseAmount && !qualityFieldHasCandidate(analysisData, config.employeeQualityField)) {
    confidence = 'medium';
  }

  const applies = fundSectionDetected && noDeposit && !missingLine;

  return {
    fundType,
    fundSectionDetected,
    noDeposit,
    applies,
    confidence,
    ambiguousRoles,
    missingLine,
    depositTotal,
    employeeAmount: toAmount(employee),
    employerAmount: toAmount(employer),
    baseAmount,
    reasons,
  };
};

const formatPeriodLabel = analysisData => {
  const month = analysisData?.period?.month;
  if (typeof month === 'string' && month.trim()) {
    return month;
  }
  const summaryDate = analysisData?.summary?.date;
  if (typeof summaryDate === 'string' && summaryDate.trim()) {
    return summaryDate;
  }
  return null;
};

const severityForStatus = status =>
  status.confidence === 'low' || status.ambiguousRoles ? 'info' : 'warning';

const buildContributionDetection = ({ sectionDetected, employee, employer, severance }) => {
  const { total } = sumDeposits(employee, employer);
  const severanceAmount = toAmount(severance) ?? 0;
  const noDeposit = total === 0 && severanceAmount === 0;
  return {
    sectionDetected: Boolean(sectionDetected),
    employeeAmount: toAmount(employee),
    employerAmount: toAmount(employer),
    severanceAmount: toAmount(severance),
    noDeposit,
  };
};

const buildDetailsForStatus = (config, status, docLabel, period) => {
  const periodPart = period ? `לתקופה ${period}` : 'בתלוש';
  const amountPart =
    status.employeeAmount !== null || status.employerAmount !== null
      ? ` (עובד: ${status.employeeAmount ?? 0} ₪, מעסיק: ${status.employerAmount ?? 0} ₪)`
      : '';
  return `במסמך "${docLabel}" ${periodPart} זוהתה ${config.labelHe} ללא הפקדת עובד/מעסיק${amountPart}. מומלץ לבדוק מול המעסיק.`;
};

/**
 * Build per-document fund-without-deposit finding candidates.
 */
const detectFundFindingsForDocuments = (documents, options = {}) => {
  const suppressPeriodKeysByFund = options.suppressPeriodKeysByFund || {};
  const hitsByFund = {
    study_fund: [],
    pension: [],
  };

  (documents || []).forEach(doc => {
    if (!doc || doc.status !== 'completed') {
      return;
    }

    const analysisData = doc.analysisData;
    if (!analysisData || typeof analysisData !== 'object') {
      return;
    }

    const period = formatPeriodLabel(analysisData);
    const periodResolved = resolvePayslipPeriod(doc);
    const periodKey =
      !periodResolved.incompletePeriod && periodResolved.year
        ? monthKey(periodResolved.year, periodResolved.month)
        : null;
    const docLabel = doc.originalName || 'מסמך';
    const documentId = doc._id?.toString?.() || doc._id || null;

    FUND_TYPES.forEach(fundType => {
      const suppressed = suppressPeriodKeysByFund[fundType];
      if (suppressed && periodKey && suppressed.has(periodKey)) {
        return;
      }

      const status = detectFundContributionStatus(analysisData, fundType);
      if (!status.applies) {
        return;
      }

      const config = FUND_CONFIG[fundType];
      hitsByFund[fundType].push({
        config,
        status,
        details: buildDetailsForStatus(config, status, docLabel, period),
        period,
        periodKey,
        documentId,
        severity: severityForStatus(status),
      });
    });
  });

  const findings = [];

  FUND_TYPES.forEach(fundType => {
    const hits = hitsByFund[fundType];
    if (!hits.length) {
      return;
    }

    const config = FUND_CONFIG[fundType];

    if (hits.length === 1) {
      const [hit] = hits;
      findings.push({
        id: config.findingId,
        title: `${config.labelHe} ללא הפקדה`,
        severity: hit.severity,
        details: hit.details,
        fundType,
        meta: {
          fundType,
          findingKind: 'deposit',
          periods: hit.period ? [hit.period] : [],
          documentIds: hit.documentId ? [hit.documentId] : [],
        },
      });
      return;
    }

    const periods = [...new Set(hits.map(hit => hit.period).filter(Boolean))];
    const periodText = periods.length > 0 ? ` בתקופות: ${periods.join(', ')}` : '';
    const maxSeverity = hits.some(hit => hit.severity === 'warning') ? 'warning' : 'info';
    const documentIds = [...new Set(hits.map(hit => hit.documentId).filter(Boolean))];

    findings.push({
      id: config.findingId,
      title: `${config.labelHe} ללא הפקדה`,
      severity: maxSeverity,
      details: `נמצאו ${hits.length} תלושים עם ${config.labelHe} ללא הפקדה חודשית${periodText}.`,
      fundType,
      meta: { fundType, findingKind: 'deposit', periods, documentIds },
    });
  });

  return findings;
};

const pickLatestPayslipDocument = documents => {
  const payslips = (documents || [])
    .filter(
      doc =>
        doc?.status === 'completed' &&
        doc?.analysisData &&
        typeof doc.analysisData === 'object' &&
        (doc.metadata?.category === 'payslip' || !doc.metadata?.category),
    )
    .sort((a, b) => {
      const periodA = a.analysisData?.period?.month || '';
      const periodB = b.analysisData?.period?.month || '';
      if (periodA !== periodB) {
        return periodB.localeCompare(periodA);
      }
      const uploadedA = new Date(a.uploadedAt || 0).getTime();
      const uploadedB = new Date(b.uploadedAt || 0).getTime();
      return uploadedB - uploadedA;
    });

  return payslips[0] || null;
};

/**
 * Compare onboarding declarations with latest analyzed payslip.
 */
const detectOnboardingFundMismatches = (user, documents) => {
  const onboardingData = user?.onboarding?.data;
  if (!onboardingData || typeof onboardingData !== 'object') {
    return [];
  }

  const latest = pickLatestPayslipDocument(documents);
  if (!latest) {
    return [];
  }

  const findings = [];
  const period = formatPeriodLabel(latest.analysisData);
  const periodPart = period ? ` (תלוש ${period})` : '';

  FUND_TYPES.forEach(fundType => {
    const config = FUND_CONFIG[fundType];
    const declared = onboardingData[config.onboardingFlag];

    if (declared !== true) {
      return;
    }

    const status = detectFundContributionStatus(latest.analysisData, fundType);

    const mismatch =
      !status.fundSectionDetected ||
      status.noDeposit ||
      status.missingLine;

    if (!mismatch) {
      return;
    }

    let detailReason = 'לא זוהתה הפקדה חודשית';
    if (status.missingLine) {
      detailReason = 'לא זוהתה הפקדה או שורת קרן בתלוש האחרון';
    } else if (status.applies) {
      detailReason = 'זוהתה קרן ללא הפקדת עובד/מעסיק';
    }

    findings.push({
      id: config.onboardingMismatchId,
      title: `סתירה: ${config.labelHe} בהצהרה מול התלוש`,
      severity: status.confidence === 'low' ? 'info' : 'warning',
      details: `באונבורדינג סימנתם שיש ${config.labelHe}, אך בתלוש האחרון${periodPart} ${detailReason}. מומלץ לעדכן את ההצהרה או לבדוק מול המעסיק.`,
      fundType,
    });
  });

  return findings;
};

/**
 * Merge fund findings for GET /api/findings (dedupe by id).
 */
const buildFundDepositFindings = (documents, user, options = {}) => {
  const fromDocs = detectFundFindingsForDocuments(documents, options);
  const fromOnboarding = detectOnboardingFundMismatches(user, documents);

  const byId = new Map();
  [...fromDocs, ...fromOnboarding].forEach(item => {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  });

  return Array.from(byId.values()).map(({ id, title, severity, details, meta }) => ({
    id,
    title,
    severity,
    details,
    meta,
  }));
};

module.exports = {
  FUND_TYPES,
  FUND_CONFIG,
  detectFundContributionStatus,
  detectFundFindingsForDocuments,
  detectOnboardingFundMismatches,
  buildFundDepositFindings,
  buildContributionDetection,
};
