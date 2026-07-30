const fs = require('fs');
const path = require('path');

const {
  rankExtractionCandidates,
  resolveGrossAndNetCandidates,
  resolveMandatoryTotalCandidate,
} = require('../../services/payslipOcrResolver');

const readJsonFixture = name =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8'));

describe('payslipOcrResolver', () => {
  it('keeps only the stronger validated gross candidate when gross/net conflict', () => {
    const warnings = [];
    const resolution = resolveGrossAndNetCandidates(
      [{ value: 15000, score: 0.98, source: 'gross_label' }],
      [{ value: 17000, score: 0.96, source: 'net_label' }],
      warnings,
    );

    expect(resolution.grossCandidate).toEqual(
      expect.objectContaining({
        value: 15000,
      }),
    );
    expect(resolution.netCandidate).toBeUndefined();
    expect(warnings).toContain(
      'Conflicting gross/net candidates detected; kept only the stronger validated salary field.',
    );
  });

  it('prefers a derived mandatory total when explicit totals conflict with resolved deduction components', () => {
    const warnings = [];
    const resolution = resolveMandatoryTotalCandidate(
      [{ value: 5000, score: 0.9, source: 'explicit_total' }],
      {
        income_tax: { value: 600, score: 0.9, source: 'income_tax' },
        national_insurance: { value: 250, score: 0.9, source: 'national_insurance' },
        health_insurance: { value: 150, score: 0.9, source: 'health_insurance' },
      },
      10000,
      warnings,
    );

    expect(resolution.candidate).toEqual(
      expect.objectContaining({
        value: 1000,
        source: 'derived_component_sum',
      }),
    );
    expect(resolution.total_is_derived).toBe(true);
  });

  it('ranks OCR candidates by resolution score, then confidence, then warning count', () => {
    const ranked = rankExtractionCandidates(readJsonFixture('payslip-ocr-pass-ranking.json'));

    expect(ranked.map(candidate => candidate.psm)).toEqual([3, 4, 6]);
  });

  it('prefers the more internally consistent OCR pass even when another pass has higher confidence', () => {
    const ranked = rankExtractionCandidates(readJsonFixture('payslip-ocr-pass-ranking-consistency.json'));

    expect(ranked.map(candidate => candidate.psm)).toEqual([4, 6, 3]);
  });

  it('prefers OCR pass whose gross reconciles with net + mandatory deductions', () => {
    const ranked = rankExtractionCandidates([
      {
        psm: 6,
        data: {
          salary: { gross_total: 20799.54, net_payable: 7423.93 },
          deductions: { mandatory: { total: 3913.18 } },
          quality: { resolution_score: 16, confidence: 0.95, warnings: [] },
        },
      },
      {
        psm: 4,
        data: {
          salary: { gross_total: 21653.25, net_payable: 17423.93 },
          deductions: { mandatory: { total: 4229.32 } },
          quality: { resolution_score: 14, confidence: 0.85, warnings: [] },
        },
      },
    ]);

    expect(ranked[0].psm).toBe(4);
    expect(ranked[0].data.salary.gross_total).toBe(21653.25);
  });
});
