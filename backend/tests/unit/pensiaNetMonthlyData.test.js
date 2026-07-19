'use strict';

const { parsePensiaNetCohortAnnualExcel } = require('../../services/pensiaNetCohortAnnualParser');
const { computeMonthlyConsistency, computeTrackPerformanceAnalysis } = require('../../services/pensiaNetMonthlyAnalysisService');
const { mapApiRecordToMonthlyReturn, mapApiRecordToPensiaNet } = require('../../utils/pensiaNetFieldMapper');
const sampleApi = require('../fixtures/pensianet-sample-api.json');

describe('pensiaNetFieldMapper monthly + alpha', () => {
  it('maps MONTHLY_YIELD and ALPHA from CKAN', () => {
    const row = sampleApi.result.records[0];
    const monthly = mapApiRecordToMonthlyReturn(row);
    expect(monthly.fundId).toBe('1560');
    expect(monthly.monthlyYield).toBe(0.48);
    expect(monthly.alpha).toBe(1.56);

    const fund = mapApiRecordToPensiaNet(row);
    expect(fund.ALPHA).toBe(1.56);
  });
});

describe('pensiaNetCohortAnnualParser', () => {
  it('parses synthetic cohort annual sheet rows', () => {
    const XLSX = require('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      [], [],
      ['', '', '(18/7/2026)', '', 'סה"כ נכסים ותשואות - לפי סוג קרן'],
      [], [],
      ['', '', '', '', '', '', '', 'נכון לסוף מאי 2026'],
      ['', '', '', '', '', '', '', 'תשואה שנתית', '', '', 'סה"כ נכסים', '', '', '', 'שנת '],
      ['', '', '', '', '', '', '', 'קרנות כלליות', '', 'קרנות חדשות', 'קרנות כלליות', '', 'קרנות חדשות', '', 'דיווח'],
      ['', '', '', '', '', '', '', 9.8, '', 10.1, 100, '', 200, '', '', '2024'],
      ['', '', '', '', '', '', '', 10.5, '', 11.2, 90, '', 180, '', '', '2025'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'tsuotHodPtihaRDL');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xls' });

    const parsed = parsePensiaNetCohortAnnualExcel(buf);
    expect(parsed.rows.length).toBeGreaterThanOrEqual(2);
    expect(parsed.rows.find(r => r.year === 2025)?.returnPctGeneral).toBe(10.5);
    expect(parsed.meta.reportAsOf).toContain('מאי');
  });
});

describe('pensiaNetMonthlyAnalysisService', () => {
  it('computeMonthlyConsistency counts above/below median months', async () => {
    const PensiaNetMonthlyReturn = require('../../models/PensiaNetMonthlyReturn');
    jest.spyOn(PensiaNetMonthlyReturn, 'find').mockReturnValue({
      lean: () => Promise.resolve([
        { fundId: '1', reportPeriod: 202501, monthlyYield: 2.0 },
        { fundId: '2', reportPeriod: 202501, monthlyYield: 1.0 },
        { fundId: '3', reportPeriod: 202501, monthlyYield: 1.5 },
        { fundId: '4', reportPeriod: 202501, monthlyYield: 1.2 },
        { fundId: '5', reportPeriod: 202501, monthlyYield: 1.1 },
        { fundId: '6', reportPeriod: 202501, monthlyYield: 1.3 },
        { fundId: '1', reportPeriod: 202502, monthlyYield: 0.5 },
        { fundId: '2', reportPeriod: 202502, monthlyYield: 1.0 },
        { fundId: '3', reportPeriod: 202502, monthlyYield: 1.1 },
        { fundId: '4', reportPeriod: 202502, monthlyYield: 1.0 },
        { fundId: '5', reportPeriod: 202502, monthlyYield: 0.9 },
        { fundId: '6', reportPeriod: 202502, monthlyYield: 1.0 },
        { fundId: '1', reportPeriod: 202503, monthlyYield: 1.5 },
        { fundId: '2', reportPeriod: 202503, monthlyYield: 0.8 },
        { fundId: '3', reportPeriod: 202503, monthlyYield: 1.0 },
        { fundId: '4', reportPeriod: 202503, monthlyYield: 0.9 },
        { fundId: '5', reportPeriod: 202503, monthlyYield: 1.0 },
        { fundId: '6', reportPeriod: 202503, monthlyYield: 0.95 },
      ]),
    });

    const result = await computeMonthlyConsistency('1', ['2', '3', '4', '5', '6'], 12);
    expect(result).not.toBeNull();
    expect(result.monthsCompared).toBeGreaterThanOrEqual(3);
    PensiaNetMonthlyReturn.find.mockRestore();
  });

  it('computeTrackPerformanceAnalysis compounds returns and ranks vs peers', async () => {
    const PensiaNetMonthlyReturn = require('../../models/PensiaNetMonthlyReturn');

    function monthRows(trackId, startYear, startMonth, yields) {
      return yields.map((monthlyYield, i) => {
        let y = startYear;
        let m = startMonth - i;
        while (m <= 0) { m += 12; y -= 1; }
        return { trackId, fundId: trackId, reportPeriod: y * 100 + m, monthlyYield };
      });
    }

    const userRows = monthRows('user', 2025, 6, Array.from({ length: 12 }, (_, i) => 0.8 + i * 0.05));
    const peerRows = ['p1', 'p2', 'p3', 'p4', 'p5'].flatMap((id, idx) =>
      monthRows(id, 2025, 6, Array.from({ length: 12 }, () => 0.5 + idx * 0.1)),
    );

    jest.spyOn(PensiaNetMonthlyReturn, 'find').mockImplementation((query) => {
      const ids = query?.$or?.flatMap(clause => clause.trackId?.$in || clause.fundId?.$in || []) || [];
      const all = [...userRows, ...peerRows].filter(r => ids.includes(r.trackId));
      return { lean: () => Promise.resolve(all) };
    });

    const result = await computeTrackPerformanceAnalysis('user', ['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(result).not.toBeNull();
    expect(result.compounded.return12M.complete).toBe(true);
    expect(result.compounded.return12M.compoundedReturnPct).toBeGreaterThan(0);
    expect(result.peerBenchmark.percentile12M).not.toBeNull();
    expect(result.peerBenchmark.median12M).not.toBeNull();
    PensiaNetMonthlyReturn.find.mockRestore();
  });
});
