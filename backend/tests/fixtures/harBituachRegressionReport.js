'use strict';

/**
 * Regression fixture — Har HaBituach report structure (not hard-coded conclusions).
 * Represents: 3 vehicle insurers, distinct health products, individual + group life.
 */

const HAR_BITUACH_REGRESSION_ROWS = [
  // Shlomo — compulsory + comprehensive, same policy number
  { id: 'shlomo-chova', provider: 'שlomo', policyNumber: 'SH-1001', type: 'car', monthlyPremium: 420,
    startDate: '2024-01-01', status: 'active',
    rawData: { mainBranch: 'רכב', subBranch: 'ביטוח חובה', productType: 'חובה' } },
  { id: 'shlomo-mekif', provider: 'שlomo', policyNumber: 'SH-1001', type: 'car', monthlyPremium: 380,
    startDate: '2024-01-01', status: 'active',
    rawData: { mainBranch: 'רכב', subBranch: 'ביטוח מקיף', productType: 'מקיף' } },

  // IDI — compulsory + comprehensive + services, same policy number
  { id: 'idi-chova', provider: 'IDI', policyNumber: 'IDI-2001', type: 'car', monthlyPremium: 395,
    startDate: '2024-01-01', status: 'active',
    rawData: { mainBranch: 'רכב', subBranch: 'ביטוח חובה' } },
  { id: 'idi-mekif', provider: 'IDI', policyNumber: 'IDI-2001', type: 'car', monthlyPremium: 410,
    startDate: '2024-01-01', status: 'active',
    rawData: { mainBranch: 'רכב', subBranch: 'ביטוח מקיף' } },
  { id: 'idi-svc', provider: 'IDI', policyNumber: 'IDI-2001', type: 'car', monthlyPremium: 45,
    startDate: '2024-01-01', status: 'active',
    rawData: { mainBranch: 'רכב', subBranch: 'שירותי דרך וגרירה', productType: 'שירות' } },

  // Phoenix — compulsory + comprehensive, separate policy numbers, same dates
  { id: 'phx-chova', provider: 'Phoenix', policyNumber: 'PHX-C-01', type: 'car', monthlyPremium: 360,
    startDate: '2024-01-01', status: 'active',
    rawData: { mainBranch: 'רכב', subBranch: 'ביטוח חובה' } },
  { id: 'phx-mekif', provider: 'Phoenix', policyNumber: 'PHX-M-01', type: 'car', monthlyPremium: 365,
    startDate: '2024-01-01', status: 'active',
    rawData: { mainBranch: 'רכב', subBranch: 'ביטוח מקיף' } },

  // Health-related — distinct products
  { id: 'ltc', provider: 'מגדל', policyNumber: 'LT-01', type: 'health', monthlyPremium: 185,
    status: 'active', rawData: { mainBranch: 'בריאות', subBranch: 'ביטוח סיעוד', productType: 'סיעוד' } },
  { id: 'pa-1', provider: 'הראל', policyNumber: 'PA-01', type: 'health', monthlyPremium: 62,
    status: 'active', rawData: { mainBranch: 'תאונות אישיות', subBranch: 'תאונות אישיות' } },
  { id: 'pa-2', provider: 'כלל', policyNumber: 'PA-02', type: 'health', monthlyPremium: 48,
    status: 'active', rawData: { mainBranch: 'תאונות אישיות', subBranch: 'תאונה אישית' } },
  { id: 'med-svc', provider: 'מנורה', policyNumber: 'MS-01', type: 'health', monthlyPremium: 35,
    status: 'active', rawData: { mainBranch: 'בריאות', subBranch: 'שירות רפואי', productType: 'ייעוץ' } },
  { id: 'pkg', provider: 'הפניקס', policyNumber: 'PKG-01', type: 'health', monthlyPremium: 210,
    status: 'active', rawData: { mainBranch: 'בריאות', subBranch: 'חבילת ביטוח', productType: 'משלים' } },

  // Life — individual + group + zero-cost rider
  { id: 'life-ind', provider: 'מגדל', policyNumber: 'L-IND', type: 'life', monthlyPremium: 233,
    status: 'active', rawData: { mainBranch: 'חיים', subBranch: 'ביטוח חיים', classification: 'פרטי' } },
  { id: 'life-grp', provider: 'כלל', policyNumber: 'L-GRP', type: 'life', monthlyPremium: 0,
    status: 'active', rawData: { mainBranch: 'חיים', subBranch: 'ביטוח חיים קבוצתי', classification: 'קבוצתי' } },
  { id: 'life-ad-rider', provider: 'כלל', policyNumber: 'L-GRP', type: 'life', monthlyPremium: 0,
    status: 'active', rawData: { mainBranch: 'חיים', subBranch: 'מוות מתאונה', classification: 'נספח' } },
];

module.exports = { HAR_BITUACH_REGRESSION_ROWS };
