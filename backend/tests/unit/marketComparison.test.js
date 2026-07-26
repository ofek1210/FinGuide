'use strict';

const {
  classifyPensionRisk,
  classifyGemelRisk,
} = require('../../services/marketComparison/riskClassificationService');
const {
  classifyPensionComparisonGroup,
  classifyGemelComparisonGroup,
} = require('../../services/marketComparison/comparisonGroupService');
const {
  percentileInGroup,
  computeCombinedScore,
  computeEffectiveWeights,
  rankFundsByComparisonGroups,
  rankSingleComparisonGroup,
} = require('../../services/marketComparison/rankingService');
const {
  validateRiskGroupCompatibility,
  applyRiskGroupCompatibility,
} = require('../../services/marketComparison/riskGroupCompatibilityService');
const {
  normalizeRisk,
  normalizePeriod,
  normalizeProduct,
  normalizeLimit,
} = require('../../services/marketComparison/marketComparisonService');
const { classifyGemelNetProduct } = require('../../services/marketComparison/productClassificationService');
const { isEligibleForRanking, normalizeGemelNetRow, normalizePensiaNetRow } = require('../../services/marketComparison/marketDataQualityService');
const { ValidationError } = require('../../utils/appErrors');

describe('riskClassificationService', () => {
  it('classifies bond pension track as low', () => {
    const result = classifyPensionRisk({ SHM_KRN: 'פנסיה מקיפה עוקב מדדי אג"ח' });
    expect(result.riskLevel).toBe('low');
  });

  it('classifies general pension track as medium', () => {
    const result = classifyPensionRisk({ SHM_KRN: 'כלל פנסיה כללי' });
    expect(result.riskLevel).toBe('medium');
  });

  it('classifies equity pension track as high', () => {
    const result = classifyPensionRisk({ SHM_KRN: 'מיטב פנסיה עוקב מדדי מניות' });
    expect(result.riskLevel).toBe('high');
  });

  it('classifies S&P 500 pension track as high', () => {
    const result = classifyPensionRisk({ SHM_KRN: 'מסלול עוקב מדד S&P 500' });
    expect(result.riskLevel).toBe('high');
  });

  it('uses age default only when exposure is missing for age comparison groups', () => {
    expect(
      classifyPensionRisk(
        { SHM_KRN: 'הראל פנסיה - גילאי 50 ומטה', CHSHIF_MNUIOT: 20 },
        { comparisonGroup: 'pension_age_under_50' },
      ).riskLevel,
    ).toBe('low');
    expect(
      classifyPensionRisk(
        { SHM_KRN: 'הראל פנסיה - גילאי 50 ומטה' },
        { comparisonGroup: 'pension_age_under_50' },
      ).riskLevel,
    ).toBe('high');
  });

  it('does not classify Halacha alone as medium risk', () => {
    const result = classifyGemelRisk({
      SPECIALIZATION: 'הלכתי',
      SUB_SPECIALIZATION: 'הלכה יהודית',
    });
    expect(result.riskLevel).toBe('unclassified');
    expect(result.reason).toBe('gemel_halacha_requires_exposure');
  });

  it('never uses historical returns for pension risk', () => {
    const result = classifyPensionRisk({
      SHM_KRN: 'פנסיה מקיפה עוקב מדדי אג"ח',
      TSUA_12_HODASHIM: 99,
      TSUA_36_HODASHIM: 99,
      TSUA_SHNATIT_MEMUZAAT_5_SHANIM: 99,
    });
    expect(result.riskLevel).toBe('low');
  });

  it('classifies ambiguous gemel track as unclassified', () => {
    const result = classifyGemelRisk({
      SPECIALIZATION: 'מתמחה אחר',
      SUB_SPECIALIZATION: '',
      SHM_KRN: 'מסלול לא מזוהה',
    });
    expect(result.riskLevel).toBe('unclassified');
  });
});

