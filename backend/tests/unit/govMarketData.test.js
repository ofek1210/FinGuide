'use strict';

const { parseGovCsv } = require('../../utils/govCsvParser');
const { mapApiRecordToGemelNet } = require('../../utils/gemelNetFieldMapper');
const { mapApiRecordToBituahNet } = require('../../utils/bituahNetFieldMapper');
const { analyzeProduct, VERDICT } = require('../../services/govFundMarketAdvisorService');

describe('govCsvParser', () => {
  it('parses quoted CSV header and rows', () => {
    const csv = 'FUND_ID,FUND_NAME,REPORT_PERIOD\n"101","Test Fund","202401"\n';
    const rows = parseGovCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].FUND_ID).toBe('101');
    expect(rows[0].FUND_NAME).toBe('Test Fund');
  });
});

describe('gemelNetFieldMapper', () => {
  it('maps CKAN row to gemel net shape', () => {
    const mapped = mapApiRecordToGemelNet({
      FUND_ID: 101,
      FUND_NAME: 'הראל השתלמות',
      FUND_CLASSIFICATION: 'קרנות השתלמות',
      PARENT_COMPANY_NAME: 'הראל',
      REPORT_PERIOD: 202605,
      AVG_ANNUAL_MANAGEMENT_FEE: 0.61,
      AVG_DEPOSIT_FEE: 0.44,
      AVG_ANNUAL_YIELD_TRAILING_5YRS: 4.35,
      SHARPE_RATIO: 0.47,
      STOCK_MARKET_EXPOSURE: 3,
    });
    expect(mapped.ID).toBe('101');
    expect(mapped.NET_DOMAIN).toBe('gemel');
    expect(mapped.SHIUR_D_NIHUL_AHARON_TTVURAH).toBe(0.61);
    expect(mapped.TSUA_SHNATIT_MEMUZAAT_5_SHANIM).toBe(4.35);
  });
});

describe('bituahNetFieldMapper', () => {
  it('maps CKAN row to bituah net shape', () => {
    const mapped = mapApiRecordToBituahNet({
      FUND_ID: 55,
      FUND_NAME: 'מסלול אשראי ואג"ח',
      FUND_CLASSIFICATION: '2004+',
      PARENT_COMPANY_NAME: 'כלל',
      REPORT_PERIOD: 202605,
      AVG_ANNUAL_MANAGEMENT_FEE: 0.99,
      AVG_ANNUAL_YIELD_TRAILING_5YRS: 2.9,
      SHARPE_RATIO: 0.4,
    });
    expect(mapped.ID).toBe('55');
    expect(mapped.NET_DOMAIN).toBe('bituah');
    expect(mapped.POLICY_GENERATION).toBe('2004+');
  });
});

describe('govFundMarketAdvisorService', () => {
  const marketFunds = [
    {
      ID: '1',
      SHM_KRN: 'מוביל',
      SHM_TAAGID_MENAEL: 'מיטב',
      TSUA_SHNATIT_MEMUZAAT_5_SHANIM: 6.5,
      SHIUR_D_NIHUL_AHARON_TTVURAH: 0.6,
      SHIUR_D_NIHUL_AHARON_HAFKADOT: 0.4,
      SHARPE_RATIO: 0.63,
      CHSHIF_MNUIOT: 25,
    },
    {
      ID: '2',
      SHM_KRN: 'ממוצע',
      SHM_TAAGID_MENAEL: 'כלל',
      TSUA_SHNATIT_MEMUZAAT_5_SHANIM: 4.0,
      SHIUR_D_NIHUL_AHARON_TTVURAH: 0.8,
      SHIUR_D_NIHUL_AHARON_HAFKADOT: 0.5,
      SHARPE_RATIO: 0.5,
      CHSHIF_MNUIOT: 10,
    },
  ];

  it('returns NEGOTIATE when fees are high vs market', () => {
    const result = analyzeProduct(
      {
        companyName: 'הפניקס',
        productName: 'קרן השתלמות',
        productType: 'קרנות השתלמות',
        totalSavings: 200000,
        depositFee: 1.39,
        assetFee: 1.39,
        isActive: true,
      },
      marketFunds,
      { userAge: 32 },
    );
    expect([VERDICT.NEGOTIATE, VERDICT.REVIEW, VERDICT.SWITCH]).toContain(result.verdict);
    expect(result.summaryHe).toMatch(/NEGOTIATE|דמ"נ|SWITCH|REVIEW/i);
  });

  it('suggests equity route for young user with low stock exposure', () => {
    const lowStockFund = [{
      ...marketFunds[1],
      ID: '99',
      CHSHIF_MNUIOT: 3,
    }];
    const result = analyzeProduct(
      {
        companyName: 'כלל',
        productName: 'השתלמות כללית',
        productType: 'קרנות השתלמות',
        totalSavings: 100000,
        depositFee: 0.5,
        assetFee: 0.61,
        isActive: true,
      },
      lowStockFund,
      { userAge: 32 },
    );
    expect(result.riskNote).toMatch(/מנייתי|מניות/i);
  });
});
