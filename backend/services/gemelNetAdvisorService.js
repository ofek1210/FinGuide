'use strict';

const GemelNetFund = require('../models/GemelNetFund');
const config = require('../config/gemelNetConfig');
const { buildGovFundAdvice } = require('./govFundMarketAdvisorService');
const { normalizeProductRow } = require('../utils/pensionProductNormalizer');

function isGemelProduct(productType, productName) {
  const ctx = `${productType || ''} ${productName || ''}`;
  return /גמל|השתלמות|תגמול|provident|study.?fund/i.test(ctx)
    && !/פנסיה|pension/i.test(ctx);
}

function filterGemelProducts(products) {
  return (products || [])
    .map(normalizeProductRow)
    .filter(Boolean)
    .filter(p => isGemelProduct(p.productType, p.productName))
    .filter(p => p.isActive !== false)
    .map(p => ({
      companyName: p.companyName,
      productName: p.productName,
      productType: p.productType,
      totalSavings: p.totalSavings,
      depositFee: p.depositFee,
      assetFee: p.assetFee,
      isActive: p.isActive,
    }));
}

function gemelCohortFilter(fund) {
  const cls = fund.SUG_KRN || '';
  return /השתלמות|גמל|תגמול/i.test(cls) || /השתלמות|גמל/i.test(fund.SHM_KRN || '');
}

async function buildGemelMarketAdvice(products, profile = {}) {
  const gemelProducts = filterGemelProducts(products);
  return buildGovFundAdvice(gemelProducts, GemelNetFund, {
    dataSource: 'gemelnet_db',
    sourceName: config.sourceName,
    userAge: profile.currentAge ?? profile.personal?.age,
    cohortFilter: gemelCohortFilter,
    emptyMessage: 'לא נמצאו מוצרי גמל/השתלמות לניתוח.',
    syncHint: 'מאגר גמל-נט ריק — הרץ npm run sync:gov או העלה gemel-net.csv',
    disclaimer: 'המידע מבוסס על גמל-נט (data.gov.il) — אינו ייעוץ פנסיוני.',
  });
}

module.exports = { buildGemelMarketAdvice, filterGemelProducts, isGemelProduct };
