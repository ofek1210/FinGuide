'use strict';

const { formatDomainHealthLines } = require('../../utils/summaryFormatters');

describe('summaryFormatters', () => {
  it('formatDomainHealthLines includes pension and insurance scores', () => {
    const lines = formatDomainHealthLines({
      pension: { healthScore: 72, totalPotentialSavings: 50000 },
      insurance: { healthScore: 65, duplicateCount: 2 },
    });
    expect(lines.some(l => l.includes('פנסיונית'))).toBe(true);
    expect(lines.some(l => l.includes('ביטוח'))).toBe(true);
    expect(lines.some(l => l.includes('50000') || l.includes('50,000'))).toBe(true);
  });
});
