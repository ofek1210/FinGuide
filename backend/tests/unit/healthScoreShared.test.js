'use strict';

const {
  statusFromRatio,
  getScoreLevel,
  buildHealthCheckResult,
} = require('../../utils/healthScoreShared');

describe('healthScoreShared', () => {
  it('statusFromRatio maps thresholds', () => {
    expect(statusFromRatio(0.9)).toBe('good');
    expect(statusFromRatio(0.6)).toBe('warning');
    expect(statusFromRatio(0.3)).toBe('poor');
  });

  it('getScoreLevel uses domain labels', () => {
    expect(getScoreLevel(90, 'pension').label).toContain('פנסיה');
    expect(getScoreLevel(40, 'insurance').level).toBe('poor');
  });

  it('buildHealthCheckResult sums categories', () => {
    const result = buildHealthCheckResult(
      [{ id: 'a', label: 'A', score: 20, maxScore: 25, status: 'good' }],
      'disclaimer',
      'pension',
    );
    expect(result.score).toBe(20);
    expect(result.disclaimer).toBe('disclaimer');
  });
});
