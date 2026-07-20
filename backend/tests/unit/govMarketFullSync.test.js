'use strict';

const {
  compoundMonthlyYields,
  classifyPensiaFund,
  classifyGemelFund,
  computePensiaCohortAnnualFromCkan,
  computeGemelCohortAnnualFromCkan,
} = require('../../services/cohortAnnualComputeService');
const { scoreCsvResource } = require('../../services/govResourceDiscoveryService');

describe('cohortAnnualComputeService', () => {
  it('compoundMonthlyYields chains percent units', () => {
    expect(compoundMonthlyYields([1, 1])).toBeCloseTo(2.01, 2);
  });

  it('classifies pensia fund types', () => {
    expect(classifyPensiaFund('קרנות חדשות')).toBe('new');
    expect(classifyPensiaFund('קרנות כלליות')).toBe('general');
  });

  it('classifies gemel fund types', () => {
    expect(classifyGemelFund('קרנות השתלמות')).toBe('histalmut');
    expect(classifyGemelFund('תגמולים ואישית לפיצויים')).toBe('tagmulim');
  });

  it('computes pensia cohort annual from CKAN rows', () => {
    const records = [
      {
        FUND_ID: 1,
        FUND_CLASSIFICATION: 'קרנות כלליות',
        REPORT_PERIOD: 202501,
        MONTHLY_YIELD: 1,
        TOTAL_ASSETS: 100,
      },
      {
        FUND_ID: 1,
        FUND_CLASSIFICATION: 'קרנות כלליות',
        REPORT_PERIOD: 202502,
        MONTHLY_YIELD: 1,
        TOTAL_ASSETS: 110,
      },
      {
        FUND_ID: 2,
        FUND_CLASSIFICATION: 'קרנות חדשות',
        REPORT_PERIOD: 202501,
        MONTHLY_YIELD: 2,
        TOTAL_ASSETS: 50,
      },
      {
        FUND_ID: 2,
        FUND_CLASSIFICATION: 'קרנות חדשות',
        REPORT_PERIOD: 202502,
        MONTHLY_YIELD: 2,
        TOTAL_ASSETS: 55,
      },
    ];

    const { rows, meta } = computePensiaCohortAnnualFromCkan(records);
    expect(meta.source).toBe('data_gov_computed');
    expect(rows.length).toBeGreaterThan(0);
    const y2025 = rows.find(r => r.year === 2025);
    expect(y2025.returnPctGeneral).not.toBeNull();
    expect(y2025.returnPctNew).not.toBeNull();
  });

  it('computes gemel cohort annual from CKAN rows', () => {
    const records = [
      {
        FUND_ID: 101,
        FUND_CLASSIFICATION: 'תגמולים ואישית לפיצויים',
        REPORT_PERIOD: 202512,
        MONTHLY_YIELD: 0.5,
        TOTAL_ASSETS: 1000,
        YEAR_TO_DATE_YIELD: 6,
      },
    ];
    const { rows } = computeGemelCohortAnnualFromCkan(records);
    expect(rows.length).toBe(1);
    expect(rows[0].assetsTagmulimMillions).toBe(1000);
  });
});

describe('govResourceDiscoveryService scoring', () => {
  it('prefers "היום" CSV resources', () => {
    const today = { format: 'CSV', name: 'נתוני הפנסיה נט לשנים 2024-היום', last_modified: '2026-01-01' };
    const old = { format: 'CSV', name: 'נתוני הפנסיה נט לשנת 2023', last_modified: '2026-06-01' };
    expect(scoreCsvResource(today)).toBeGreaterThan(scoreCsvResource(old));
  });
});

describe('gemelNetCohortAnnualParser', () => {
  it('parses synthetic gemel cohort sheet', () => {
    const { parseGemelNetCohortAnnualExcel } = require('../../services/gemelNetCohortAnnualParser');
    const XLSX = require('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      [], [],
      ['', '', '(19/7/2026)', '', 'סה"כ נכסי הקופות - לפי סוג קופה'],
      [], [],
      ['', '', '', '', '', '', '', '', '', 'נכון לסוף מאי 2026'],
      ['', '', '', '', '', '', 'תשואה שנתית', 'סה"כ נכסים', '', '', '', '', '', '', '', 'קרנות השתלמות', '', 'תגמולים', 'שנת דיווח'],
      ['', '', '', '', '', '', 13.65, 1009110.61, '', '', '', '', '', '', '', 480916, '', 401562, '2025'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'tsuotHodPtihaRDL');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xls' });

    const parsed = parseGemelNetCohortAnnualExcel(buf);
    expect(parsed.rows.length).toBe(1);
    expect(parsed.rows[0].year).toBe(2025);
    expect(parsed.rows[0].returnPctTotal).toBe(13.65);
    expect(parsed.rows[0].assetsHistalmutMillions).toBe(480916);
  });
});

describe('cmaReportDownloadService', () => {
  const { isExcelBuffer } = require('../../services/cmaReportDownloadService');

  it('detects OLE2 xls magic bytes', () => {
    expect(isExcelBuffer(Buffer.from([0xD0, 0xCF, 0x11, 0xE0]))).toBe(true);
    expect(isExcelBuffer(Buffer.from('<html>'))).toBe(false);
  });
});