describe('comparisonGroupService', () => {
  it('keeps equity and bonds in separate pension groups', () => {
    const equity = classifyPensionComparisonGroup({ SHM_KRN: 'עוקב מדדי מניות' });
    const bonds = classifyPensionComparisonGroup({ SHM_KRN: 'עוקב מדדי אג"ח' });
    expect(equity.comparisonGroup).toBe('pension_equity');
    expect(bonds.comparisonGroup).toBe('pension_bonds');
    expect(equity.comparisonGroup).not.toBe(bonds.comparisonGroup);
  });

  it('keeps S&P 500 separate from general gemel groups', () => {
    const sp500 = classifyGemelComparisonGroup(
      { SPECIALIZATION: 'עוקבי מדדים', SUB_SPECIALIZATION: 'עוקב מדד s&p 500' },
      'gemel',
    );
    const general = classifyGemelComparisonGroup(
      { SPECIALIZATION: 'כללי', SUB_SPECIALIZATION: 'כללי' },
      'gemel',
    );
    expect(sp500.comparisonGroup).toBe('gemel_sp500');
    expect(general.comparisonGroup).toBe('gemel_general');
  });

  it('isolates age-based gemel groups', () => {
    const under50 = classifyGemelComparisonGroup(
      { SPECIALIZATION: 'מדרגות', SUB_SPECIALIZATION: 'עד 50' },
      'hishtalmut',
    );
    const over60 = classifyGemelComparisonGroup(
      { SPECIALIZATION: 'מדרגות', SUB_SPECIALIZATION: '60 ומעלה' },
      'hishtalmut',
    );
    expect(under50.comparisonGroup).toBe('hishtalmut_age_under_50');
    expect(over60.comparisonGroup).toBe('hishtalmut_age_over_60');
  });

  it('prefixes comparison groups by product type', () => {
    const gemel = classifyGemelComparisonGroup(
      { SPECIALIZATION: 'מניות', SUB_SPECIALIZATION: 'מניות' },
      'gemel',
    );
    const investment = classifyGemelComparisonGroup(
      { SPECIALIZATION: 'מניות', SUB_SPECIALIZATION: 'מניות' },
      'investment_gemel',
    );
    expect(gemel.comparisonGroup).toBe('gemel_equity');
    expect(investment.comparisonGroup).toBe('investment_gemel_equity');
  });

  it('assigns tradable mixed tracks to equity group when exposure is high', () => {
    const result = classifyGemelComparisonGroup(
      {
        SPECIALIZATION: 'מתמחים באפיקי השקעה סחירים',
        SUB_SPECIALIZATION: 'משולב סחיר',
        stockExposurePct: 70,
      },
      'gemel',
    );
    expect(result.comparisonGroup).toBe('gemel_equity');
  });
});

