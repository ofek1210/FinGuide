const {
  extractFromLinesByLabelMap,
  PAYSLIP_LABEL_MAP,
  addLabelPatterns,
  normalizeLine,
  extractAmountFromLine,
  lineMatchesPattern,
} = require('../../services/payslipOcrLabelMap');

describe('payslipOcrLabelMap', () => {
  describe('extractFromLinesByLabelMap', () => {
    it('extracts gross_total and net_payable from Hebrew lines', () => {
      const lines = [
        'תלוש שכר 02/2024',
        'שכר ברוטו           20,000',
        'שכר נטו לתשלום      14,500',
        'מס הכנסה            3,000',
      ];
      const result = extractFromLinesByLabelMap(lines);
      expect(result.gross_total).toBe(20000);
      expect(result.net_payable).toBe(14500);
      expect(result.income_tax).toBe(3000);
    });

    it('extracts from alternate Hebrew labels (label-map variants)', () => {
      const lines = [
        'סך כל התשלומים 25000',
        "סה''כ לתשלום 18000",
        'כל הניכויים 7000',
        'ביטוח לאומי 1200',
        'ב.ל. 1200',
      ];
      const result = extractFromLinesByLabelMap(lines);
      expect(result.gross_total).toBe(25000);
      expect(result.net_payable).toBe(18000);
      expect(result.mandatory_total).toBe(7000);
      expect(result.national_insurance).toBe(1200);
    });

    it('extracts from English-style labels', () => {
      const lines = [
        'Gross Salary 18000',
        'Net Pay 13000',
        'Income Tax 2500',
        'National Insurance 800',
      ];
      const result = extractFromLinesByLabelMap(lines);
      expect(result.gross_total).toBe(18000);
      expect(result.net_payable).toBe(13000);
      expect(result.income_tax).toBe(2500);
      expect(result.national_insurance).toBe(800);
    });

    it('first matching field wins per line (one amount per line)', () => {
      const lines = ['שכר ברוטו 10000', 'נטו לתשלום 7500'];
      const result = extractFromLinesByLabelMap(lines);
      expect(result.gross_total).toBe(10000);
      expect(result.net_payable).toBe(7500);
    });

    it('returns empty object for empty or no-amount lines', () => {
      expect(extractFromLinesByLabelMap([])).toEqual({});
      expect(extractFromLinesByLabelMap(['רק טקסט בלי מספרים'])).toEqual({});
    });

    it('ignores amounts outside salary range', () => {
      const lines = ['שכר ברוטו 15']; // too small
      const result = extractFromLinesByLabelMap(lines);
      expect(result.gross_total).toBeUndefined();
    });

    it('extracts from table with header row (data line then header line)', () => {
      const dataLine = '3,666.51 231.66 0.00 173.88 4,072.05 0.00 4,072.05 0.00 211.05 0.00 0.00 3,861.00';
      const headerLine =
        'שכר בסיס\tתוספות\tעבודה נוספת\tהחזר הוצאות\tתש\' אחרים\tברוטו שוטף\tהפרשים\tסך תשלומים\tניכויי חובה\tניכויי משרד\tניכויי חו"ז\tסכום בבנק';
      const lines = [dataLine, headerLine];
      const result = extractFromLinesByLabelMap(lines);
      expect(result.base_salary).toBe(3666.51);
      expect(result.gross_total).toBe(4072.05);
      expect(result.mandatory_total).toBe(211.05);
      expect(result.net_payable).toBe(3861);
      expect(result.travel_expenses).toBe(173.88);
    });
  });

  describe('normalizeLine', () => {
    it('collapses spaces and normalizes quotes', () => {
      expect(normalizeLine('  שכר   ברוטו  20,000  ')).toBe('שכר ברוטו 20,000');
    });
  });

  describe('extractAmountFromLine', () => {
    it('returns largest number in valid range', () => {
      expect(extractAmountFromLine('שכר ברוטו 20,000')).toBe(20000);
      expect(extractAmountFromLine('מס 3000 ו 14')).toBe(3000);
    });
    it('returns undefined when no amount in range', () => {
      expect(extractAmountFromLine('אחוז 7.5')).toBeUndefined();
    });
  });

  describe('lineMatchesPattern', () => {
    it('matches string pattern when normalized line includes it', () => {
      expect(lineMatchesPattern('  שכר ברוטו  20,000  ', 'שכר ברוטו')).toBe(true);
      expect(lineMatchesPattern('Gross Salary 10000', 'Gross')).toBe(true);
    });
    it('matches RegExp pattern', () => {
      expect(lineMatchesPattern('מס הכנסה 3000', /מס\s*הכנסה/i)).toBe(true);
    });
  });

  describe('addLabelPatterns', () => {
    it('allows adding patterns for existing field', () => {
      const custom = 'תשלום ברוטו סה"כ';
      addLabelPatterns('gross_total', custom);
      const result = extractFromLinesByLabelMap([`${custom} 9999`]);
      expect(result.gross_total).toBe(9999);
      PAYSLIP_LABEL_MAP.gross_total.pop();
    });
  });
});
