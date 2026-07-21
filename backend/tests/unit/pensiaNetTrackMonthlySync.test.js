'use strict';

const {
  parseReportPeriod,
  computeCompoundedReturn,
  buildCompoundedWindows,
  monthIndex,
} = require('../../utils/pensiaNetCompounding');
const {
  validateAndMapTrackMonthlyRows,
} = require('../../services/pensiaNetTrackMonthlySyncService');
const sampleApi = require('../fixtures/pensianet-sample-api.json');

describe('pensiaNetCompounding', () => {
  it('parseReportPeriod splits YYYYMM', () => {
    expect(parseReportPeriod(202405)).toEqual({ year: 2024, month: 5, reportPeriod: 202405 });
    expect(parseReportPeriod(202413)).toBeNull();
  });

  it('computeCompoundedReturn uses multiplicative compounding not sum', () => {
    const rows = [
      { reportPeriod: 202403, monthlyYield: 1 },
      { reportPeriod: 202402, monthlyYield: 1 },
      { reportPeriod: 202401, monthlyYield: 1 },
    ];
    const r = computeCompoundedReturn(rows, 3);
    expect(r.complete).toBe(true);
    expect(r.compoundedReturnPct).toBeCloseTo(3.03, 1);
    expect(r.compoundedReturnPct).not.toBe(3);
  });

  it('returns null when months are missing in period', () => {
    const rows = [
      { reportPeriod: 202403, monthlyYield: 1 },
      { reportPeriod: 202401, monthlyYield: 1 },
    ];
    const r = computeCompoundedReturn(rows, 2);
    expect(r.compoundedReturnPct).toBeNull();
    expect(r.missingMonths).toBe(true);
  });

  it('buildCompoundedWindows exposes 12/36/60 with monthsUsed', () => {
    const rows = [];
    for (let i = 0; i < 60; i += 1) {
      const idx = monthIndex(2024, 6) - i;
      const year = Math.floor((idx - 1) / 12);
      const month = ((idx - 1) % 12) + 1;
      rows.push({ reportPeriod: year * 100 + month, monthlyYield: 0.5 });
    }
    const w = buildCompoundedWindows(rows);
    expect(w.return12M.monthsUsed).toBe(12);
    expect(w.return36M.complete).toBe(true);
    expect(w.return60M.complete).toBe(true);
    expect(w.lastReportDate).toBe('2024-06');
  });
});

describe('pensiaNetTrackMonthlySyncService validation', () => {
  it('maps CKAN rows at track level with official trackId', () => {
    const records = sampleApi.result.records;
    const { docs, report } = validateAndMapTrackMonthlyRows(records);
    expect(report.rowsRead).toBe(2);
    expect(report.tracksIdentified).toBe(1);
    expect(docs[0].trackId).toBe('1560');
    expect(docs[0].reportYear).toBe(2024);
    expect(docs[0].reportMonth).toBeGreaterThan(0);
    expect(docs[0].monthlyYield).toBe(0.48);
  });

  it('rejects rows without monthly yield', () => {
    const { report } = validateAndMapTrackMonthlyRows([
      { FUND_ID: 1, REPORT_PERIOD: 202401, FUND_NAME: 'test' },
    ]);
    expect(report.rejected).toBe(1);
    expect(report.rejectionReasons.missing_monthly_yield).toBe(1);
  });
});
