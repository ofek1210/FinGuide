'use strict';

/**
 * Live smoke test for Financial Executive Orchestrator.
 * Usage: node scripts/smoke-executive-report.js [userId] [port]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const USER_ID = process.argv[2] || '69a738de80b8dac7ec75aba8';
const PORT = process.argv[3] || process.env.PORT || 5000;
const BASE = `http://127.0.0.1:${PORT}`;

const AGENT_KEYS = ['onboarding', 'payslip', 'insurance', 'pension', 'gemel'];
const SECTION_KEYS = [
  'title',
  'executiveSummary',
  'agentReport',
  'preservedRecommendations',
];

function hebrewRatio(text) {
  const s = String(text || '');
  if (!s.length) return 0;
  const he = (s.match(/[\u0590-\u05FF]/g) || []).length;
  return he / s.length;
}

function assert(cond, msg, results) {
  if (cond) results.passed.push(msg);
  else results.failed.push(msg);
}

async function parsePdfText(buffer) {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch {
    return null;
  }
}

async function main() {
  const results = { passed: [], failed: [], warnings: [], samples: {} };

  if (!process.env.JWT_SECRET) {
    results.failed.push('JWT_SECRET missing from .env');
    printReport(results);
    process.exit(1);
  }

  const token = jwt.sign({ id: USER_ID }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });

  // Health check
  let healthOk = false;
  try {
    const r = await fetch(`${BASE}/api/health`).catch(() => null);
    healthOk = r?.ok;
  } catch { /* ignore */ }
  assert(healthOk, `Backend reachable at ${BASE}`, results);

  const started = Date.now();
  const reportRes = await fetch(`${BASE}/api/executive/report?skipLLM=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  assert(reportRes.status === 200, `POST /api/executive/report → ${reportRes.status}`, results);

  const body = await reportRes.json();
  results.samples.reportMeta = body?.data?.meta;
  results.samples.agentOutputs = body?.data?.report?.agentOutputs;

  const report = body?.data?.report;
  const runId = body?.data?.runId;

  assert(!!report, 'Response contains report object', results);
  assert(!!runId, 'Response contains runId', results);

  // Agent collection status
  const agentStatuses = {};
  for (const key of AGENT_KEYS) {
    const pkg = report?.agentOutputs?.[key];
    const status = pkg?.status || body?.data?.meta?.agentStatuses?.[key] || 'missing';
    agentStatuses[key] = status;
    if (status === 'success') results.passed.push(`Agent ${key}: data found (success)`);
    else if (status === 'no_data') results.warnings.push(`Agent ${key}: no_data`);
    else if (status === 'error') results.failed.push(`Agent ${key}: error`);
    else results.warnings.push(`Agent ${key}: ${status}`);
  }
  results.samples.agentStatuses = agentStatuses;

  // 7 sections
  for (const key of SECTION_KEYS) {
    assert(report?.sections?.[key] != null, `Section present: ${key}`, results);
  }

  const summary = report?.sections?.executiveSummary || '';
  assert(summary.length >= 50, 'Executive summary has substance (≥50 chars)', results);
  assert(hebrewRatio(summary) > 0.3, 'Executive summary is primarily Hebrew', results);

  const agentReport = report?.sections?.agentReport;
  assert(agentReport?.agentSections?.length === 4, 'All four specialist agents appear in report', results);

  for (const section of (agentReport?.agentSections || [])) {
    assert(['available', 'missing', 'error'].includes(section.dataStatus), `${section.agentId} has dataStatus`, results);
    assert(['hasRecommendations', 'noRecommendations', 'unavailable'].includes(section.recommendationStatus), `${section.agentId} has recommendationStatus`, results);
    if (section.dataStatus === 'missing' || section.dataStatus === 'error' || section.recommendationStatus === 'noRecommendations') {
      assert(!!section.statusMessage, `${section.agentId} has status message (no empty heading)`, results);
    }
  }

  const preserved = report?.sections?.preservedRecommendations || [];
  for (const [i, rec] of preserved.entries()) {
    assert(rec.agentId && rec.title, `Preserved recommendation #${i + 1} has agentId and title`, results);
  }

  const forbiddenUrgency = ['בקרוב', 'בטווח של 3 חודשים', 'עד 30 יום', 'דחוף'];
  const reportJson = JSON.stringify(report?.sections || {});
  for (const label of forbiddenUrgency) {
    assert(!reportJson.includes(label), `Report does not contain unsupported urgency "${label}"`, results);
  }

  // Cross-agent merge heuristic
  const allRecs = preserved;
  const mergedInsuranceCash = allRecs.some(a =>
    /ביטוח|פרמיה/i.test(a.title + (a.description || '')) && /תזרים|מזומן/i.test(a.description || ''),
  );
  if (agentStatuses.insurance === 'success' && agentStatuses.payslip === 'success') {
    if (mergedInsuranceCash) results.passed.push('Cross-agent: insurance/cash-flow merge detected');
    else results.warnings.push('Cross-agent: no insurance+cash-flow merge found (may be OK if no overlap)');
  }

  // Conflicts section optional
  if (report?.sections?.conflicts?.length) {
    results.passed.push(`Conflict resolution: ${report.sections.conflicts.length} conflict(s) surfaced`);
  }

  results.samples.topActions = (agentReport?.whatToDo || []).slice(0, 3).map(a => ({
    title: a.title,
    action: a.action,
    agentId: a.agentId,
  }));

  // PDF via cached runId
  const pdfRes = await fetch(`${BASE}/api/executive/report/pdf?runId=${encodeURIComponent(runId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(pdfRes.status === 200, `GET /api/executive/report/pdf → ${pdfRes.status}`, results);
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  assert(pdfBuf.length > 1000, `PDF size reasonable (${pdfBuf.length} bytes)`, results);
  assert(pdfBuf.slice(0, 4).toString() === '%PDF', 'PDF magic bytes valid', results);

  const pdfText = await parsePdfText(pdfBuf);
  if (pdfText) {
    assert(hebrewRatio(pdfText) > 0.2 || pdfBuf.includes(Buffer.from('פנס', 'utf8')), 'PDF contains Hebrew text', results);
    assert(
      /סיכום|פעולות|FinGuide/i.test(pdfText) || pdfBuf.includes(Buffer.from('FinGuide', 'utf8')),
      'PDF contains expected content markers',
      results,
    );
    const titleFragment = (agentReport?.whatToDo?.[0]?.title || preserved[0]?.title || '').slice(0, 6);
    if (titleFragment) {
      const titleOk = pdfText.includes(titleFragment)
        || pdfBuf.includes(Buffer.from(titleFragment.slice(0, 4), 'utf8'));
      assert(titleOk, 'PDF top action title matches web report (content bytes)', results);
    }
    results.samples.pdfTextPreview = pdfText.slice(0, 400);
  } else {
    results.warnings.push('pdf-parse unavailable — skipped PDF text validation');
  }

  // PDF without runId should fail
  const badPdf = await fetch(`${BASE}/api/executive/report/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(badPdf.status === 400, 'PDF without runId returns 400', results);

  results.samples.durationMs = Date.now() - started;

  const outDir = path.join(__dirname, 'live-verify-output');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `executive-report-${USER_ID}.json`), JSON.stringify(body, null, 2));
  fs.writeFileSync(path.join(outDir, `executive-report-${USER_ID}.pdf`), pdfBuf);

  printReport(results);
  process.exit(results.failed.length ? 1 : 0);
}

function printReport(results) {
  console.log('\n=== Executive Orchestrator Smoke Test ===\n');
  console.log('PASSED:', results.passed.length);
  results.passed.forEach(p => console.log('  ✓', p));
  console.log('\nWARNINGS:', results.warnings.length);
  results.warnings.forEach(w => console.log('  ⚠', w));
  console.log('\nFAILED:', results.failed.length);
  results.failed.forEach(f => console.log('  ✗', f));
  console.log('\nSAMPLES:', JSON.stringify(results.samples, null, 2));
}

main().catch(err => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
