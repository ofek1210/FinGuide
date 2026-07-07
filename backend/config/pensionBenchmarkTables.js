/**
 * Static pension market benchmarks (2026 estimates).
 * lastUpdated: 2026-06-21 — update manually from pensyanet / bituachnet monthly.
 * Run: npm run validate:benchmark-tables
 */



const MARKET_AVERAGES = {
  pension_comprehensive: {
    high: { mgmtFeeAccumulation: 0.0035, mgmtFeeDeposit: 0.001, return1Y: 8.2, return5Y: 6.8 },
    medium: { mgmtFeeAccumulation: 0.0032, mgmtFeeDeposit: 0.001, return1Y: 6.5, return5Y: 5.8 },
    low: { mgmtFeeAccumulation: 0.0028, mgmtFeeDeposit: 0.0008, return1Y: 4.2, return5Y: 4.0 },
  },
  pension_old: {
    high: { mgmtFeeAccumulation: 0.004, mgmtFeeDeposit: 0.0012, return1Y: 7.8, return5Y: 6.2 },
    medium: { mgmtFeeAccumulation: 0.0038, mgmtFeeDeposit: 0.001, return1Y: 6.0, return5Y: 5.5 },
    low: { mgmtFeeAccumulation: 0.003, mgmtFeeDeposit: 0.0008, return1Y: 3.8, return5Y: 3.6 },
  },
  study_fund: {
    high: { mgmtFeeAccumulation: 0.0025, mgmtFeeDeposit: 0.0005, return1Y: 9.0, return5Y: 7.2 },
    medium: { mgmtFeeAccumulation: 0.0022, mgmtFeeDeposit: 0.0005, return1Y: 7.0, return5Y: 6.0 },
    low: { mgmtFeeAccumulation: 0.0018, mgmtFeeDeposit: 0.0004, return1Y: 4.5, return5Y: 4.2 },
  },
  provident_fund: {
    high: { mgmtFeeAccumulation: 0.003, mgmtFeeDeposit: 0.0008, return1Y: 8.0, return5Y: 6.5 },
    medium: { mgmtFeeAccumulation: 0.0028, mgmtFeeDeposit: 0.0008, return1Y: 6.2, return5Y: 5.6 },
    low: { mgmtFeeAccumulation: 0.0025, mgmtFeeDeposit: 0.0006, return1Y: 4.0, return5Y: 3.8 },
  },
  managers_insurance: {
    high: { mgmtFeeAccumulation: 0.0055, mgmtFeeDeposit: 0.0015, return1Y: 7.5, return5Y: 6.0 },
    medium: { mgmtFeeAccumulation: 0.005, mgmtFeeDeposit: 0.0012, return1Y: 5.8, return5Y: 5.2 },
    low: { mgmtFeeAccumulation: 0.0045, mgmtFeeDeposit: 0.001, return1Y: 3.5, return5Y: 3.4 },
  },
  other: {
    high: { mgmtFeeAccumulation: 0.004, mgmtFeeDeposit: 0.001, return1Y: 7.0, return5Y: 6.0 },
    medium: { mgmtFeeAccumulation: 0.0035, mgmtFeeDeposit: 0.001, return1Y: 5.5, return5Y: 5.0 },
    low: { mgmtFeeAccumulation: 0.003, mgmtFeeDeposit: 0.0008, return1Y: 3.8, return5Y: 3.6 },
  },
};

const TOP_QUARTILE = {
  mgmtFeeAccumulation: 0.002,
  mgmtFeeDeposit: 0.0005,
  return1Y: 9.5,
};

