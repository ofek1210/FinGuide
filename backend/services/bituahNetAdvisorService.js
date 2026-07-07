'use strict';

const BituahNetFund = require('../models/BituahNetFund');
const config = require('../config/bituahNetConfig');
const { buildGovFundAdvice } = require('./govFundMarketAdvisorService');

const OLD_POLICY = /1990|1991|1992|2003|לפני 2004/i;

/**
 * Build bituah-net advice for life insurance investment tracks.
 * @param {object[]} policies — from Har HaBituach (type life / critical_illness)
 */
async function buildBituahMarketAdvice(policies, profile = {}) {
  const lifePolicies = (policies || [])
    .filter(p => p.status !== 'cancelled' && p.status !== 'expired')
    .filter(p => ['life', 'critical_illness', 'mortgage'].includes(p.type))
    .map(p => ({
      companyName: p.provider || '',
      productName: p.policyNumber ? `${p.type} ${p.policyNumber}` : p.type,
      productType: p.type,
      totalSavings: p.coverageAmount || p.monthlyPremium * 120 || 0,
      depositFee: null,
      assetFee: null,
      isActive: true,
      monthlyPremium: p.monthlyPremium,
    }));

  const advice = await buildGovFundAdvice(lifePolicies, BituahNetFund, {
    dataSource: 'bituahnet_db',
    sourceName: config.sourceName,
    userAge: profile.personal?.age,
    oldPolicyPattern: OLD_POLICY,
    emptyMessage: 'לא נמצאו פוליסות חיים/חיסכון לניתוח מסלול.',
    syncHint: 'מאגר ביטוח-נט ריק — הרץ npm run sync:gov או העלה bituah-net.csv',
    disclaimer: 'המידע מבוסס על ביטוח-נט (data.gov.il) — אינו ייעוץ ביטוחי.',
  });

  if (advice.hasData) {
    advice.funds = advice.funds.map((f, i) => ({
      ...f,
      monthlyPremium: lifePolicies[i]?.monthlyPremium ?? null,
    }));
  }

  return advice;
}

module.exports = { buildBituahMarketAdvice };
