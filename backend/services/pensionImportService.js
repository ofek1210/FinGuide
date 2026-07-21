

const PensionFund = require('../models/PensionFund');
const PensionImportSnapshot = require('../models/PensionImportSnapshot');
const UserProfile = require('../models/UserProfile');
const { buildPensionAnalysis } = require('./pensionAnalysisService');
const {
  extractImportSnapshotFields,
  isThreeCardAnalysis,
  sumThreeCardAnnualSavings,
} = require('./financialAdvisory/threeCardAnalysisPayload');
const { upsertImportedFunds } = require('./pensionFundMergeService');
const { saveImportSnapshot } = require('./importSnapshotService');
const { runDomainImport } = require('./domainImportService');

async function syncProfileRetirement(userId) {
  const funds = await PensionFund.find({ user: userId, status: { $ne: 'closed' }, isActive: { $ne: false } }).lean();
  const totalBalance = funds.reduce((s, f) => s + (f.currentBalance || 0), 0);
  const hasStudyFund = funds.some(f => f.fundType === 'study_fund');
  const hasPension = funds.some(f =>
    ['pension_comprehensive', 'pension_old', 'managers_insurance'].includes(f.fundType),
  );

  await UserProfile.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        'retirement.currentPensionAccumulation': totalBalance,
        'retirement.hasPension': hasPension,
        'retirement.hasStudyFund': hasStudyFund,
      },
    },
    { upsert: true },
  );
}

async function savePensionImportSnapshot(userId, source, sourceFile, analysis, fileChecksumSha256) {
  // Count ALL tracked funds (incl. gemel types) — the Har HaKesef report imports
  // them together even though the pension analysis itself excludes gemel funds.
  const fundCount = await PensionFund.countDocuments({
    user: userId,
    status: { $ne: 'closed' },
    isActive: { $ne: false },
  });
  const snapshotFields = extractImportSnapshotFields(analysis);
  await saveImportSnapshot(PensionImportSnapshot, userId, {
    source,
    sourceFile,
    fileChecksumSha256: fileChecksumSha256 || null,
    fundCount,
    ...snapshotFields,
  });
}

async function importPensionFile(userId, parsedFunds, importSource, sourceFile, fileChecksumSha256) {
  const docsPayload = parsedFunds.map(f => ({
    fundName: f.fundName,
    fundType: f.fundType,
    provider: f.provider,
    accountNumber: f.accountNumber,
    currentBalance: f.currentBalance,
    monthlyEmployeeDeposit: f.monthlyEmployeeDeposit,
    monthlyEmployerDeposit: f.monthlyEmployerDeposit,
    managementFeeAccumulation: f.managementFeeAccumulation,
    managementFeeDeposit: f.managementFeeDeposit,
    investmentTrack: f.investmentTrack,
    riskLevel: f.riskLevel,
    ytdReturn: f.ytdReturn,
    activityStatus: f.activityStatus,
    insuranceCoverages: f.insuranceCoverages,
    status: f.status || 'active',
    isActive: f.isActive !== false,
    source: importSource,
    sourceFile,
    rawData: f.rawData || null,
  }));

  return runDomainImport({
    userId,
    buildAnalysisFn: buildPensionAnalysis,
    runUpsert: () => upsertImportedFunds(userId, docsPayload, importSource, sourceFile),
    syncProfileFn: syncProfileRetirement,
    saveSnapshotFn: (uid, postAnalysis) =>
      savePensionImportSnapshot(uid, importSource, sourceFile, postAnalysis, fileChecksumSha256),
    extractSavingsDelta: (post, pre) => {
      const postSavings = isThreeCardAnalysis(post)
        ? sumThreeCardAnnualSavings(post)
        : (post.benchmark?.summary?.totalPotentialSavings || 0);
      const preSavings = isThreeCardAnalysis(pre)
        ? sumThreeCardAnnualSavings(pre)
        : (pre.benchmark?.summary?.totalPotentialSavings || 0);
      return postSavings - preSavings;
    },
    buildReturn: ({ upsert, postAnalysis, savingsDelta }) => ({
      funds: upsert.funds,
      imported: upsert.imported,
      merged: upsert.merged,
      created: upsert.created,
      analysis: postAnalysis,
      savingsDelta,
      healthScore: extractImportSnapshotFields(postAnalysis).healthScore,
    }),
  });
}

module.exports = {
  syncProfileRetirement,
  savePensionImportSnapshot,
  importPensionFile,
};
