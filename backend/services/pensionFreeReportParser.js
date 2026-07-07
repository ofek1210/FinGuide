

/**
 * Option A — free report (הר הביטוח / דוח בסיסי): product types + activity status only.
 * Balances are entered manually by the user in the frontend wizard.
 */
const { parseHarHaBituachBuffer, isHarHaBituachBuffer } = require('./harHaBituachService');
const { parseProductType, resolveFundType } = require('./harHaKesefService');
const { parseClearinghouseExcel, mapActivityStatus } = require('./pensionClearinghouseParser');

const PENSION_BRANCH_TYPES = new Set(['pension', 'savings', 'training_fund']);

function previewKey(provider, accountNumber, fundName) {
  return `${String(provider || '').trim()}::${String(accountNumber || fundName || '').trim()}`;
}

function toPreviewFund({
  fundName,
  provider,
  productType,
  accountNumber,
  activityStatus,
  fundType,
}) {
  const lifecycleActive = activityStatus !== 'INACTIVE';
  return {
    previewKey: previewKey(provider, accountNumber, fundName),
    fundName,
    provider: provider || null,
    productType: productType || fundName,
    accountNumber: accountNumber || null,
    activityStatus,
    fundType: fundType || resolveFundType(productType || fundName),
    status: lifecycleActive ? 'active' : 'closed',
    isActive: lifecycleActive,
    requiresManualBalance: true,
  };
}

function parseFromHarHaBituach(buffer) {
  const parsed = parseHarHaBituachBuffer(buffer);
  const funds = (parsed.policies || [])
    .filter(p => PENSION_BRANCH_TYPES.has(p.branchType))
    .map(p => {
      const parsedProduct = parseProductType(p.productType || p.subBranch || '');
      const activityStatus = parsedProduct.status === 'UNKNOWN' ? 'ACTIVE' : parsedProduct.status;
      return toPreviewFund({
        fundName: p.planClass || p.productType || p.subBranch || `${p.company} - מוצר פנסיוני`,
        provider: p.company,
        productType: parsedProduct.cleanType || p.productType,
        accountNumber: p.policyNumber,
        activityStatus,
        fundType: resolveFundType(parsedProduct.cleanType || p.productType || p.subBranch),
      });
    });

  return {
    source: 'free_report',
    sourceKind: 'har_habitua',
    funds,
    summary: {
      totalFunds: funds.length,
      parseWarnings: funds.length ? [] : ['לא נמצאו מוצרים פנסיוניים בדוח הר הביטוח'],
    },
  };
}

function parseFromClearinghouseLite(buffer) {
  const parsed = parseClearinghouseExcel(buffer);
  const funds = (parsed.funds || []).map(f => toPreviewFund({
    fundName: f.fundName,
    provider: f.provider,
    productType: f.fundType,
    accountNumber: f.accountNumber,
    activityStatus: f.activityStatus || mapActivityStatus(f.status),
    fundType: f.fundType,
  }));

  return {
    source: 'free_report',
    sourceKind: 'clearinghouse_lite',
    funds,
    summary: parsed.summary,
  };
}

/**
 * @param {Buffer} buffer
 * @param {{ ext?: string, originalName?: string }} [opts]
 */
function parsePensionFreeReport(buffer, opts = {}) {
  if (isHarHaBituachBuffer(buffer)) {
    return parseFromHarHaBituach(buffer);
  }

  const ext = (opts.ext || '').toLowerCase();
  if (['.xlsx', '.xls'].includes(ext)) {
    return parseFromClearinghouseLite(buffer);
  }

  return {
    source: 'free_report',
    sourceKind: 'unknown',
    funds: [],
    summary: {
      parseWarnings: ['פורמט קובץ לא נתמך לדוח חינמי. העלה Excel מ"הר הביטוח" או מסלקה בסיסית.'],
    },
  };
}

module.exports = {
  parsePensionFreeReport,
  previewKey,
  PENSION_BRANCH_TYPES,
};
