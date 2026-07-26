'use strict';

/**
 * Live Step 5 audit — hits real dev server (localhost:5000) with real MongoDB.
 * Usage: node backend/scripts/live-step5-audit.js
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const API = process.env.AUDIT_API_URL || 'http://127.0.0.1:5000';
const OUT_DIR = path.join(__dirname, 'audit-output');
const PENSION_XLSX = path.join(__dirname, '../tests/fixtures/har-hakesef/sample-report.xlsx');

async function api(method, urlPath, { token, body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let reqBody;
  if (formData) {
    reqBody = formData;
  } else if (body) {
    headers['Content-Type'] = 'application/json';
    reqBody = JSON.stringify(body);
  }
  const res = await fetch(`${API}${urlPath}`, { method, headers, body: reqBody });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

function pickAdvisoryFields(data) {
  if (!data) return null;
  return {
    recommendationEngine: data.recommendationEngine,
    analysisId: data.analysisId,
    productType: data.productType,
    recommendationCards: data.recommendationCards,
    primaryRecommendations: data.primaryRecommendations,
    accountAnalyses: data.accountAnalyses,
    threeCardMeta: data.threeCardMeta,
    dataQuality: data.dataQuality,
    marketData: data.marketData,
    llm: data.llm,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const runtime = {
    auditedAt: new Date().toISOString(),
    apiBase: API,
    USE_THREE_CARD_RECOMMENDATIONS: process.env.USE_THREE_CARD_RECOMMENDATIONS ?? '(unset → enabled)',
    NODE_ENV: process.env.NODE_ENV,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'runtime-env.json'), JSON.stringify(runtime, null, 2));

  const email = `step5-audit-${Date.now()}@finguide.local`;
  const reg = await api('POST', '/api/auth/register', {
    body: { name: 'Step5 Audit', email, password: 'Audit12345!' },
  });
  if (reg.status !== 201 && reg.status !== 200) {
    throw new Error(`Register failed: ${reg.status} ${JSON.stringify(reg.json)}`);
  }
  const token = reg.json?.data?.token;
  const userId = reg.json?.data?.user?.id;
  runtime.userId = userId;
  runtime.email = email;

  const xlsx = fs.readFileSync(PENSION_XLSX);
  const form = new FormData();
  form.append('file', new Blob([xlsx]), 'har-kesef-audit.xlsx');

  const upload = await api('POST', '/api/pension/upload-file', { token, formData: form });
  runtime.pensionUpload = { status: upload.status, imported: upload.json?.data?.imported };

  await api('PATCH', '/api/profile', {
    token,
    body: {
      personal: { age: 38 },
      retirement: { plannedRetirementAge: 67 },
      financial: { riskTolerance: 'medium' },
    },
  });

  const pensionRes = await api('GET', '/api/pension/analysis', { token });
  runtime.pensionAnalysisStatus = pensionRes.status;

  const gemelFunds = await api('GET', '/api/gemel/funds', { token });
  if (!gemelFunds.json?.data?.length) {
    await api('POST', '/api/gemel/funds', {
      token,
      body: {
        fundName: 'קרן השתלמות — בדיקת Step5',
        fundType: 'study_fund',
        provider: 'מנורה',
        currentBalance: 85000,
        managementFeeAccumulation: 0.008,
        managementFeeDeposit: 0.004,
        investmentTrack: 'כללי',
        riskLevel: 'medium',
      },
    });
  }

  const gemelRes = await api('GET', '/api/gemel/analysis', { token });
  runtime.gemelAnalysisStatus = gemelRes.status;

  const pensionPayload = pensionRes.json?.data ?? pensionRes.json;
  const gemelPayload = gemelRes.json?.data ?? gemelRes.json;

  fs.writeFileSync(path.join(OUT_DIR, 'pension-analysis-full.json'), JSON.stringify(pensionRes.json, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'gemel-analysis-full.json'), JSON.stringify(gemelRes.json, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'pension-advisory-slice.json'), JSON.stringify(pickAdvisoryFields(pensionPayload), null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'gemel-advisory-slice.json'), JSON.stringify(pickAdvisoryFields(gemelPayload), null, 2));

  runtime.pensionEngine = pensionPayload?.recommendationEngine;
  runtime.gemelEngine = gemelPayload?.recommendationEngine;
  runtime.pensionCardCount = pensionPayload?.recommendationCards?.length;
  runtime.gemelCardCount = gemelPayload?.recommendationCards?.length;
  runtime.pensionAccountAnalyses = pensionPayload?.accountAnalyses?.length;
  runtime.gemelAccountAnalyses = gemelPayload?.accountAnalyses?.length;

  fs.writeFileSync(path.join(OUT_DIR, 'runtime-summary.json'), JSON.stringify(runtime, null, 2));

  console.log(JSON.stringify(runtime, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
