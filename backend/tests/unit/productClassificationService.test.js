'use strict';

const {
  classifyGemelNetProduct,
  isPublicGemelProduct,
  EXACT_SUG_KRN_TO_PRODUCT,
} = require('../../services/marketComparison/productClassificationService');
const { buildGemelDataQualityReport } = require('../../services/marketComparison/gemelDataQualityService');

describe('productClassificationService', () => {
  it('maps approved SUG_KRN values exactly', () => {
    expect(classifyGemelNetProduct({ SUG_KRN: 'תגמולים ואישית לפיצויים' }).productType).toBe('gemel');
    expect(classifyGemelNetProduct({ SUG_KRN: 'קרנות השתלמות' }).productType).toBe('hishtalmut');
    expect(classifyGemelNetProduct({ SUG_KRN: 'קופת גמל להשקעה' }).productType).toBe('investment_gemel');
    expect(classifyGemelNetProduct({ SUG_KRN: 'קופת גמל להשקעה - חסכון לילד' }).productType).toBe(
      'child_savings',
    );
    expect(classifyGemelNetProduct({ SUG_KRN: 'מרכזית לפיצויים' }).productType).toBe('central_severance');
    expect(classifyGemelNetProduct({ SUG_KRN: 'מטרה אחרת' }).productType).toBe('unknown');
  });

  it('marks only gemel, hishtalmut and investment_gemel as public leaderboard', () => {
    expect(classifyGemelNetProduct({ SUG_KRN: 'תגמולים ואישית לפיצויים' }).isPublicLeaderboard).toBe(true);
    expect(classifyGemelNetProduct({ SUG_KRN: 'קרנות השתלמות' }).isPublicLeaderboard).toBe(true);
    expect(classifyGemelNetProduct({ SUG_KRN: 'קופת גמל להשקעה' }).isPublicLeaderboard).toBe(true);
    expect(
      classifyGemelNetProduct({ SUG_KRN: 'קופת גמל להשקעה - חסכון לילד' }).isPublicLeaderboard,
    ).toBe(false);
    expect(classifyGemelNetProduct({ SUG_KRN: 'מרכזית לפיצויים' }).isPublicLeaderboard).toBe(false);
    expect(classifyGemelNetProduct({ SUG_KRN: 'מטרה אחרת' }).isPublicLeaderboard).toBe(false);
  });

  it('treats empty SUG_KRN as unknown without name inference', () => {
    const result = classifyGemelNetProduct({
      SUG_KRN: '',
      SHM_KRN: 'קופת גמל להשקעה - מסלול כללי',
    });
    expect(result.productType).toBe('unknown');
    expect(result.classificationReason).toBe('empty_sug_krn');
    expect(result.isPublicLeaderboard).toBe(false);
  });

  it('does not infer product type from fund name when SUG_KRN is missing', () => {
    const result = classifyGemelNetProduct({
      SHM_KRN: 'קרן השתלמות - מסלול מניות',
    });
    expect(result.productType).toBe('unknown');
  });

  it('does not combine child_savings with investment_gemel for public ranking', () => {
    expect(isPublicGemelProduct('child_savings')).toBe(false);
    expect(isPublicGemelProduct('investment_gemel')).toBe(true);
  });

  it('covers all six product enum values in exact map or fallbacks', () => {
    const mapped = new Set(Object.values(EXACT_SUG_KRN_TO_PRODUCT));
    expect(mapped.has('gemel')).toBe(true);
    expect(mapped.has('hishtalmut')).toBe(true);
    expect(mapped.has('investment_gemel')).toBe(true);
    expect(mapped.has('child_savings')).toBe(true);
    expect(mapped.has('central_severance')).toBe(true);
    expect(mapped.has('unknown')).toBe(true);
  });
});

describe('buildGemelDataQualityReport', () => {
  it('aggregates excluded product counts for data quality metadata', () => {
    const records = [
      { ID: '1', SUG_KRN: 'תגמולים ואישית לפיצויים' },
      { ID: '2', SUG_KRN: 'קופת גמל להשקעה - חסכון לילד' },
      { ID: '3', SUG_KRN: 'מרכזית לפיצויים' },
      { ID: '4', SUG_KRN: '' },
      { ID: '5', SUG_KRN: 'מטרה אחרת' },
    ];

    const report = buildGemelDataQualityReport(records);
    expect(report.publicLeaderboardTotal).toBe(1);
    expect(report.excludedFromPublicTable.child_savings).toBe(1);
    expect(report.excludedFromPublicTable.central_severance).toBe(1);
    expect(report.excludedFromPublicTable.unknownEmptyClassification).toBe(1);
    expect(report.excludedFromPublicTable.unknownOtherPurpose).toBe(1);
    expect(report.unknownProductRecords).toHaveLength(2);
  });
});
