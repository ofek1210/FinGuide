/**
 * ============================================================================
 * FULL-SYSTEM USER JOURNEY ("Grand Tour")
 * ============================================================================
 *
 * A single sequential journey that follows ONE user through the entire
 * platform, end to end. Every step depends on the state produced by the
 * previous one, so a failure pinpoints exactly where in the system the
 * chain breaks.
 *
 *   ┌────────────┐   ┌────────┐   ┌────────────┐   ┌──────────────────┐
 *   │ 1 Register │──▶│ 2 Login│──▶│ 3 Onboard  │──▶│ 4 Upload payslip │
 *   └────────────┘   └────────┘   └────────────┘   └────────┬─────────┘
 *                                                            ▼
 *   ┌──────────────┐   ┌────────────┐   ┌───────────┐   ┌──────────────┐
 *   │ 8 Pension xls│◀──│ 7 Forecast │◀──│ 6 Findings│◀──│ 5 History +  │
 *   └──────┬───────┘   └────────────┘   └───────────┘   │   serializer │
 *          ▼                                            └──────────────┘
 *   ┌───────────────┐   ┌─────────────┐   ┌─────────┐   ┌──────────────┐
 *   │ 9 Insurance   │──▶│ 10 Dashboard│──▶│ 11 Chat │──▶│ 12 Full AI + │
 *   │    xls        │   │    summary  │   │         │   │ 13 Email     │
 *   └───────────────┘   └─────────────┘   └─────────┘   └──────────────┘
 *
 * Layers exercised for real: routes → middleware (auth/multer/rate-limit)
 * → controllers → services → Mongoose models (in-memory MongoDB) →
 * serializers. Only the true external boundaries are mocked:
 *
 *   - payslipOcr.extractPayslipFile  (tesseract/poppler system binaries)
 *   - claudeChatService              (external LLM)
 *   - summaryEmailService            (SMTP)
 *
 * Run: npx jest tests/integration/fullSystem.journey.test.js --verbose
 * ============================================================================
 */

// --- External boundary mocks (everything else is the real pipeline) --------

// LLM provider boundary: the advisory/insight formatters call an external
// model (Ollama/Claude) with a 30s network timeout. Resolve null so every
// engine takes its deterministic rule-based fallback path.
jest.mock('../../services/aiProviderService', () => ({
  ...jest.requireActual('../../services/aiProviderService'),
  analyzeWithAI: jest.fn().mockResolvedValue(null),
  callAI: jest.fn().mockResolvedValue(null),
}));

// OCR boundary: pretend tesseract extracted a canonical March-2026 payslip.
// The rest of the document pipeline (checksum, normalization, zod validation,
// duplicate guard, serializer) runs for real on this payload.
jest.mock('../../services/payslipOcr', () => ({
  ...jest.requireActual('../../services/payslipOcr'),
  extractPayslipFile: jest.fn().mockResolvedValue({
    data: {
      schema_version: '1.9',
      period: { month: '2026-03', year: 2026 },
      salary: { gross_total: 15000, net_payable: 11000 },
      deductions: { mandatory: { income_tax: 1200, national_insurance: 600, health_insurance: 450 } },
      contributions: {
        // Canonical keys emitted by payslipOcrContributions.js
        pension: { base: 15000, employee: 900, employer: 975, severance: 1245, employeeRate: 6, employerRate: 6.5 },
        study: { base: 15000, employee: 375, employer: 1125 },
      },
      summary: { grossSalary: 15000, netSalary: 11000, tax: 1200 },
      raw: { rawText: 'OCR-INTERNAL-TEXT-MUST-NEVER-REACH-CLIENT' },
    },
  }),
}));

// LLM boundary: deterministic chat answer instead of a live Claude/Ollama call.
jest.mock('../../services/claudeChatService', () => ({
  chat: jest.fn().mockResolvedValue({
    answer: 'תשובת בדיקה מהעוזר הפיננסי',
    source: 'claude',
    model: 'test-model',
    tokensUsed: 10,
  }),
  streamChat: jest.fn(),
  askClaude: jest.fn(),
  LLM_UNAVAILABLE_MESSAGE: 'העוזר לא זמין כרגע.',
}));

// SMTP boundary: capture the summary email instead of sending it.
jest.mock('../../services/summaryEmailService', () => ({
  sendSummaryEmail: jest.fn().mockImplementation(async user => ({
    sentTo: user.email,
    payslipInsights: 0,
    insuranceInsights: 0,
    pensionInsights: 0,
  })),
  buildWhatsAppShareUrl: jest.fn().mockReturnValue('https://wa.me/?text=test'),
}));

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { createDomainTestHarness } = require('../helpers/domainTestHarness');
const { buildHarBituachExcel } = require('../fixtures/buildHarBituachExcel');
const User = require('../../models/User');
const UserProfile = require('../../models/UserProfile');
const Document = require('../../models/Document');