describe('rankingService', () => {
  const baseFund = (id, returns, group = 'gemel_equity') => ({
    fundId: String(id),
    fundName: `Fund ${id}`,
    managingCompany: 'Company',
    productType: 'gemel',
    riskLevel: 'high',
    comparisonGroup: group,
    return12Months: returns[0],
    return36MonthsAnnualized: returns[1],
    return5YearsAnnualized: returns[2],
    assetsUnderManagement: id * 1000,
    source: 'gemelnet',
  });

  it('calculates percentile only inside one comparison group', () => {
    const groupA = percentileInGroup(10, [5, 10, 15]);
    const groupB = percentileInGroup(10, [9, 9.5, 9.8]);
    expect(groupA).not.toBe(groupB);
  });

  it('uses 20/35/45 combined weights when all periods exist', () => {
    const weights = computeEffectiveWeights([
      'return12Months',
      'return36MonthsAnnualized',
      'return5YearsAnnualized',
    ]);
    expect(weights.return12Months).toBeCloseTo(0.2, 5);
    expect(weights.return36MonthsAnnualized).toBeCloseTo(0.35, 5);
    expect(weights.return5YearsAnnualized).toBeCloseTo(0.45, 5);
  });

  it('redistributes weights proportionally when a period is missing', () => {
    const result = computeCombinedScore({
      return12Months: null,
      return36MonthsAnnualized: 70,
      return5YearsAnnualized: 80,
    });
    expect(result.rankingStatus).toBe('ranked');
    expect(result.effectiveWeights.return12Months).toBeUndefined();
    expect(result.effectiveWeights.return36MonthsAnnualized).toBeCloseTo(0.35 / 0.8, 5);
    expect(result.effectiveWeights.return5YearsAnnualized).toBeCloseTo(0.45 / 0.8, 5);
  });

  it('returns insufficient_history when only one period is available', () => {
    const result = computeCombinedScore({
      return12Months: 60,
      return36MonthsAnnualized: null,
      return5YearsAnnualized: null,
    });
    expect(result.rankingStatus).toBe('insufficient_history');
    expect(result.rankingScore).toBeNull();
  });

  it('excludes missing selected period from single-period ranking', () => {
    const funds = [
      baseFund(1, [10, 8, 6]),
      baseFund(2, [null, 9, 7]),
    ];
    const { ranked, insufficient } = rankSingleComparisonGroup(funds, { period: '12' });
    expect(ranked).toHaveLength(1);
    expect(insufficient).toHaveLength(1);
    expect(insufficient[0].fundId).toBe('2');
  });

  it('does not convert missing returns to zero in ranking score', () => {
    const funds = [baseFund(1, [null, null, 6]), baseFund(2, [5, 7, 6])];
    const { ranked, insufficient } = rankSingleComparisonGroup(funds, { period: 'combined' });
    expect(ranked.find((fund) => fund.fundId === '1')).toBeUndefined();
    expect(insufficient.find((fund) => fund.fundId === '1')?.rankingStatus).toBe('insufficient_history');
  });

  it('applies competition ranking and deterministic tie handling within one group', () => {
    const tiedFund = (id) => ({
      ...baseFund(id, [8, 8, 8]),
      assetsUnderManagement: 5000,
    });
    const funds = [tiedFund(3), tiedFund(1), baseFund(2, [7, 7, 7])];
    const { ranked } = rankSingleComparisonGroup(funds, { period: 'combined' });
    const tied = ranked.filter((fund) => fund.rankingScore === ranked[0].rankingScore);
    expect(tied).toHaveLength(2);
    expect(tied.every((fund) => fund.rank === 1)).toBe(true);
    expect(ranked.find((fund) => fund.fundId === '2')?.rank).toBe(3);
  });

  it('never merges percentile scores across comparison groups', () => {
    const funds = [
      baseFund(1, [5, 5, 5], 'gemel_equity'),
      baseFund(2, [10, 10, 10], 'gemel_general'),
    ];
    const result = rankFundsByComparisonGroups(funds, { period: 'combined', limit: 5 });
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].funds[0].rank).toBe(1);
    expect(result.groups[1].funds[0].rank).toBe(1);
    expect(result.groups[0].funds[0].comparisonGroup).not.toBe(result.groups[1].funds[0].comparisonGroup);
  });

  it('applies limit per comparison group and resets rank within each group', () => {
    const mk = (id, group, scoreBoost) => baseFund(id, [5 + scoreBoost, 5 + scoreBoost, 5 + scoreBoost], group);
    const funds = [
      mk(1, 'gemel_equity', 3),
      mk(2, 'gemel_equity', 2),
      mk(3, 'gemel_equity', 1),
      mk(4, 'gemel_bonds', 3),
      mk(5, 'gemel_bonds', 2),
    ];
    const result = rankFundsByComparisonGroups(funds, { period: 'combined', limit: 2 });
    expect(result.groups).toHaveLength(2);
    for (const group of result.groups) {
      expect(group.funds.length).toBeLessThanOrEqual(2);
      if (group.funds.length) expect(group.funds[0].rank).toBe(1);
    }
  });

  it('returns only the requested comparison group when specified', () => {
    const funds = [
      baseFund(1, [8, 8, 8], 'gemel_equity'),
      baseFund(2, [7, 7, 7], 'gemel_bonds'),
    ];
    const result = rankFundsByComparisonGroups(funds, {
      period: 'combined',
      comparisonGroup: 'gemel_bonds',
      limit: 5,
    });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].comparisonGroup).toBe('gemel_bonds');
    expect(result.groups[0].funds[0].fundId).toBe('2');
  });
});

