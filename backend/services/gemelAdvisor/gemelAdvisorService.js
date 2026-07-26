'use strict';

const fs = require('fs');
const path = require('path');
const GemelNetFund = require('../../models/GemelNetFund');
const PensionFund = require('../../models/PensionFund');
const { parseGovCsv } = require('../../utils/govCsvParser');
const gemelNetConfig = require('../../config/gemelNetConfig');
const { GEMEL_FUND_TYPES, findGemelHoldings } = require('../../ai/tools/gemelTools');
const { getGemelSummary } = require('../../ai/tools/gemelTools');
const { runGemelRecommendationEngine } = require('../gemelRecommendationEngine');
const { buildGemelAnalysis } = require('../gemelAnalysisService');
const { ALGORITHM_VERSION } = require('../../config/gemelAdvisorConfig');
const { mapPensionFundToAccount, emptyNormalizedAccount } = require('./schemas');
const { normalizeGemelNetRow } = require('./providers/gemelNetProvider');
const { normalizeDataGovRow } = require('./providers/dataGovGemelProvider');
const { mergeOfficialFundRecords } = require('./officialFundMerger');
const { matchAccountToOfficial } = require('./fundMatcher');
const { buildSuitabilityProfile } = require('./suitabilityProfile');
const { rankAlternatives } = require('./alternativesEngine');
const {
  analyzeAccountFees,
  analyzeAccountReturns,
  analyzeRiskSuitability,
  analyzeConsolidation,
  feeClassificationHe,
} = require('./accountAnalyzer');
const { parseUserExcelBuffer } = require('./userExcelParser');
const { polishGemelReportSummary } = require('./gemelLlmService');

function readGovCsvText(filePath) {
  const buf = fs.readFileSync(filePath);
  let text = buf.toString('utf8');
  if (text.includes('\uFFFD') || !/[\u0590-\u05FF]/.test(text.slice(0, 8000))) {
    try {
      const iconv = require('iconv-lite');
      text = iconv.decode(buf, 'win1255');
    } catch {
      // keep utf8 fallback
    }
  }
  return text;
}

function loadDataGovCsvFunds() {
  const csvPath = path.join(__dirname, '../../data/gov', gemelNetConfig.localCsvFile);
  if (!fs.existsSync(csvPath)) return [];
  const text = readGovCsvText(csvPath);
  return parseGovCsv(text).map(normalizeDataGovRow).filter(Boolean);
}

async function loadOfficialFunds() {
  const rows = await GemelNetFund.find({}).limit(5000).lean();
  const normalized = [];
  for (const row of rows) {
    const n = normalizeGemelNetRow(row);
    if (n?.fundCode) normalized.push(n);
  }
  for (const n of loadDataGovCsvFunds()) {
    normalized.push(n);
  }
  const { funds, conflicts } = mergeOfficialFundRecords(normalized);
  return { funds, conflicts };
}

function insightToRecommendation(insight, accountIds = []) {
  return {
    id: insight.id || insight.code || `gemel-${insight.title}`,
    type: insight.type || insight.code || 'review_alternatives',
    title: insight.title,
    explanation: insight.explanation || insight.reason || insight.finding || '',
    whyNow: insight.whyNow || 'כדאי לבדוק בטווח הקרוב — ההשפעה מצטברת לאורך זמן.',
    expectedBenefit: insight.expectedBenefit || insight.suggestedAction || 'שיפור במצב החיסכון והבהירות',
    severity: insight.severity || 'medium',
    urgency: insight.severity === 'high' || insight.severity === 'critical' ? 'this_month' : 'next_3_months',
    expectedImpact: insight.severity === 'high' ? 'high' : 'medium',
    confidence: insight.confidence ?? 0.7,
    possibleSavings: insight.possibleSavings ?? insight.financialImpact?.amount ?? null,
    accountIds,
    sourceAgents: ['gemel'],
    sourceData: insight.sources || ['gemel_advisor'],
    assumptions: insight.assumptions || [],
    warnings: insight.warnings || [],
  };
}

