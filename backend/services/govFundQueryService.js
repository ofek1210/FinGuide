'use strict';

const GemelNetFund = require('../models/GemelNetFund');
const BituahNetFund = require('../models/BituahNetFund');
const PensiaNetFund = require('../models/PensiaNetFund');

const NET_MODELS = {
  gemel: GemelNetFund,
  bituah: BituahNetFund,
  pensia: PensiaNetFund,
};

const PUBLIC_FIELDS = [
  'ID',
  'SHM_KRN',
  'SHM_TAAGID_MENAEL',
  'SHM_TAAGID_SHOLET',
  'SUG_KRN',
  'SPECIALIZATION',
  'SUB_SPECIALIZATION',
  'TARGET_POPULATION',
  'POLICY_GENERATION',
  'TKUFAT_DUACH',
  'SHIUR_D_NIHUL_AHARON_HAFKADOT',
  'SHIUR_D_NIHUL_MEANUAL',
  'SHIUR_D_NIHUL_AHARON_TTVURAH',
  'TSUA_SHNATIT_MEMUZAAT_5_SHANIM',
  'STIAT_TEKEN_36_HODASHIM',
  'SHARPE_RATIO',
  'BETA_HUTZ_LAARETZ',
  'CHSHIF_MNUIOT',
  'YITRAT_NECHASIM',
  'NET_DOMAIN',
  'syncedAt',
].join(' ');

function resolveModel(net) {
  const Model = NET_MODELS[net];
  if (!Model) throw new Error(`Unknown net: ${net}`);
  return Model;
}

function buildFilter(query = {}) {
  const filter = {};
  if (query.classification) {
    filter.SUG_KRN = new RegExp(query.classification, 'i');
  }
  if (query.company) {
    filter.$or = [
      { SHM_TAAGID_MENAEL: new RegExp(query.company, 'i') },
      { SHM_TAAGID_SHOLET: new RegExp(query.company, 'i') },
    ];
  }
  if (query.search) {
    filter.SHM_KRN = new RegExp(query.search, 'i');
  }
  if (query.specialization) {
    filter.SPECIALIZATION = new RegExp(query.specialization, 'i');
  }
  return filter;
}

function sortField(sort) {
  const allowed = {
    return5y: 'TSUA_SHNATIT_MEMUZAAT_5_SHANIM',
    fee: 'SHIUR_D_NIHUL_AHARON_TTVURAH',
    sharpe: 'SHARPE_RATIO',
    assets: 'YITRAT_NECHASIM',
  };
  return allowed[sort] || 'TSUA_SHNATIT_MEMUZAAT_5_SHANIM';
}

async function listGovFunds(net, query = {}) {
  const Model = resolveModel(net);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const skip = (page - 1) * limit;
  const filter = buildFilter(query);
  const sortBy = sortField(query.sort);
  const sortDir = query.order === 'asc' ? 1 : -1;

  const [items, total] = await Promise.all([
    Model.find(filter)
      .select(PUBLIC_FIELDS)
      .sort({ [sortBy]: sortDir })
      .skip(skip)
      .limit(limit)
      .lean(),
    Model.countDocuments(filter),
  ]);

  return {
    net,
    page,
    limit,
    total,
    items: items.map(formatFundRow),
  };
}

async function getGovFundById(net, fundId) {
  const Model = resolveModel(net);
  const doc = await Model.findOne({ ID: String(fundId) }).select(PUBLIC_FIELDS).lean();
  if (!doc) return null;
  return formatFundRow(doc);
}

async function getLeadingGovFunds(net, { limit = 10, classification } = {}) {
  const Model = resolveModel(net);
  const filter = { TSUA_SHNATIT_MEMUZAAT_5_SHANIM: { $ne: null } };
  if (classification) filter.SUG_KRN = new RegExp(classification, 'i');

  const items = await Model.find(filter)
    .select(PUBLIC_FIELDS)
    .sort({ TSUA_SHNATIT_MEMUZAAT_5_SHANIM: -1, SHARPE_RATIO: -1 })
    .limit(Math.min(50, limit))
    .lean();

  return items.map(formatFundRow);
}

function formatFundRow(row) {
  return {
    id: row.ID,
    fundName: row.SHM_KRN,
    companyName: row.SHM_TAAGID_MENAEL || row.SHM_TAAGID_SHOLET || '',
    classification: row.SUG_KRN,
    specialization: row.SPECIALIZATION || null,
    subSpecialization: row.SUB_SPECIALIZATION || null,
    targetPopulation: row.TARGET_POPULATION || null,
    policyGeneration: row.POLICY_GENERATION || null,
    reportPeriod: row.TKUFAT_DUACH,
    depositFee: row.SHIUR_D_NIHUL_AHARON_HAFKADOT,
    assetFee: row.SHIUR_D_NIHUL_AHARON_TTVURAH ?? row.SHIUR_D_NIHUL_MEANUAL,
    return5Years: row.TSUA_SHNATIT_MEMUZAAT_5_SHANIM,
    standardDeviation: row.STIAT_TEKEN_36_HODASHIM,
    sharpeRatio: row.SHARPE_RATIO,
    stockExposure: row.CHSHIF_MNUIOT,
    foreignExposure: row.BETA_HUTZ_LAARETZ,
    totalAssets: row.YITRAT_NECHASIM,
    syncedAt: row.syncedAt,
  };
}

module.exports = {
  listGovFunds,
  getGovFundById,
  getLeadingGovFunds,
};
