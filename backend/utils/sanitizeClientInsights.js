'use strict';

const { formatComparisonGroupLabel } = require('./comparisonGroupLabel');

/**
 * Remove internal benchmark keys from client-facing API payloads.
 * Keeps comparisonGroupLabel for display; raw group key stays traceable server-side only in advisory envelope.
 */
function sanitizeBenchmarkForClient(benchmark) {
  if (!benchmark || typeof benchmark !== 'object') return benchmark ?? null;

  const { group, comparisonGroupKey, ...rest } = benchmark;
  const comparisonGroupLabel = rest.comparisonGroupLabel
    || (group ? formatComparisonGroupLabel(group, null) : null);

  const out = { ...rest };
  if (comparisonGroupLabel) out.comparisonGroupLabel = comparisonGroupLabel;
  return out;
}

function sanitizeEvidenceForClient(evidence) {
  if (!evidence || typeof evidence !== 'object') return evidence ?? null;
  const out = { ...evidence };
  if (out.benchmark) {
    out.benchmark = sanitizeBenchmarkForClient(out.benchmark);
  }
  delete out.comparisonGroupKey;
  return out;
}

function sanitizeFormattedRecommendation(rec) {
  if (!rec) return rec;
  return {
    ...rec,
    evidence: sanitizeEvidenceForClient(rec.evidence),
  };
}

function sanitizePensionDisplayInsight(ins) {
  if (!ins) return ins;
  return {
    ...ins,
    benchmark: sanitizeBenchmarkForClient(ins.benchmark),
  };
}

module.exports = {
  sanitizeBenchmarkForClient,
  sanitizeEvidenceForClient,
  sanitizeFormattedRecommendation,
  sanitizePensionDisplayInsight,
};
