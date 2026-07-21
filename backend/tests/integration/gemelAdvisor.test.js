'use strict';

jest.mock('../../services/harHaBituachService', () => ({
  parseHarHaBituach: jest.fn(),
  isHarHaBituachBuffer: jest.fn().mockReturnValue(false),
}));

jest.mock('../../services/gemelAdvisor/gemelLlmService', () => ({
  polishGemelReportSummary: jest.fn(async () => ({
    summary: 'סיכום דטרמיניסטי',
    llm: { used: false },
  })),
}));

const request = require('supertest');
const path = require('path');
const XLSX = require('xlsx');
const { createDomainTestHarness } = require('../helpers/domainTestHarness');
const PensionFund = require('../../models/PensionFund');
const GemelNetFund = require('../../models/GemelNetFund');
const { normalizeDataGovRow } = require('../../services/gemelAdvisor/providers/dataGovGemelProvider');

describe('Gemel advisor API', () => {
  const harness = createDomainTestHarness('gemel-advisor');

  beforeAll(() => harness.beforeAll());
  afterEach(async () => harness.afterEach());
  afterAll(() => harness.afterAll());

  async function seedMarketFund() {
    const row = normalizeDataGovRow({
      FUND_ID: '501',
      FUND_NAME: 'מסלול בדיקה',
      MANAGING_CORPORATION: 'בדיקה גמל',
      FUND_CLASSIFICATION: 'קרנות השתלמות',
      SPECIALIZATION: 'כללי',
      REPORT_PERIOD: '202401',
      AVG_ANNUAL_MANAGEMENT_FEE: 0.55,
      AVG_DEPOSIT_FEE: 0.4,
      AVG_ANNUAL_YIELD_TRAILING_5YRS: 4.9,
      SHARPE_RATIO: 0.5,
      STOCK_MARKET_EXPOSURE: 35,
    });
    await GemelNetFund.create({
      ID: row.fundCode,
      SHM_KRN: row.fundName,
      SHM_TAAGID_MENAEL: row.companyName,
      SUG_KRN: 'קרנות השתלמות',
      SPECIALIZATION: 'כללי',
      TKUFAT_DUACH: 202401,
      SHIUR_D_NIHUL_AHARON_TTVURAH: 0.55,
      TSUA_SHNATIT_MEMUZAAT_5_SHANIM: 4.9,
      SHARPE_RATIO: 0.5,
      CHSHIF_MNUIOT: 35,
    });
    return row;
  }

  it('POST /api/gemel/analyze returns structured report with orchestrator payload', async () => {
    const { token, userId } = await harness.register();
    await seedMarketFund();
    await PensionFund.create({
      user: userId,
      fundName: 'מסלול בדיקה',
      fundType: 'study_fund',
      provider: 'בדיקה גמל',
      rawData: { fundCode: '501' },
      currentBalance: 45000,
      managementFeeAccumulation: 0.0075,
      managementFeeDeposit: 0.004,
      investmentTrack: 'כללי',
      source: 'manual',
      status: 'active',
      isActive: true,
    });

    const res = await request(harness.getApp())
      .post('/api/gemel/analyze?skipLLM=true')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.runId).toMatch(/^gemel_/);
    const report = res.body.data.report;
    expect(report.status).toMatch(/success|partial/);
    expect(report.accounts.length).toBeGreaterThanOrEqual(1);
    expect(report.orchestrator.recommendations).toBeDefined();
    expect(Array.isArray(report.alternatives)).toBe(true);
  });

  it('GET /api/gemel/report/pdf returns PDF for cached runId', async () => {
    const { token, userId } = await harness.register();
    await seedMarketFund();
    await PensionFund.create({
      user: userId,
      fundName: 'מסלול בדיקה',
      fundType: 'study_fund',
      provider: 'בדיקה גמל',
      rawData: { fundCode: '501' },
      currentBalance: 20000,
      source: 'manual',
      status: 'active',
      isActive: true,
    });

    const analyzeRes = await request(harness.getApp())
      .post('/api/gemel/analyze?skipLLM=true')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const runId = analyzeRes.body.data.runId;
    const pdfRes = await request(harness.getApp())
      .get(`/api/gemel/report/pdf?runId=${runId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toMatch(/pdf/);
    expect(pdfRes.body.length).toBeGreaterThan(100);
  });

  it('POST /api/gemel/upload accepts Excel and persists holdings', async () => {
    const { token } = await harness.register();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Account', 'Fund Name', 'Company', 'Product Type', 'Balance', 'Mgmt Fee Balance'],
      ['A1', 'Test Fund', 'Acme', 'קרן השתלמות', '12500', '0.65'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Gemel');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const res = await request(harness.getApp())
      .post('/api/gemel/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buf, { filename: 'gemel-test.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    if (res.status !== 201) {
      throw new Error(`upload failed: ${res.status} ${JSON.stringify(res.body)}`);
    }

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.imported).toBeGreaterThanOrEqual(1);
  });
});
