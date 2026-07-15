const {
  validatePayslipAnalysis,
  detectCrossFieldIssues,
  buildFieldsMeta,
} = require('../../schemas/payslipAnalysis.schema');

const validPayload = () => ({
  period: { month: '09/2022' },
  salary: { gross_total: 6504.40, net_payable: 5636.85, components: [] },
  deductions: { mandatory: { total: 567.55 } },
  quality: {
    fields: {
      gross_total: { confidence: 0.95, source: 'label_same_line', section: 'earnings', abstained: false },
      net_payable: { confidence: 0.88, source: 'regex_net_label', section: 'summary', abstained: false },
    },
  },
});

describe('validatePayslipAnalysis', () => {
  it('passes a fully populated valid payload', () => {
    const result = validatePayslipAnalysis(validPayload());
    expect(result.ok).toBe(true);
    expect(result.data.salary.gross_total).toBe(6504.40);
  });

  it('derives mandatory.total from deduction components when total is missing', () => {
    const payload = validPayload();
    delete payload.deductions.mandatory.total;
    payload.deductions.mandatory.income_tax = 3550.71;
    payload.deductions.mandatory.national_insurance = 750.48;
    payload.deductions.mandatory.health_insurance = 719.68;
    const result = validatePayslipAnalysis(payload);
    expect(result.ok).toBe(true);
    expect(result.data.deductions.mandatory.total).toBe(5020.87);
    expect(result.data.deductions.mandatory.total_is_derived).toBe(true);
  });

  it('rejects when period.month is missing', () => {
    const payload = validPayload();
    delete payload.period.month;
    const result = validatePayslipAnalysis(payload);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('schema_invalid');
    expect(result.message).toMatch(/period\.month/);
  });

  it('rejects when gross_total is zero or negative', () => {
    const payload = validPayload();
    payload.salary.gross_total = 0;
    const result = validatePayslipAnalysis(payload);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('schema_invalid');
    expect(result.message).toMatch(/gross_total/);
  });

  it('rejects when deductions.mandatory.total is missing', () => {
    const payload = validPayload();
    delete payload.deductions.mandatory.total;
    const result = validatePayslipAnalysis(payload);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('schema_invalid');
  });

  it('accepts MM/YYYY and YYYY-MM formats for period.month', () => {
    expect(validatePayslipAnalysis({
      ...validPayload(),
      period: { month: '2022-09' },
    }).ok).toBe(true);
    expect(validatePayslipAnalysis({
      ...validPayload(),
      period: { month: '9/2022' },
    }).ok).toBe(true);
  });

  it('rejects garbled period.month', () => {
    const result = validatePayslipAnalysis({
      ...validPayload(),
      period: { month: 'September 2022' },
    });
    expect(result.ok).toBe(false);
  });

  it('flags cross-field violation when net > gross', () => {
    const payload = validPayload();
    payload.salary.net_payable = 7000;
    payload.salary.gross_total = 6000;
    const result = validatePayslipAnalysis(payload);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('cross_field_invalid');
    expect(result.crossFieldIssues[0]).toMatch(/exceeds gross_total/);
  });

  it('allows mandatory == gross within rounding slack', () => {
    const payload = validPayload();
    payload.salary.gross_total = 1000;
    payload.deductions.mandatory.total = 1000;
    payload.salary.net_payable = 0.01; // need > 0 to satisfy positive constraint
    const result = validatePayslipAnalysis(payload);
    expect(result.ok).toBe(true);
  });

  it('returns reason without throwing on completely empty input', () => {
    expect(() => validatePayslipAnalysis({})).not.toThrow();
    expect(() => validatePayslipAnalysis(null)).not.toThrow();
    const result = validatePayslipAnalysis({});
    expect(result.ok).toBe(false);
  });

  it('rejects when quality.flaggedInconsistencies is non-empty', () => {
    const result = validatePayslipAnalysis({
      ...validPayload(),
      quality: { flaggedInconsistencies: ['pension: employee + employer mismatch'] },
    });
    expect(result.ok).toBe(false);
    expect(result.crossFieldIssues).toContain('pension: employee + employer mismatch');
  });
});

describe('detectCrossFieldIssues', () => {
  it('reports nothing for healthy values', () => {
    expect(detectCrossFieldIssues({
      salary: { gross_total: 10000, net_payable: 7500 },
      deductions: { mandatory: { total: 2000 } },
    })).toEqual([]);
  });

  it('reports both net>gross and mandatory>gross when both true', () => {
    const issues = detectCrossFieldIssues({
      salary: { gross_total: 5000, net_payable: 8000 },
      deductions: { mandatory: { total: 9000 } },
    });
    expect(issues).toHaveLength(2);
  });

  it('handles partial data gracefully', () => {
    expect(detectCrossFieldIssues({ salary: { gross_total: 5000 } })).toEqual([]);
    expect(detectCrossFieldIssues(null)).toEqual([]);
    expect(detectCrossFieldIssues({})).toEqual([]);
  });
});

describe('buildFieldsMeta', () => {
  it('lifts confidence/source/section/abstained from quality.fields', () => {
    const meta = buildFieldsMeta(validPayload());
    expect(meta.gross_total).toEqual({
      confidence: 0.95,
      source: 'label_same_line',
      section: 'earnings',
      abstained: false,
    });
    expect(meta.net_payable.source).toBe('regex_net_label');
  });

  it('returns null when quality.fields is missing', () => {
    expect(buildFieldsMeta({})).toBeNull();
    expect(buildFieldsMeta(null)).toBeNull();
    expect(buildFieldsMeta({ quality: {} })).toBeNull();
  });

  it('marks fields without numeric confidence as null', () => {
    const meta = buildFieldsMeta({
      quality: {
        fields: { gross_total: { source: 'label_same_line' } },
      },
    });
    expect(meta.gross_total.confidence).toBeNull();
    expect(meta.gross_total.source).toBe('label_same_line');
  });
});
