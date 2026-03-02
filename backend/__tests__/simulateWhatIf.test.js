const { simulateWhatIf } = require('../utils/simulateWhatIf');

describe('simulateWhatIf', () => {
  test('increase gross by percent', () => {
    const result = simulateWhatIf({
      gross: 10000,
      net: 7500,
      change: { type: 'gross_percent', value: 0.1 },
    });

    expect(result.scenario).toEqual({ gross: 11000, net: 8250 });
    expect(result.delta).toEqual({ gross: 1000, net: 750 });
  });

  test('decrease gross by percent', () => {
    const result = simulateWhatIf({
      gross: 10000,
      net: 7500,
      change: { type: 'gross_percent', value: -0.1 },
    });

    expect(result.scenario).toEqual({ gross: 9000, net: 6750 });
    expect(result.delta).toEqual({ gross: -1000, net: -750 });
  });

  test('increase gross by amount', () => {
    const result = simulateWhatIf({
      gross: 10000,
      net: 7500,
      change: { type: 'gross_amount', value: 2000 },
    });

    expect(result.scenario).toEqual({ gross: 12000, net: 9000 });
    expect(result.delta).toEqual({ gross: 2000, net: 1500 });
  });

  test('decrease gross by amount', () => {
    const result = simulateWhatIf({
      gross: 10000,
      net: 7500,
      change: { type: 'gross_amount', value: -500 },
    });

    expect(result.scenario).toEqual({ gross: 9500, net: 7125 });
    expect(result.delta).toEqual({ gross: -500, net: -375 });
  });
});
