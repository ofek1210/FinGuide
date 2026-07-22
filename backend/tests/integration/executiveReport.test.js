'use strict';

jest.mock('../../services/harHaBituachService', () => ({
  parseHarHaBituach: jest.fn(),
  isHarHaBituachBuffer: jest.fn().mockReturnValue(false),
}));

jest.mock('../../ai/agents/payslipAgent', () => ({
  runPayslipAgent: jest.fn(),
}));
jest.mock('../../ai/agents/insuranceAgent', () => ({
  runInsuranceAgent: jest.fn(),
}));
jest.mock('../../ai/agents/pensionAgent', () => ({
  runPensionAgent: jest.fn(),
}));
jest.mock('../../ai/agents/gemelAgent', () => ({
  runGemelAgent: jest.fn(),
}));
jest.mock('../../ai/agents/financialProfileAgent', () => ({
  runFinancialProfileAgent: jest.fn(),
}));
jest.mock('../../ai/services/executionCanvasService', () => ({
  buildExecutionCanvas: jest.fn(),
}));
jest.mock('../../services/financialHealthScoreService', () => ({
  buildFinancialHealthScore: jest.fn(),
}));

const request = require('supertest');
const { createDomainTestHarness } = require('../helpers/domainTestHarness');
const { runPayslipAgent } = require('../../ai/agents/payslipAgent');
const { runInsuranceAgent } = require('../../ai/agents/insuranceAgent');
const { runPensionAgent } = require('../../ai/agents/pensionAgent');
const { runGemelAgent } = require('../../ai/agents/gemelAgent');
const { runFinancialProfileAgent } = require('../../ai/agents/financialProfileAgent');
const { buildExecutionCanvas } = require('../../ai/services/executionCanvasService');
const { buildFinancialHealthScore } = require('../../services/financialHealthScoreService');
const ExecutiveReport = require('../../models/ExecutiveReport');