function buildAccountReport(account, match, feeAnalysis, returnAnalysis, riskAnalysis, alternatives, profile) {
  const dataQuality = match.matchConfidence >= 70 ? 'complete'
    : match.matchConfidence >= 55 ? 'partial' : 'requires_manual_review';

  return {
    accountId: account.accountId,
    productType: account.productType,
    fundName: account.fundName,
    companyName: account.companyName,
    trackName: account.trackName,
    balance: account.balance,
    accountStatus: account.accountStatus,
    fees: {
      balancePct: account.managementFeeBalancePct,
      depositPct: account.managementFeeDepositPct,
      balanceClassification: feeClassificationHe(feeAnalysis.balanceClassification),
      depositClassification: feeClassificationHe(feeAnalysis.depositClassification),
      estimatedAnnualCost: feeAnalysis.estimatedAnnualFeeCost,
      possibleSavings: feeAnalysis.findings[0]?.possibleSavings ?? null,
    },
    returns: {
      classification: returnAnalysis.classification,
      percentile: returnAnalysis.percentile ?? null,
    },
    risk: {
      level: match.matchedFund?.riskLevel || 'unknown',
      suitability: riskAnalysis.conclusion,
    },
    match: {
      method: match.matchMethod,
      confidence: match.matchConfidence,
      fundCode: match.matchedFundCode,
      warnings: match.warnings,
    },
    dataQuality,
    whatToReview: [
      feeAnalysis.balanceClassification === 'insufficient_data' ? 'דמי ניהול מהצבירה' : null,
      !match.matchedFundCode ? 'התאמה לנתוני שוק' : null,
      profile.missingFields.includes('riskTolerance') ? 'פרופיל סיכון' : null,
    ].filter(Boolean),
    alternatives,
    plainLanguage: {
      today: `${account.fundName} — ${account.productType === 'study_fund' ? 'קרן השתלמות' : 'קופת גמל'}${account.trackName ? `, מסלול ${account.trackName}` : ''}. צבירה: ₪${Math.round(account.balance).toLocaleString('he-IL')}.`,
      fees: feeAnalysis.balanceClassification === 'insufficient_data'
        ? 'אין מספיק נתונים להערכת דמי ניהול.'
        : `דמי ניהול מהצבירה נראים ${feeClassificationHe(feeAnalysis.balanceClassification).replace(/_/g, ' ')}.`,
      performance: returnAnalysis.classification === 'insufficient_history'
        ? 'אין מספיק היסטוריית ביצועים להשוואה.'
        : 'הביצועים הושוו לקופות דומות — ראה פירוט מלא.',
      risk: riskAnalysis.conclusion === 'insufficient_onboarding_data'
        ? 'חסרים נתוני פרופיל — לא ניתן להעריך התאמת סיכון.'
        : 'רמת הסיכון הושוו לפרופיל שמילאת.',
      alternativesNote: alternatives.length
        ? `ניתן להשוות עד ${alternatives.length} חלופות — לא מובטח שמתאימות לך.`
        : 'לא נמצאו חלופות מספיק בטוחות להצגה.',
    },
  };
}

function buildPayslipDerivedAccounts(summary, userId) {
  const uid = String(userId);
  const accounts = [];

  if (Array.isArray(summary?.funds) && summary.funds.length) {
    for (const f of summary.funds) {
      accounts.push(mapPensionFundToAccount({
        _id: f.id || f._id || `summary-${accounts.length}`,
        fundType: f.fundType,
        fundName: f.fundName,
        provider: f.provider,
        currentBalance: f.currentBalance,
        monthlyEmployeeDeposit: f.monthlyEmployeeDeposit,
        monthlyEmployerDeposit: f.monthlyEmployerDeposit,
        managementFeeAccumulation: f.managementFeeAccumulation,
        managementFeeDeposit: f.managementFeeDeposit,
        investmentTrack: f.investmentTrack,
        source: f.source || 'payslip',
        status: f.status || 'active',
        isActive: f.isActive !== false,
      }, userId));
    }
  }

  const hasStudyFromPayslip = summary?.hasStudyFund
    || (summary?.payslipContribution || 0) > 0
    || (summary?.studyFundEmployee || 0) > 0
    || (summary?.studyFundEmployer || 0) > 0;
  const hasStudyAccount = accounts.some(a => a.productType === 'study_fund');

  if (hasStudyFromPayslip && !hasStudyAccount) {
    accounts.push(emptyNormalizedAccount({
      accountId: `payslip-study-${uid}`,
      userId: uid,
      productType: 'study_fund',
      fundName: 'קרן השתלמות (מזוהה מהתלוש)',
      balance: summary?.studyFundBalance || 0,
      monthlyDeposit: summary?.payslipContribution
        || summary?.totalMonthlyContribution
        || ((summary?.studyFundEmployee || 0) + (summary?.studyFundEmployer || 0)),
      employeeDeposit: summary?.studyFundEmployee || 0,
      employerDeposit: summary?.studyFundEmployer || 0,
      source: 'payslip',
      warnings: ['נתונים מהתלוש — ללא שם קופה או צבירה'],
    }));
  }

  const providentCount = summary?.providentFundCount || 0;
  const existingProvident = accounts.filter(a => a.productType === 'gemel').length;
  for (let i = existingProvident; i < providentCount; i += 1) {
    accounts.push(emptyNormalizedAccount({
      accountId: `payslip-gemel-${uid}-${i}`,
      userId: uid,
      productType: 'gemel',
      fundName: providentCount > 1 ? `קופת גמל ${i + 1} (מזוהה מהתלוש)` : 'קופת גמל (מזוהה מהתלוש)',
      balance: summary?.providentBalance ? Math.round((summary.providentBalance || 0) / providentCount) : 0,
      monthlyDeposit: 0,
      source: 'payslip',
      warnings: ['נתונים מהתלוש — ללא פרטי קופה מלאים'],
    }));
  }

  return accounts;
}

