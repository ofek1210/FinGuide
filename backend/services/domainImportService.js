'use strict';

/**
 * Shared gov-report import orchestration: pre-analysis → upsert → sync → post-analysis → snapshot.
 */
async function runDomainImport({
  userId,
  buildAnalysisFn,
  runUpsert,
  syncProfileFn,
  saveSnapshotFn,
  extractSavingsDelta,
  buildReturn,
}) {
  const preAnalysis = await buildAnalysisFn(userId);
  const upsert = await runUpsert();
  await syncProfileFn(userId);
  const postAnalysis = await buildAnalysisFn(userId);
  await saveSnapshotFn(userId, postAnalysis);
  const savingsDelta = extractSavingsDelta(postAnalysis, preAnalysis);
  return buildReturn({ upsert, postAnalysis, savingsDelta });
}

module.exports = { runDomainImport };