const PAYSLIP_FIXTURE = path.join(__dirname, '../fixtures/sample.pdf');
const PENSION_FIXTURE = path.join(__dirname, '../fixtures/har-hakesef/sample-report.xlsx');

describe('Full-system journey: one user, entire platform', () => {
  const harness = createDomainTestHarness('journey', { mockAi: true });

  // Shared journey state — each step feeds the next.
  let app;
  let email;
  let userId;
  let token; // refreshed by the login step to prove the login-issued token works
  let documentId;
  let conversationId;

  beforeAll(async () => {
    process.env.CHAT_PROVIDER = 'claude';
    await harness.beforeAll();
    app = harness.getApp();
  });

  // NOTE: deliberately NO afterEach(clearAllCollections) — the journey is one
  // continuous user whose state must survive across steps.
  afterAll(() => harness.afterAll());

  const auth = req => req.set('Authorization', `Bearer ${token}`);

  // ── Step 1: Registration ──────────────────────────────────────────────────
  it('1. registers a new user and stores a hashed password', async () => {
    ({ token, userId, email } = await harness.register());
    expect(token).toBeTruthy();
    expect(userId).toBeTruthy();

    const dbUser = await User.findById(userId).select('+password');
    expect(dbUser.email).toBe(email);
    expect(dbUser.password).not.toBe('Test123'); // bcrypt pre-save hook ran
    expect(dbUser.onboarding.completed).toBe(false);
  });

  // ── Step 2: Login + session hydration ────────────────────────────────────
  it('2. logs in and hydrates the session via /me', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Test123' });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.data.token).toBeTruthy();
    token = loginRes.body.data.token; // rest of the journey rides on this token

    const meRes = await auth(request(app).get('/api/auth/me'));
    expect(meRes.statusCode).toBe(200);
    expect(meRes.body.data.user.email).toBe(email);
  });

  // ── Step 3: Onboarding ───────────────────────────────────────────────────
  it('3. completes onboarding, flipping the User flag and creating a UserProfile', async () => {
    const emptyRes = await auth(request(app).get('/api/onboarding'));
    expect(emptyRes.statusCode).toBe(200);
    expect(emptyRes.body.data.completed).toBe(false);

    const completeRes = await auth(request(app).post('/api/onboarding/complete')).send({
      data: {
        personal: { age: 30, maritalStatus: 'married', childrenCount: 1 },
        employment: {
          salaryType: 'global',
          expectedMonthlyGross: 15000,
          jobPercentage: 100,
          isPrimaryJob: true,
          hasMultipleEmployers: false,
          employmentStartDate: '2020-01-01',
        },
        retirement: { hasPension: true, hasStudyFund: true },
        assets: { ownsCar: true, ownsApartment: false, hasMortgage: false },
        insurance: { hasLifeInsurance: false, hasHealthInsurance: true },
      },
    });
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.body.data.completed).toBe(true);

    const dbUser = await User.findById(userId);
    expect(dbUser.onboarding.completed).toBe(true);
    const profile = await UserProfile.findOne({ user: userId });
    expect(profile.personal.age).toBe(30);
  });

  // ── Step 4: Payslip upload through the real document pipeline ────────────
  it('4. uploads a payslip PDF: multer → checksum → OCR → validation → completed', async () => {
    const res = await auth(request(app).post('/api/documents/upload'))
      .field('category', 'payslip')
      .field('periodMonth', '3')
      .field('periodYear', '2026')
      .attach('document', PAYSLIP_FIXTURE);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.status).toBe('completed'); // zod schema validation passed
    documentId = res.body.data._id;

    const dbDoc = await Document.findById(documentId);
    expect(dbDoc.analysisData.schema_version).toBe('1.9');
    expect(dbDoc.analysisData.salary.gross_total).toBe(15000);
    expect(dbDoc.checksumSha256).toBeTruthy(); // real checksum of the fixture file
  });

  // ── Step 4b: Business rule — duplicate period is rejected ────────────────
  it('4b. rejects a second payslip for the same period (409 duplicate guard)', async () => {
    const res = await auth(request(app).post('/api/documents/upload'))
      .field('category', 'payslip')
      .field('periodMonth', '3')
      .field('periodYear', '2026')
      .attach('document', PAYSLIP_FIXTURE);

    expect(res.statusCode).toBe(409);
    expect((await Document.countDocuments({ user: userId }))).toBe(1);
  });

  // ── Step 5: Serializer boundary — raw OCR text never reaches the client ──
  it('5. serves the document with OCR internals stripped by the serializer', async () => {
    const res = await auth(request(app).get(`/api/documents/${documentId}`));
    expect(res.statusCode).toBe(200);
    expect(res.body.data.analysisData.salary.gross_total).toBe(15000);
    expect(res.body.data.analysisData.raw?.rawText).toBeUndefined();
    expect(res.body.data.filePath).toBeUndefined();
    expect(res.body.data.checksumSha256).toBeUndefined();
  });

  // ── Step 6: Findings engine reads the uploaded payslip ───────────────────
  it('6. computes findings from the stored payslip + onboarding answers', async () => {
    const res = await auth(request(app).get('/api/findings'));
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // ── Step 7: Savings forecast sources contributions from the document ─────
  it('7. builds a savings forecast from the payslip pension contributions', async () => {
    const res = await auth(request(app).post('/api/findings/savings-forecast')).send({
      currentBalance: 100000,
      currentAge: 30,
      retirementAge: 67,
      adjustedMonthlyContribution: 2500,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.meta.contributionSource).toBe('document'); // came from step 4
    expect(res.body.data.meta.sourceDocumentId).toBe(String(documentId));
    expect(res.body.data.currentScenario.projectedBalance).toBeGreaterThan(100000);
    expect(res.body.data.adjustedScenario).toBeTruthy();
  });

  // ── Step 8: Pension domain (Excel import → analysis → findings) ──────────
  it('8. imports a pension Excel report and produces pension analysis + findings', async () => {
    const buffer = fs.readFileSync(PENSION_FIXTURE);
    const uploadRes = await auth(request(app).post('/api/pension/upload-file'))
      .attach('file', buffer, 'har-kesef-report.xlsx');
    expect(uploadRes.statusCode).toBeLessThan(300);

    const analysisRes = await auth(request(app).get('/api/pension/analysis'));
    expect(analysisRes.statusCode).toBe(200);
    expect(analysisRes.body.data.summary.hasData).toBe(true);

    const findingsRes = await auth(request(app).get('/api/findings'));
    expect(findingsRes.statusCode).toBe(200);
    expect(findingsRes.body.count).toBeGreaterThan(0);
  }, 60000);

  // ── Step 9: Insurance domain (Excel import → analysis) ───────────────────
  it('9. imports a Har-HaBituach Excel and produces an insurance health check', async () => {
    const buffer = buildHarBituachExcel([
      { 'חברה': 'הפניקס', 'סוג': 'ביטוח חיים', 'פרמיה': 150, 'סכום': 500000, 'מספר פוליסה': 'L-001' },
    ]);
    const uploadRes = await auth(request(app).post('/api/insurance/upload-excel'))
      .attach('file', buffer, 'har-bituach.xlsx');
    expect(uploadRes.statusCode).toBeLessThan(300);

    const res = await auth(request(app).get('/api/insurance/analysis'));
    expect(res.statusCode).toBe(200);
    expect(res.body.data.healthCheck).toBeTruthy();
    expect(res.body.data.summary.policyCount).toBeGreaterThan(0);
  });

  // ── Step 10: Dashboard aggregates everything accumulated so far ──────────
  it('10. dashboard summary reflects payslip + pension + insurance together', async () => {
    // plannedRetirementAge is set in the profile UI, not onboarding — set it
    // directly so the pension score has a horizon to compute against.
    await UserProfile.findOneAndUpdate(
      { user: userId },
      { $set: { 'retirement.plannedRetirementAge': 67 } },
    );

    const res = await auth(request(app).get('/api/dashboard/summary'));
    expect(res.statusCode).toBe(200);
    expect(res.body.data.documents.completed).toBe(1);
    expect(res.body.data.scores.payslip).not.toBeNull();
    expect(res.body.data.scores.pension).not.toBeNull();
    expect(res.body.data.scores.insurance).not.toBeNull();
  }, 60000);

  // ── Step 11: AI assistant chat (context built from OUR data, not client) ─
  it('11. chats with the AI assistant and persists the conversation', async () => {
    const res = await auth(request(app).post('/api/ai/chat'))
      .send({ message: 'כמה אני מפריש לפנסיה?' });
    expect(res.statusCode).toBe(200);
    expect(res.body.answer).toBeTruthy();
    expect(res.body.conversationId).toBeTruthy();
    conversationId = res.body.conversationId;

    const histRes = await auth(
      request(app).get(`/api/ai/chat/history?conversationId=${conversationId}`),
    );
    expect(histRes.statusCode).toBe(200);
  });

  // ── Step 12: Multi-agent full analysis (deterministic, skipLLM) ──────────
  it('12. runs the multi-agent full analysis over all accumulated data', async () => {
    const res = await auth(request(app).post('/api/ai/full-analysis')).send({ skipLLM: true });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.agents).toBeTruthy();
  });

  // ── Step 13: Summary email closes the loop ───────────────────────────────
  it('13. sends the summary email to the journey user (SMTP mocked)', async () => {
    const res = await auth(request(app).post('/api/summary-email/send')).send({ consent: true });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.sentTo).toBe(email);
  });

  // ── Step 14: Security boundary — no token, no data ───────────────────────
  it('14. rejects every protected route without a token', async () => {
    const routes = ['/api/documents', '/api/findings', '/api/dashboard/summary', '/api/pension/analysis'];
    const responses = await Promise.all(routes.map(route => request(app).get(route)));
    responses.forEach(res => expect(res.statusCode).toBe(401));
  });
});
