

const { buildActionItems } = require('../../ai/services/actionItemsBuilder');

describe('buildActionItems', () => {
  it('prioritizes pension SWITCH and insurance duplicates', () => {
    const items = buildActionItems({
      canvas: { domains: {} },
      recommendations: [],
      agentResults: {
        pension: {
          data: {
            fundAdvice: {
              overallVerdict: 'SWITCH',
              overallVerdictLabelHe: 'שקול קרן',
              funds: [{ summaryHe: 'דמי ניהול גבוהים מהשוק' }],
            },
          },
        },
        insurance: {
          data: {
            duplicateCount: 2,
            aggregation: { redundantDuplications: 1, cancellableMonthlyWaste: 150 },
            marketAdvice: { overallVerdict: 'REVIEW', overallVerdictLabelHe: 'בדוק מחדש' },
          },
        },
      },
      globalScore: null,
    });

    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0].domain).toBe('pension');
    expect(items.some(i => i.title.includes('כפל ביטוחי'))).toBe(true);
  });

  it('adds upload tasks from canvas when data is missing', () => {
    const items = buildActionItems({
      canvas: {
        domains: {
          payslip: {
            id: 'payslip',
            labelHe: 'שכר',
            dataAvailable: false,
            priority: 'high',
            tasks: [{ id: 'upload', label: 'העלאת תלושים', priority: 'high' }],
          },
        },
      },
      recommendations: [],
      agentResults: {},
      globalScore: null,
    });

    expect(items.some(i => i.source === 'execution_canvas')).toBe(true);
  });
});
