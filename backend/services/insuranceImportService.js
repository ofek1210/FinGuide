

const InsurancePolicy = require('../models/InsurancePolicy');
const InsuranceImportSnapshot = require('../models/InsuranceImportSnapshot');
const UserProfile = require('../models/UserProfile');
const { buildInsuranceAnalysis } = require('./insuranceAnalysisService');
const { upsertImportedPolicies } = require('./insurancePolicyMergeService');
const { saveImportSnapshot } = require('./importSnapshotService');
const { runDomainImport } = require('./domainImportService');

async function syncProfileInsurance(userId) {
  const policies = await InsurancePolicy.find({ user: userId, status: 'active' }).lean();
  const activeByType = {};
  policies.forEach(pol => {
    if (!activeByType[pol.type]) activeByType[pol.type] = [];
    activeByType[pol.type].push(pol);
  });

  await UserProfile.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        'insurance.hasLifeInsurance': Boolean(activeByType.life?.length),
        'insurance.hasHealthInsurance': Boolean(activeByType.health?.length),
        'insurance.hasDisabilityInsurance': Boolean(activeByType.disability?.length),
        'insurance.hasApartmentInsurance': Boolean(activeByType.apartment?.length),
        'insurance.hasCarInsurance': Boolean(activeByType.car?.length),
      },
    },
    { upsert: true },
  );
}

async function saveInsuranceImportSnapshot(userId, sourceFile, analysis, fileChecksumSha256) {
  await saveImportSnapshot(InsuranceImportSnapshot, userId, {
    sourceFile,
    fileChecksumSha256: fileChecksumSha256 || null,
    policyCount: analysis?.summary?.policyCount ?? 0,
    duplicateCount: analysis?.analysis?.duplicateCount ?? 0,
    totalMonthlyWaste: analysis?.analysis?.totalMonthlyWaste ?? 0,
    healthScore: analysis?.healthCheck?.score ?? null,
    annualSavings: analysis?.analysis?.savings?.annualSavings ?? 0,
  });
}

async function importInsuranceExcel(userId, parsedPolicies, sourceFile, fileChecksumSha256) {
  return runDomainImport({
    userId,
    buildAnalysisFn: buildInsuranceAnalysis,
    runUpsert: () => upsertImportedPolicies(userId, parsedPolicies, sourceFile),
    syncProfileFn: syncProfileInsurance,
    saveSnapshotFn: (uid, postAnalysis) =>
      saveInsuranceImportSnapshot(uid, sourceFile, postAnalysis, fileChecksumSha256),
    extractSavingsDelta: (post, pre) =>
      (post.analysis?.savings?.annualSavings || 0)
      - (pre.analysis?.savings?.annualSavings || 0),
    buildReturn: ({ upsert, postAnalysis, savingsDelta }) => ({
      policies: upsert.policies,
      imported: upsert.imported,
      merged: upsert.merged,
      created: upsert.created,
      analysis: postAnalysis,
      savingsDelta,
      healthScore: postAnalysis.healthCheck?.score ?? null,
    }),
  });
}

module.exports = {
  syncProfileInsurance,
  saveInsuranceImportSnapshot,
  importInsuranceExcel,
  buildInsuranceAnalysis,
};
