#!/usr/bin/env node
'use strict';

/**
 * Smoke test: Gemel Advisor with official CSV + synthetic user accounts.
 * Usage: node scripts/smoke-gemel-advisor.js [userId]
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { parseGovCsv } = require('../utils/govCsvParser');
const { normalizeDataGovRow } = require('../services/gemelAdvisor/providers/dataGovGemelProvider');
const { buildGemelAdvisorReport } = require('../services/gemelAdvisor/gemelAdvisorService');
const { emptyNormalizedAccount } = require('../services/gemelAdvisor/schemas');

const CHECKS = [];

function check(name, ok, detail = '') {
  CHECKS.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const userId = process.argv[2] || '507f1f77bcf86cd799439011';
  await mongoose.connect(process.env.MONGODB_URI);

  const csvPath = path.join(__dirname, '../data/gov/gemel-net.csv');
  check('official CSV exists', fs.existsSync(csvPath), csvPath);

  let rows = [];
  if (fs.existsSync(csvPath)) {
    const gemelSvc = require('../services/gemelAdvisor/gemelAdvisorService');
    const loaded = await gemelSvc.loadOfficialFunds();
    rows = loaded.funds.slice(0, 2000);
  }

  check('official rows parsed', rows.length > 0, String(rows.length));

  const study = rows.find(r => r.productType === 'study_fund' && r.managementFeeBalanceAvgPct != null);
  const gemel = rows.find(r => r.productType === 'gemel' && r.managementFeeBalanceAvgPct != null);

  const parsedAccounts = [];
  if (study) {
    parsedAccounts.push(emptyNormalizedAccount({
      accountId: 'smoke-study-1',
      userId,
      productType: 'study_fund',
      fundCode: study.fundCode,
      fundName: study.fundName,
      companyName: study.companyName,
      trackName: study.trackName,
      balance: 85000,
      managementFeeBalancePct: (study.managementFeeBalanceAvgPct || 0.5) + 0.25,
      accountStatus: 'active',
      source: 'smoke',
    }));
  }
  if (gemel) {
    parsedAccounts.push(emptyNormalizedAccount({
      accountId: 'smoke-gemel-1',
      userId,
      productType: 'gemel',
      fundCode: gemel.fundCode,
      fundName: gemel.fundName,
      companyName: gemel.companyName,
      trackName: gemel.trackName,
      balance: 120000,
      managementFeeBalancePct: Math.max(0.2, (gemel.managementFeeBalanceAvgPct || 0.5) - 0.1),
      accountStatus: 'active',
      source: 'smoke',
    }));
  }

  check('synthetic accounts built', parsedAccounts.length > 0, String(parsedAccounts.length));

  const report = await buildGemelAdvisorReport(userId, {
    skipLLM: true,
    parsedAccounts,
    summary: { hasData: true, hasStudyFund: true, hasProvidentFund: true },
  });

  check('report status', ['success', 'partial'].includes(report.status), report.status);
  check('accounts analyzed', report.accounts.length === parsedAccounts.length, String(report.accounts.length));
  check('orchestrator payload', !!report.orchestrator?.recommendations, String(report.orchestrator?.recommendations?.length));
  check('max 3 alternatives per account', report.accounts.every(a => (a.alternatives?.length || 0) <= 3));
  check('human summary', typeof report.humanSummary === 'string' && report.humanSummary.length > 10);
  check('data quality block', report.dataQuality != null);

  const failed = CHECKS.filter(c => !c.ok);
  console.log(`\n${CHECKS.length - failed.length}/${CHECKS.length} checks passed`);
  await mongoose.disconnect();
  process.exit(failed.length ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