describe('Executive report API', () => {
  const harness = createDomainTestHarness('executive-report');

  beforeAll(() => harness.beforeAll());
  afterEach(async () => {
    jest.clearAllMocks();
    await harness.afterEach();
  });
  afterAll(() => harness.afterAll());

  function mockAgents({ payslip = 'success', insurance = 'no_data', pension = 'success' } = {}) {
    buildExecutionCanvas.mockResolvedValue({
      onboarding: { completed: true },
      summaryHe: 'פרופיל מלא',
      dataInventory: { payslips: true, pension: true },
    });
    buildFinancialHealthScore.mockResolvedValue({ score: 68, label: 'סביר' });

    runFinancialProfileAgent.mockResolvedValue({
      agentId: 'profile',
      status: 'success',
      recommendations: [{ title: 'השלימו פרופיל', type: 'profile' }],
      data: { profile: { age: 35 } },
    });

    runPayslipAgent.mockResolvedValue(
      payslip === 'no_data'
        ? { agentId: 'payslip', status: 'no_data', message: 'אין תלושים' }
        : {
          agentId: 'payslip',
          status: 'success',
          recommendations: [{
            type: 'cash',
            title: 'תזרים חודשי לחוץ',
            reason: 'הוצאות גבוהות',
            urgency: 'medium',
            financialImpact: '₪500/חודש',
          }],
          data: { payslipCount: 2 },
        },
    );

    runInsuranceAgent.mockResolvedValue(
      insurance === 'error'
        ? Promise.reject(new Error('insurance down'))
        : insurance === 'no_data'
          ? { agentId: 'insurance', status: 'no_data', message: 'אין ביטוח' }
          : {
            agentId: 'insurance',
            status: 'success',
            recommendations: [{
              type: 'duplicate',
              title: 'ביטול כפל ביטוח',
              reason: 'פרמיה כפולה',
              urgency: 'high',
              financialImpact: '₪200/חודש',
            }],
            data: { duplicateCount: 1, totalMonthlyWaste: 200 },
          },
    );

    runPensionAgent.mockResolvedValue(
      pension === 'no_data'
        ? { agentId: 'pension', status: 'no_data' }
        : {
          agentId: 'pension',
          status: 'success',
          recommendations: [{
            type: 'fee',
            title: 'הורדת דמי ניהול בפנסיה',
            reason: 'מעל השוק',
            urgency: 'high',
            financialImpact: '₪50000',
          }],
          primaryRecommendations: [],
          data: { totalBalance: 120000 },
        },
    );

    runGemelAgent.mockResolvedValue({ agentId: 'gemel', status: 'no_data', message: 'אין גמל' });
  }

  it('POST /api/executive/report returns all sections and caches by runId', async () => {
    mockAgents({ insurance: 'success' });
    const app = harness.getApp();
    const { token, userId } = await harness.register();

    const res = await request(app)
      .post('/api/executive/report?skipLLM=true')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.runId).toBeTruthy();

    const { report } = res.body.data;
    expect(report.sections.executiveSummary).toBeTruthy();
    expect(report.meta.reportVersion).toBe('2.1.0');
    expect(report.sections.agentReport.agentSections).toHaveLength(4);
    expect(report.sections.agentReport.agentSections.find(s => s.agentId === 'pension').dataStatus).toBe('available');
    expect(report.sections.preservedRecommendations.length).toBeGreaterThan(0);

    const cached = await ExecutiveReport.findOne({ runId: res.body.data.runId, user: userId });
    expect(cached).toBeTruthy();
    expect(cached.report.sections.agentReport).toBeTruthy();
  });

  it('GET /api/executive/report/pdf uses cached report without re-running agents', async () => {
    mockAgents();
    const app = harness.getApp();
    const { token } = await harness.register();

    const gen = await request(app)
      .post('/api/executive/report?skipLLM=true')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const runId = gen.body.data.runId;
    jest.clearAllMocks();

    const pdfRes = await request(app)
      .get(`/api/executive/report/pdf?runId=${runId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(pdfRes.statusCode).toBe(200);
    expect(pdfRes.headers['content-type']).toMatch(/pdf/);
    expect(pdfRes.body.slice(0, 4).toString()).toBe('%PDF');
    expect(runPayslipAgent).not.toHaveBeenCalled();
    expect(runPensionAgent).not.toHaveBeenCalled();
  });

  it('continues when insurance agent fails', async () => {
    mockAgents({ insurance: 'error' });
    const app = harness.getApp();
    const { token } = await harness.register();

    const res = await request(app)
      .post('/api/executive/report?skipLLM=true')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.statusCode).toBe(200);
    expect(res.body.data.report.sections.executiveSummary).toBeTruthy();
    expect(res.body.data.meta.agentStatuses.insurance).toBe('error');
  });

  it('GET /api/executive/report/latest returns the last saved report without re-running agents', async () => {
    mockAgents();
    const app = harness.getApp();
    const { token } = await harness.register();

    const emptyRes = await request(app)
      .get('/api/executive/report/latest')
      .set('Authorization', `Bearer ${token}`);
    expect(emptyRes.statusCode).toBe(200);
    expect(emptyRes.body.success).toBe(true);
    expect(emptyRes.body.data).toBeNull();

    const gen = await request(app)
      .post('/api/executive/report?skipLLM=true')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    const runId = gen.body.data.runId;
    jest.clearAllMocks();

    const res = await request(app)
      .get('/api/executive/report/latest')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.runId).toBe(runId);
    expect(res.body.data.savedAt).toBeTruthy();
    expect(res.body.data.report.sections.executiveSummary).toBeTruthy();
    expect(runPayslipAgent).not.toHaveBeenCalled();
    expect(runPensionAgent).not.toHaveBeenCalled();
  });

  it('does not expose another user\'s latest report', async () => {
    mockAgents();
    const app = harness.getApp();
    const { token } = await harness.register();

    await request(app)
      .post('/api/executive/report?skipLLM=true')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const { token: otherToken } = await harness.register();
    const res = await request(app)
      .get('/api/executive/report/latest')
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('returns 400 when PDF requested without runId', async () => {
    const app = harness.getApp();
    const { token } = await harness.register();

    const res = await request(app)
      .get('/api/executive/report/pdf')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(400);
  });
});