async function loadGemelAccounts(userId, summary) {
  const funds = await findGemelHoldings(userId);

  if (funds.length) {
    return funds.map(f => mapPensionFundToAccount(f, userId));
  }

  return buildPayslipDerivedAccounts(summary, userId);
}

function buildOrchestratorPayload(report) {
  return {
    status: report.status,
    generatedAt: report.generatedAt,
    findings: report.findings,
    recommendations: report.recommendations,
    alternatives: report.accounts.flatMap(a => a.alternatives || []),
    strengths: report.strengths,
    risks: report.risks,
    opportunities: report.opportunities,
    severity: report.recommendations[0]?.severity || 'info',
    confidence: report.dataQuality.matchedAccounts / Math.max(report.dataQuality.totalAccounts, 1),
    financialCategory: 'investment',
    possibleSavings: report.recommendations.reduce((max, r) => Math.max(max, r.possibleSavings || 0), 0) || null,
  };
}

async function buildGemelAdvisorReport(userId, options = {}) {
  const startedAt = Date.now();
  const summary = options.summary || await getGemelSummary(userId);
  const profile = await buildSuitabilityProfile(userId, summary);

  let accounts = [];
  if (Array.isArray(options.parsedAccounts)) {
    accounts = options.parsedAccounts;
  } else {
    accounts = await loadGemelAccounts(userId, summary);
  }

  if (!accounts.length) {
    return {
      status: 'no_data',
      generatedAt: new Date().toISOString(),
      algorithmVersion: ALGORITHM_VERSION,
      sourceReports: [{ source: 'gemelnet', reportDate: null }],
      accounts: [],
      findings: [],
      recommendations: [],
      alternatives: [],
      strengths: [],
      risks: [],
      opportunities: [],
      dataQuality: { matchedAccounts: 0, unmatchedAccounts: 0, totalAccounts: 0, warnings: ['לא נמצאו חשבונות גמל/השתלמות'] },
      summary: { accountCount: 0, totalBalance: 0 },
      humanSummary: 'לא נמצאו נתוני גמל או השתלמות. העלה דוח Excel או דוח הר הכסף.',
      orchestrator: { status: 'no_data', findings: [], recommendations: [] },
      durationMs: Date.now() - startedAt,
    };
  }

  const { funds: officialFunds, conflicts: sourceConflicts } = options.officialFunds
    ? { funds: options.officialFunds, conflicts: options.sourceConflicts || [] }
    : await loadOfficialFunds();
  const accountReports = [];
  const allFindings = [];
  const allRecommendations = [];
  let matchedCount = 0;

  for (const account of accounts) {
    const match = matchAccountToOfficial(account, officialFunds);
    if (match.matchConfidence >= 70) matchedCount += 1;

    const peers = officialFunds.filter(f => {
      if (account.productType === 'study_fund') return f.productType === 'study_fund';
      return f.productType === 'gemel' || f.productType === 'investment_gemel';
    });

    const feeAnalysis = analyzeAccountFees(account, match, peers);
    const returnAnalysis = analyzeAccountReturns(account, match, peers);
    const riskAnalysis = analyzeRiskSuitability(account, match, profile);
    const alternatives = rankAlternatives(account, match, officialFunds, profile);

    account.rawRiskLevel = match.matchedFund?.riskLevel;
    accountReports.push(buildAccountReport(
      account, match, feeAnalysis, returnAnalysis, riskAnalysis, alternatives, profile,
    ));

    for (const f of [...feeAnalysis.findings, ...returnAnalysis.findings, ...riskAnalysis.findings]) {
      allFindings.push({ ...f, accountId: account.accountId });
      allRecommendations.push(insightToRecommendation(f, [account.accountId]));
    }
  }

  const consolidation = analyzeConsolidation(accounts);
  for (const c of consolidation) {
    allFindings.push(c);
    allRecommendations.push(insightToRecommendation(c, c.accountIds));
  }

  let engineInsights = [];
  try {
    const engine = await runGemelRecommendationEngine(userId, { summary });
    engineInsights = engine.insights || [];
    for (const ins of engineInsights) {
      allFindings.push({
        type: ins.code,
        severity: ins.severity,
        title: ins.title,
        explanation: ins.reason,
        confidence: ins.confidence,
        accountId: ins.productId,
      });
      allRecommendations.push(insightToRecommendation({
        id: ins.id || ins.code,
        code: ins.code,
        type: ins.category,
        title: ins.title,
        explanation: ins.reason,
        severity: ins.severity,
        confidence: ins.confidence,
        possibleSavings: ins.financialImpact?.amount,
        suggestedAction: ins.suggestedAction,
        sources: ins.sources,
      }, ins.productId ? [ins.productId] : []));
    }
  } catch {
    // non-fatal
  }

  const uniqueRecs = [];
  const seen = new Set();
  for (const r of allRecommendations.sort((a, b) => {
    const sev = { critical: 4, high: 3, medium: 2, low: 1 };
    return (sev[b.severity] || 0) - (sev[a.severity] || 0);
  })) {
    const key = `${r.title}|${r.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRecs.push(r);
  }

  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const strengths = [];
  if (matchedCount === accounts.length && accounts.length) {
    strengths.push({ title: 'כל החשבונות הותאמו לנתוני שוק', explanation: `${matchedCount}/${accounts.length}` });
  }
  if (totalBalance >= 50000) {
    strengths.push({ title: 'צבירה משמעותית בגמל/השתלמות', explanation: `₪${Math.round(totalBalance).toLocaleString('he-IL')}` });
  }

  const report = {
    status: profile.missingFields.length > 2 ? 'partial' : 'success',
    generatedAt: new Date().toISOString(),
    algorithmVersion: ALGORITHM_VERSION,
    sourceReports: [
      { source: 'gemelnet', reportDate: officialFunds.find(f => f.source === 'gemelnet')?.reportDate || null },
      { source: 'data.gov.il', reportDate: officialFunds.find(f => f.source === 'data.gov.il')?.reportDate || null },
    ].filter(r => r.reportDate),
    accounts: accountReports,
    findings: allFindings,
    recommendations: uniqueRecs.slice(0, 12),
    alternatives: accountReports.flatMap(a => a.alternatives || []),
    strengths,
    risks: uniqueRecs.filter(r => ['high', 'critical'].includes(r.severity)).map(r => ({
      title: r.title,
      explanation: r.explanation,
    })),
    opportunities: uniqueRecs.filter(r => r.type !== 'missing_data').slice(0, 6).map(r => ({
      title: r.title,
      explanation: r.explanation,
    })),
    suitabilityProfile: profile,
    dataQuality: {
      matchedAccounts: matchedCount,
      unmatchedAccounts: accounts.length - matchedCount,
      totalAccounts: accounts.length,
      warnings: [
        ...profile.missingFields.map(f => `חסר: ${f}`),
        ...sourceConflicts.slice(0, 5).map(c => `סתירה בין מקורות רשמיים לקרן ${c.fundCode} (${c.field})`),
      ],
      sourceConflicts: sourceConflicts.slice(0, 20),
    },
    summary: {
      accountCount: accounts.length,
      totalBalance,
      matchedAccounts: matchedCount,
    },
    disclaimer: 'המידע מבוסס על הנתונים שהועלו ונתוני שוק רשמיים. אינו מהווה ייעוץ השקעות. תשואות עבר אינן מבטיחות תשואות עתידיות.',
  };

  const polished = await polishGemelReportSummary(report, { skipLLM: options.skipLLM });
  report.humanSummary = polished.summary;
  report.llm = polished.llm;
  report.orchestrator = buildOrchestratorPayload(report);
  report.durationMs = Date.now() - startedAt;

  return report;
}

async function importUserExcelAccounts(userId, buffer) {
  const parsed = parseUserExcelBuffer(buffer, userId);
  const persisted = [];
  for (const account of parsed.accounts) {
    const fundType = account.productType === 'study_fund' ? 'study_fund' : 'provident_fund';
    const doc = await PensionFund.create({
      user: userId,
      fundName: account.fundName,
      fundType,
      provider: account.companyName,
      accountNumber: account.accountId?.startsWith('row-') ? null : account.accountId,
      currentBalance: account.balance,
      monthlyEmployeeDeposit: account.employeeDeposit,
      monthlyEmployerDeposit: account.employerDeposit,
      monthlyDeposit: account.monthlyDeposit,
      managementFeeAccumulation: account.managementFeeBalancePct != null ? account.managementFeeBalancePct / 100 : null,
      managementFeeDeposit: account.managementFeeDepositPct != null ? account.managementFeeDepositPct / 100 : null,
      investmentTrack: account.trackName,
      isActive: account.accountStatus === 'active',
      status: account.accountStatus === 'active' ? 'active' : 'closed',
      source: 'user_excel',
      rawData: account.rawData,
    });
    persisted.push(doc);
  }
  return { ...parsed, persistedCount: persisted.length, fundIds: persisted.map(d => d._id) };
}

module.exports = {
  buildGemelAdvisorReport,
  importUserExcelAccounts,
  loadOfficialFunds,
  buildOrchestratorPayload,
  parseUserExcelBuffer,
  readGovCsvText,
};
