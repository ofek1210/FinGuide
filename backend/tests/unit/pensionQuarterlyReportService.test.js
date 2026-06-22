'use strict';

const path = require('path');
const fs = require('fs');
const { parseQuarterlyReportText, detectProvider } = require('../../services/pensionQuarterlyReportService');

const FIXTURE_DIR = path.join(__dirname, '../fixtures/har-hakesef');

describe('pensionQuarterlyReportService', () => {
  it('detectProvider identifies Migdal', () => {
    expect(detectProvider('דוח תקופתי מגדל מקיפה')).toBe('מגדל');
  });

  it('parseQuarterlyReportText extracts fund from quarterly layout', () => {
    const text = fs.readFileSync(path.join(FIXTURE_DIR, 'sample-quarterly-report.txt'), 'utf8');
    const result = parseQuarterlyReportText(text, 'migdal-quarterly.pdf');
    expect(result.source).toBe('quarterly_report');
    expect(result.funds.length).toBeGreaterThanOrEqual(1);
    expect(result.funds[0].provider).toBe('מגדל');
    expect(result.funds[0].currentBalance).toBe(220000);
  });

  it('falls back to Har HaKesef table parser when layout matches', () => {
    const text = fs.readFileSync(path.join(FIXTURE_DIR, 'sample-report-text.txt'), 'utf8');
    const result = parseQuarterlyReportText(text);
    expect(result.funds.length).toBeGreaterThanOrEqual(3);
  });
});
