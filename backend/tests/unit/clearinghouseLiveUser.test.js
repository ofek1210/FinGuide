'use strict';

const {
  clearinghouseRecsToUnifiedInsights,
  filterClearinghouseRecsByDomain,
} = require('../../utils/clearinghouseInsightBridge');
const { prioritizeFinancialInsights } = require('../../utils/financialInsightPrioritizer');

const USER_FIXTURE_ROWS = [
  {
    companyName: 'מיטב גמל ופנסיה בע"מ',
    productName: 'פנסיה חדשה מקיפה',
    productType: 'פנסיה חדשה מקיפה',
    totalSavings: 462.01,
    isActive: false,
  },
  {
    companyName: 'כלל פנסיה וגמל בע"מ',
    productName: 'פנסיה חדשה מקיפה',
    productType: 'פנסיה חדשה מקיפה',
    totalSavings: 120436.25,
    isActive: true,
  },
  {
    companyName: 'הראל פנסיה וגמל בע"מ',
    productName: 'קופת גמל',
    productType: 'קופת גמל',
    totalSavings: 40196.77,
    assetFee: 1.05,
    isActive: false,
  },
];

describe('clearinghouse live user integration', () => {
  const recs = [
    {
      type: 'clearinghouse_small_inactive_pension',
      title: 'איחוד קרנות פנסיה',
      reason: 'זיהינו קרן פנסיה קטנה ולא פעילה במיטב על סך 462.01 ש"ח. מומלץ לבצע איחוד חשבונות (ניוד) אל הקרן הפעילה שלך בכלל',
      urgency: 'medium',
      impactAmount: 462,
      confidenceScore: 92,
    },
    {
      type: 'clearinghouse_high_fee_inactive_provident',
      title: 'דמי ניהול חריגים בקופה לא פעילה',
      reason: 'קופת הגמל הלא פעילה שלך בהראל',
      urgency: 'high',
      impactAmount: 19173,
      confidenceScore: 95,
    },
    {
      type: 'clearinghouse_active_fee_benchmark',
      title: 'השוואת דמי ניהול — כלל פנסיה',
      reason: 'בקרן הפעילה שלך בכלל',
      urgency: 'medium',
      impactAmount: 4861,
      confidenceScore: 88,
    },
  ];

  const funds = USER_FIXTURE_ROWS.map((r, i) => ({
    _id: `fund-${i}`,
    fundName: r.productName,
    provider: r.companyName,
    isActive: r.isActive,
    currentBalance: r.totalSavings,
    managementFeeAccumulation: r.assetFee ? r.assetFee / 100 : 0.002,
  }));

  it('routes pension clearinghouse rules to pension agent only', () => {
    const pensionRecs = filterClearinghouseRecsByDomain(recs, 'pension');
    expect(pensionRecs).toHaveLength(2);

    const unified = clearinghouseRecsToUnifiedInsights(pensionRecs, funds, { domain: 'pension' });
    const prioritized = prioritizeFinancialInsights(unified, { productType: 'PENSION' });

    expect(prioritized.centralRecommendations).toHaveLength(2);
    expect(prioritized.centralRecommendations.some(c => c.code === 'inactive_fund')).toBe(true);
    expect(prioritized.centralRecommendations.filter(c => c.code === 'MANAGEMENT_FEES_REVIEW')).toHaveLength(1);
    expect(prioritized.centralRecommendations.every(c => c.productType === 'PENSION')).toBe(true);
  });

  it('routes provident clearinghouse rules to gemel agent only', () => {
    const gemelRecs = filterClearinghouseRecsByDomain(recs, 'gemel');
    expect(gemelRecs).toHaveLength(1);

    const unified = clearinghouseRecsToUnifiedInsights(gemelRecs, funds, { domain: 'gemel' });
    const prioritized = prioritizeFinancialInsights(unified, { productType: 'GEMEL' });

    expect(prioritized.centralRecommendations).toHaveLength(1);
    expect(prioritized.centralRecommendations[0].code).toBe('MANAGEMENT_FEES_REVIEW');
    expect(prioritized.centralRecommendations[0].productType).toBe('GEMEL');
    expect(prioritized.centralRecommendations[0].evidence?.companyKey).toBe('harel');
  });
});