/** Popular tracks — id, provider, name, productType, riskLevel, fees, returns, rank (1=best in cohort) */
const TRACKS = [
  { id: 'migdal_comp_high', provider: 'מגדל', name: 'מגדל מקיפה', productType: 'pension_comprehensive', riskLevel: 'high', mgmtFeeAccumulation: 0.0035, mgmtFeeDeposit: 0.001, return1Y: 9.1, return5Y: 7.2, rank: 12 },
  { id: 'migdal_comp_med', provider: 'מגדל', name: 'מגדל מקיפה כללי', productType: 'pension_comprehensive', riskLevel: 'medium', mgmtFeeAccumulation: 0.0032, mgmtFeeDeposit: 0.001, return1Y: 7.0, return5Y: 6.1, rank: 18 },
  { id: 'migdal_comp_low', provider: 'מגדל', name: 'מגדל מקיפה סולידי', productType: 'pension_comprehensive', riskLevel: 'low', mgmtFeeAccumulation: 0.0028, mgmtFeeDeposit: 0.0008, return1Y: 4.5, return5Y: 4.1, rank: 22 },
  { id: 'harel_comp_high', provider: 'הראל', name: 'הראל מקיפה מניות', productType: 'pension_comprehensive', riskLevel: 'high', mgmtFeeAccumulation: 0.0038, mgmtFeeDeposit: 0.001, return1Y: 8.8, return5Y: 7.0, rank: 15 },
  { id: 'harel_comp_med', provider: 'הראל', name: 'Harel מקיפה', productType: 'pension_comprehensive', riskLevel: 'medium', mgmtFeeAccumulation: 0.0035, mgmtFeeDeposit: 0.001, return1Y: 6.8, return5Y: 5.9, rank: 20 },
  { id: 'clal_comp_high', provider: 'כלל', name: 'כלל מקיפה', productType: 'pension_comprehensive', riskLevel: 'high', mgmtFeeAccumulation: 0.0042, mgmtFeeDeposit: 0.0012, return1Y: 8.5, return5Y: 6.8, rank: 25 },
  { id: 'clal_comp_med', provider: 'כלל', name: 'כלל ביטוח מנהלים', productType: 'managers_insurance', riskLevel: 'medium', mgmtFeeAccumulation: 0.0055, mgmtFeeDeposit: 0.0015, return1Y: 5.5, return5Y: 5.0, rank: 35 },
  { id: 'phoenix_comp', provider: 'פenix', name: 'פenix מקיפה', productType: 'pension_comprehensive', riskLevel: 'medium', mgmtFeeAccumulation: 0.0033, mgmtFeeDeposit: 0.001, return1Y: 6.6, return5Y: 5.7, rank: 21 },
  { id: 'menora_comp', provider: 'מנורה', name: 'מנורה מבטחים מקיפה', productType: 'pension_comprehensive', riskLevel: 'medium', mgmtFeeAccumulation: 0.0034, mgmtFeeDeposit: 0.001, return1Y: 6.4, return5Y: 5.6, rank: 24 },
  { id: 'altshuler_study', provider: 'מיטב דש', name: 'מיטב השתלמות', productType: 'study_fund', riskLevel: 'medium', mgmtFeeAccumulation: 0.0022, mgmtFeeDeposit: 0.0005, return1Y: 7.2, return5Y: 6.2, rank: 8 },
  { id: 'migdal_study', provider: 'מגדל', name: 'מגדל השתלמות', productType: 'study_fund', riskLevel: 'high', mgmtFeeAccumulation: 0.0025, mgmtFeeDeposit: 0.0005, return1Y: 8.8, return5Y: 7.0, rank: 10 },
  { id: 'harel_study', provider: 'הראל', name: 'הראל השתלמות', productType: 'study_fund', riskLevel: 'medium', mgmtFeeAccumulation: 0.0024, mgmtFeeDeposit: 0.0005, return1Y: 7.0, return5Y: 6.0, rank: 12 },
  { id: 'harel_gemel', provider: 'הראל', name: 'הראל גמל להשקעה', productType: 'provident_fund', riskLevel: 'medium', mgmtFeeAccumulation: 0.0028, mgmtFeeDeposit: 0.0008, return1Y: 6.5, return5Y: 5.8, rank: 16 },
  { id: 'migdal_gemel', provider: 'מגדל', name: 'מגדל גמל', productType: 'provident_fund', riskLevel: 'medium', mgmtFeeAccumulation: 0.0026, mgmtFeeDeposit: 0.0007, return1Y: 6.8, return5Y: 6.0, rank: 14 },
  { id: 'altshuler_gemel_high', provider: 'אלטשולר', name: 'אלטשולר גמל מניות', productType: 'provident_fund', riskLevel: 'high', mgmtFeeAccumulation: 0.0025, mgmtFeeDeposit: 0.0006, return1Y: 9.2, return5Y: 7.5, rank: 5 },
  { id: 'psagot_gemel', provider: 'פסגות', name: 'פסגות גמל', productType: 'provident_fund', riskLevel: 'high', mgmtFeeAccumulation: 0.0022, mgmtFeeDeposit: 0.0005, return1Y: 9.5, return5Y: 7.8, rank: 3 },
  { id: 'meitav_study_low', provider: 'מיטב דש', name: 'מיטב השתלמות מדדים', productType: 'study_fund', riskLevel: 'low', mgmtFeeAccumulation: 0.0018, mgmtFeeDeposit: 0.0004, return1Y: 4.8, return5Y: 4.3, rank: 28 },
  { id: 'clal_old', provider: 'כלל', name: 'כלל פנסיה ותיקה', productType: 'pension_old', riskLevel: 'low', mgmtFeeAccumulation: 0.0045, mgmtFeeDeposit: 0.0012, return1Y: 3.2, return5Y: 3.5, rank: 40 },
  { id: 'harel_managers', provider: 'הראל', name: 'הראל ביטוח מנהלים', productType: 'managers_insurance', riskLevel: 'medium', mgmtFeeAccumulation: 0.0052, mgmtFeeDeposit: 0.0014, return1Y: 5.8, return5Y: 5.1, rank: 32 },
  { id: 'migdal_sp500', provider: 'מגדל', name: 'מגדל S&P 500', productType: 'pension_comprehensive', riskLevel: 'high', mgmtFeeAccumulation: 0.003, mgmtFeeDeposit: 0.0008, return1Y: 10.2, return5Y: 8.5, rank: 2 },
  { id: 'harel_sp500', provider: 'הראל', name: 'הראל S&P 500', productType: 'study_fund', riskLevel: 'high', mgmtFeeAccumulation: 0.002, mgmtFeeDeposit: 0.0004, return1Y: 10.5, return5Y: 8.8, rank: 1 },
  { id: 'migdal_index', provider: 'מגדל', name: 'מגדל מדדים', productType: 'pension_comprehensive', riskLevel: 'low', mgmtFeeAccumulation: 0.0025, mgmtFeeDeposit: 0.0007, return1Y: 4.0, return5Y: 3.9, rank: 26 },
  { id: 'clal_study', provider: 'כלל', name: 'כלל השתלמות', productType: 'study_fund', riskLevel: 'medium', mgmtFeeAccumulation: 0.0028, mgmtFeeDeposit: 0.0006, return1Y: 6.8, return5Y: 5.9, rank: 18 },
  { id: 'menora_study', provider: 'מנורה', name: 'מנורה השתלמות', productType: 'study_fund', riskLevel: 'medium', mgmtFeeAccumulation: 0.0026, mgmtFeeDeposit: 0.0005, return1Y: 6.9, return5Y: 6.1, rank: 15 },
  { id: 'phoenix_gemel', provider: 'פenix', name: 'פenix גמל', productType: 'provident_fund', riskLevel: 'medium', mgmtFeeAccumulation: 0.003, mgmtFeeDeposit: 0.0008, return1Y: 6.0, return5Y: 5.5, rank: 22 },
];

function getMarketAverage(productType, riskLevel) {
  const pt = MARKET_AVERAGES[productType] || MARKET_AVERAGES.other;
  return pt[riskLevel] || pt.medium;
}

function getTracksByCohort(productType, riskLevel) {
  return TRACKS.filter(t => t.productType === productType && t.riskLevel === riskLevel);
}

function getAllTracks() {
  return TRACKS;
}

module.exports = {
  MARKET_AVERAGES,
  TOP_QUARTILE,
  TRACKS,
  getMarketAverage,
  getTracksByCohort,
  getAllTracks,
};