describe('riskGroupCompatibilityService', () => {
  it('rejects general group with high exposure risk by moving group to equity', () => {
    const validation = validateRiskGroupCompatibility({
      productType: 'gemel',
      riskLevel: 'high',
      comparisonGroup: 'gemel_general',
      stockExposurePct: 70,
    });
    expect(validation.comparisonGroup).toBe('gemel_equity');
    expect(validation.riskLevel).toBe('high');
  });

  it('does not return general+high after compatibility is applied', () => {
    const record = applyRiskGroupCompatibility({
      fundId: '14264',
      fundName: 'מיטב גמל משולב סחיר',
      productType: 'gemel',
      riskLevel: 'high',
      comparisonGroup: 'gemel_general',
      stockExposurePct: 70,
      isPublicProduct: true,
      managingCompany: 'מיטב',
      return12Months: 10,
      return36MonthsAnnualized: 8,
      return5YearsAnnualized: null,
    });
    expect(record.comparisonGroup).not.toBe('gemel_general');
    expect(record.riskLevel).toBe('high');
    expect(isEligibleForRanking(record, { period: 'combined', risk: 'high' })).toBe(true);
  });

  it('unclassifies incompatible risk/group pairs without exposure support', () => {
    const record = applyRiskGroupCompatibility({
      productType: 'gemel',
      riskLevel: 'high',
      comparisonGroup: 'gemel_bonds',
      stockExposurePct: null,
    });
    expect(record.riskLevel).toBe('unclassified');
    expect(record.comparisonGroup).toBe('unclassified');
  });
});

describe('marketComparisonService validation', () => {
  it('accepts valid filters', () => {
    expect(normalizeRisk('high')).toBe('high');
    expect(normalizePeriod('combined')).toBe('combined');
    expect(normalizeProduct('hishtalmut')).toBe('hishtalmut');
    expect(normalizeLimit('5')).toBe(5);
  });

  it('rejects invalid product, risk, period and limit', () => {
    expect(() => normalizeProduct('child_savings')).toThrow(ValidationError);
    expect(() => normalizeRisk('unclassified')).toThrow(ValidationError);
    expect(() => normalizePeriod('60m')).toThrow(ValidationError);
    expect(() => normalizeLimit(0)).toThrow(ValidationError);
  });
});

describe('product isolation', () => {
  it('keeps child_savings out of public gemel product records', () => {
    const record = normalizeGemelNetRow({
      ID: '999',
      SHM_KRN: 'חיסכון לילד',
      SHM_TAAGID_MENAEL: 'חברה',
      SUG_KRN: 'קופת גמל להשקעה - חסכון לילד',
      SPECIALIZATION: 'כללי',
      SUB_SPECIALIZATION: 'כללי',
    });
    expect(record.productType).toBe('child_savings');
    expect(record.isPublicProduct).toBe(false);
    expect(isEligibleForRanking(record, { period: 'combined', risk: 'medium' })).toBe(false);
  });

  it('maps standard gemel, hishtalmut and investment gemel separately', () => {
    expect(classifyGemelNetProduct({ SUG_KRN: 'תגמולים ואישית לפיצויים' }).productType).toBe('gemel');
    expect(classifyGemelNetProduct({ SUG_KRN: 'קרנות השתלמות' }).productType).toBe('hishtalmut');
    expect(classifyGemelNetProduct({ SUG_KRN: 'קופת גמל להשקעה' }).productType).toBe('investment_gemel');
  });

  it('normalizes pension rows as pensianet product', () => {
    const record = normalizePensiaNetRow({
      ID: '1',
      SHM_KRN: 'כלל פנסיה כללי',
      SHM_TAAGID_MENAEL: 'כלל',
      TSUA_12_HODASHIM: 5,
      TSUA_36_HODASHIM: 4,
      TSUA_SHNATIT_MEMUZAAT_5_SHANIM: 3,
    });
    expect(record.productType).toBe('pension');
    expect(record.source).toBe('pensianet');
    expect(record.return12Months).toBe(5);
  });

  it('preserves null return values in normalized rows', () => {
    const record = normalizeGemelNetRow({
      ID: '1',
      SHM_KRN: 'קרן',
      SHM_TAAGID_MENAEL: 'חברה',
      SUG_KRN: 'קרנות השתלמות',
      SPECIALIZATION: 'כללי',
      SUB_SPECIALIZATION: 'כללי',
    });
    expect(record.return12Months).toBeNull();
    expect(record.return36MonthsAnnualized).toBeNull();
    expect(record.return5YearsAnnualized).toBeNull();
  });
});
