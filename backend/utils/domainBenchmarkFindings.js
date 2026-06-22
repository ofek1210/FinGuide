'use strict';

/**
 * Shared template for domain benchmark findings (pension, insurance).
 */
function buildDomainBenchmarkFindings(analysis, config) {
  if (!config.hasData(analysis)) return [];

  const findings = [];
  const { healthCheck, recommendations } = analysis;

  if (healthCheck?.score != null && healthCheck.score < 50 && config.healthLow) {
    findings.push({
      id: config.healthLow.id,
      title: config.healthLow.title,
      severity: 'warning',
      details: `ציון ${healthCheck.score}/100 — ${healthCheck.level?.label || 'דורש טיפול'}.`,
      meta: {
        findingKind: config.healthLow.findingKind,
        score: healthCheck.score,
      },
    });
  }

  if (config.extraFindings) {
    for (const item of config.extraFindings(analysis)) {
      findings.push(item);
    }
  }

  const seenTitles = new Set();
  const recFilter = config.fromRecommendations?.filter;
  const kindMap = config.fromRecommendations?.kindMap || {};
  const defaultKind = config.fromRecommendations?.defaultKind;

  for (const rec of recommendations || []) {
    if (recFilter && !recFilter(rec)) continue;
    if (seenTitles.has(rec.title)) continue;
    seenTitles.add(rec.title);

    const severity = rec.urgency === 'high' ? 'warning' : 'info';
    const meta = { findingKind: kindMap[rec.type] || defaultKind || rec.type };
    if (config.fromRecommendations?.meta) {
      Object.assign(meta, config.fromRecommendations.meta(analysis, rec));
    }

    findings.push({
      id: `${rec.type}_${seenTitles.size}`,
      title: rec.title,
      severity,
      details: rec.financialImpact || rec.reason,
      meta,
    });
  }

  return findings;
}

async function buildDomainBenchmarkFindingsForUser(userId, buildAnalysis, config) {
  try {
    const analysis = await buildAnalysis(userId);
    return buildDomainBenchmarkFindings(analysis, config);
  } catch {
    return [];
  }
}

module.exports = { buildDomainBenchmarkFindings, buildDomainBenchmarkFindingsForUser };
