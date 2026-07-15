const {
  extractPayslipFromImage,
  normalizeVisionExtraction,
  clearCache,
  _setAnthropicClientForTests,
} = require('../../services/payslipVisionExtractor');
const visionCache = require('../../services/payslipVisionCache');

const visionResponse = {
  confidence: {
    period: 0.95,
    salary: 0.9,
    deductions: 0.88,
    contributions: 0.85,
    parties: 0.92,
    employment: 0.7,
  },
  period_month: '06/2026',
  gross_total: 30391.26,
  net_payable: 10020,
  mandatory_total: 8500,
  income_tax: 5000,
  national_insurance: 2000,
  health_insurance: 1500,
  voluntary_total: null,
  pension_employee: 1647.03,
  pension_employer: 3176.41,
  pension_participation_total: null,
  pension_severance: null,
  pension_base: null,
  pension_employee_rate_percent: null,
  pension_employer_rate_percent: null,
  pension_severance_rate_percent: null,
  study_employee: 743.61,
  study_employer: 1744.17,
  study_participation_total: null,
  study_base: null,
  study_employee_rate_percent: null,
  study_employer_rate_percent: null,
  employer_name: 'צבא הגנה לישראל',
  employee_name: 'שגב פרטוש',
  employee_id: '205506975',
  employment_start_date: null,
  job_percent: 100,
  tax_credit_points: 2.25,
  marginal_tax_rate_percent: null,
  working_days: null,
  working_hours: null,
  vacation_days: null,
  sick_days: null,
  hmo: null,
  notes: null,
};

const stubClient = () => {
  const create = jest.fn().mockResolvedValue({
    usage: { input_tokens: 1200, output_tokens: 800 },
    content: [{ type: 'text', text: JSON.stringify(visionResponse) }],
  });
  return { messages: { create }, _create: create };
};

let mockClient;

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'sk-test-key';
  clearCache();
  visionCache.clear();
  mockClient = stubClient();
  _setAnthropicClientForTests(mockClient);
});

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
});

describe('normalizeVisionExtraction', () => {
  it('maps flat vision output to schema_version 1.9', () => {
    const data = normalizeVisionExtraction(visionResponse, {
      imageSha256: 'abc123',
      model: 'claude-sonnet-test',
    });
    expect(data.schema_version).toBe('1.9');
    expect(data.period.month).toBe('2026-06');
    expect(data.salary.gross_total).toBe(30391.26);
    expect(data.contributions.pension.employee).toBe(1647.03);
    expect(data.contributions.pension.employer).toBe(3176.41);
    expect(data.contributions.pension.participation_total).toBe(4823.44);
    expect(data.contributions.study_fund.participation_total).toBe(2487.78);
    expect(data.parties.employer_name).toBe('צבא הגנה לישראל');
    expect(data.tax.tax_credit_points).toBe(2.25);
    expect(data.summary.taxCreditPoints).toBe(2.25);
    expect(data.quality.debug.source_type).toBe('vision_llm');
  });
});

describe('extractPayslipFromImage', () => {
  it('calls Anthropic vision API and returns normalized data', async () => {
    const buffer = Buffer.from('fake-png');
    const result = await extractPayslipFromImage(buffer, { mimeType: 'image/png' });
    expect(result.fromCache).toBe(false);
    expect(result.normalized.schema_version).toBe('1.9');
    expect(result.audit.model).toBeTruthy();
    expect(result.audit.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns cached result on second call with same image hash', async () => {
    const buffer = Buffer.from('same-image-content');
    const sha = 'fixedhash1234567890abcdef1234567890abcdef1234567890abcdef12345678';
    const first = await extractPayslipFromImage(buffer, { mimeType: 'image/png', imageSha256: sha });
    const second = await extractPayslipFromImage(buffer, { mimeType: 'image/png', imageSha256: sha });
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(mockClient._create).toHaveBeenCalledTimes(1);
  });
});
