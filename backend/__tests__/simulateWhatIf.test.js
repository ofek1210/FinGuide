const { simulateWhatIf } = require('../utils/simulateWhatIf');

describe('simulateWhatIf', () => {
  test('increase gross by percent', () => {
    const result = simulateWhatIf({
      gross: 10000,
      net: 7500,
      change: { type: 'gross_percent', value: 0.1 },
    });

    expect(result.scenario).toEqual({ gross: 11000, net: 8180 });
    expect(result.delta).toEqual({ gross: 1000, net: 680 });
  });

  test('decrease gross by percent', () => {
    const result = simulateWhatIf({
      gross: 10000,
      net: 7500,
      change: { type: 'gross_percent', value: -0.1 },
    });

    expect(result.scenario).toEqual({ gross: 9000, net: 6776.2 });
    expect(result.delta).toEqual({ gross: -1000, net: -723.8 });
  });

  test('increase gross by amount', () => {
    const result = simulateWhatIf({
      gross: 10000,
      net: 7500,
      change: { type: 'gross_amount', value: 2000 },
    });

    expect(result.scenario).toEqual({ gross: 12000, net: 8860 });
    expect(result.delta).toEqual({ gross: 2000, net: 1360 });
  });

  test('decrease gross by amount', () => {
    const result = simulateWhatIf({
      gross: 10000,
      net: 7500,
      change: { type: 'gross_amount', value: -500 },
    });

    expect(result.scenario).toEqual({ gross: 9500, net: 7146.2 });
    expect(result.delta).toEqual({ gross: -500, net: -353.8 });
  });
});
