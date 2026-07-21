'use strict';

const gov = require('./govDataConfig');

/** CMA Pensia-Net / Gemel-Net macro Excel reports (tsuotHodPtihaRDL.xls) */
module.exports = {
  enabled: process.env.CMA_REPORTS_ENABLED !== 'false',
  fetchTimeoutMs: Number(process.env.CMA_REPORTS_FETCH_TIMEOUT_MS) || 45000,
  userAgent: process.env.CMA_REPORTS_USER_AGENT || gov.userAgent,

  pensia: {
    packageId: process.env.PENSIANET_PACKAGE_ID || '3a1ca8fa-738b-4890-b52f-e8f7ce1e6145',
    excelUrl: process.env.PENSIANET_COHORT_EXCEL_URL
      || 'https://pensyanet.cma.gov.il/tsuot/ui/tsuotHodPtihaRDL.xls',
  },
  gemel: {
    packageId: process.env.GEMELNET_PACKAGE_ID || '5265b154-c2e2-4f3d-a22e-fba593240d9a',
    excelUrl: process.env.GEMELNET_COHORT_EXCEL_URL
      || 'https://gemelnet.cma.gov.il/tsuot/UI/Excel/tsuotHodPtihaRDL.xls',
  },

  /** When CMA Excel is unavailable, derive cohort tables from CKAN CSV */
  computeCohortFromCkan: process.env.CMA_COMPUTE_COHORT_FROM_CKAN !== 'false',
};
