

const PensionFund = require('../models/PensionFund');
const PensionDeposit = require('../models/PensionDeposit');
const { buildPensionAnalysis } = require('./pensionAnalysisService');
const { upsertImportedFunds } = require('./pensionFundMergeService');
const {
  importPensionFile,
  syncProfileRetirement,
  savePensionImportSnapshot,
} = require('./pensionImportService');

function fundPayloadFromClearinghouse(f, sourceFile) {
  return {
    fundName: f.fundName,
    fundType: f.fundType,
    provider: f.provider,
    accountNumber: f.accountNumber,
    currentBalance: f.currentBalance,
    monthlyEmployeeDeposit: f.monthlyEmployeeDeposit ?? null,
    monthlyEmployerDeposit: f.monthlyEmployerDeposit ?? null,
    managementFeeAccumulation: f.managementFeeAccumulation,
    managementFeeDeposit: f.managementFeeDeposit,
    investmentTrack: f.investmentTrack ?? null,
    riskLevel: f.riskLevel ?? null,
    ytdReturn: f.ytdReturn ?? null,
    activityStatus: f.activityStatus || 'UNKNOWN',
    insuranceCoverages: f.insuranceCoverages || [],
    status: f.status || 'active',
    isActive: f.isActive !== false,
    source: 'clearinghouse',
    sourceFile,
    rawData: f.rawData || null,
  };
}

async function saveDepositsForFunds(userId, parsed, fundDocs, sourceFile) {
  const byAccount = new Map(
    fundDocs
      .filter(f => f.accountNumber)
      .map(f => [String(f.accountNumber).trim(), f]),
  );

  const depositRows = [];
  for (const fund of parsed.funds || []) {
    for (const dep of fund.deposits || []) {
      const linked = byAccount.get(String(dep.accountNumber).trim());
      depositRows.push({
        user: userId,
        fund: linked?._id ?? null,
        accountNumber: dep.accountNumber,
        valueDate: dep.valueDate,
        salaryMonth: dep.salaryMonth,
        employerName: dep.employerName,
        employeeDeposit: dep.employeeDeposit ?? 0,
        employerDeposit: dep.employerDeposit ?? 0,
        severanceDeposit: dep.severanceDeposit ?? 0,
        source: 'clearinghouse',
        sourceFile,
      });
    }
  }

  if (!depositRows.length) return { saved: 0 };

  await PensionDeposit.deleteMany({ user: userId, source: 'clearinghouse', sourceFile });
  await PensionDeposit.insertMany(depositRows);
  return { saved: depositRows.length };
}

/**
 * Full import from official clearinghouse Excel (Option B).
 */
async function importClearinghouseFile(userId, parsed, sourceFile) {
  const payloads = (parsed.funds || []).map(f => fundPayloadFromClearinghouse(f, sourceFile));
  const result = await importPensionFile(userId, payloads, 'clearinghouse', sourceFile);
  const fundDocs = result.funds || [];
  const depositResult = await saveDepositsForFunds(userId, parsed, fundDocs, sourceFile);

  return {
    ...result,
    depositsSaved: depositResult.saved,
  };
}

/**
 * Save manually completed funds from Option A free-report wizard.
 */
async function importManualFundsFromPreview(userId, entries, sourceFile = 'manual_wizard') {
  const payloads = (entries || []).map(entry => ({
    fundName: entry.fundName,
    fundType: entry.fundType || 'pension_comprehensive',
    provider: entry.provider || null,
    accountNumber: entry.accountNumber || null,
    currentBalance: Number(entry.currentBalance) || 0,
    investmentTrack: entry.investmentTrack || null,
    activityStatus: entry.activityStatus || 'ACTIVE',
    status: entry.activityStatus === 'INACTIVE' ? 'closed' : 'active',
    isActive: entry.activityStatus !== 'INACTIVE',
    source: 'free_report',
    sourceFile,
  }));

  if (!payloads.length) {
    return { imported: 0, funds: [], analysis: await buildPensionAnalysis(userId) };
  }

  return importPensionFile(userId, payloads, 'free_report', sourceFile);
}

module.exports = {
  importClearinghouseFile,
  importManualFundsFromPreview,
  fundPayloadFromClearinghouse,
};
