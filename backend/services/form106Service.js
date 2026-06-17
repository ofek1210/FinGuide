/**
 * Parser for Israeli טופס 106 / תעודה על-פי תקנות מס הכנסה.
 * Extracts annual salary and tax summary from the PDF text.
 *
 * The PDF uses RTL bidi encoding: pdftotext -layout places numbers on the left,
 * Hebrew labels on the right. We strip bidi control chars and search each line
 * for known Hebrew keywords + the number on the same line.
 */

const FORM_106_MARKERS = [
  /תעודה\s+על[\s\-]+פי\s+תקנות\s+מס\s+הכנסה/i,
  /תשלומים\s+וניכויים\s+ממשכורת/i,
  /במקום\s+טופס\s+106/i,
  /טופס\s+106\b/i,
];

/**
 * Returns true if the extracted PDF text looks like a Form 106.
 */
function isForm106(text) {
  if (!text || typeof text !== 'string') return false;
  return FORM_106_MARKERS.some(re => re.test(text));
}

/** Strip Unicode bidi control characters so numbers are visible */
function stripBidi(str) {
  return str.replace(/[\u200e\u200f\u202a\u202b\u202c\u202d\u202e]/g, '');
}

/**
 * Find the LARGEST number on a line matching the given keyword.
 * Returns null if no matching line found.
 */
function findOnLine(lines, keyword, minValue = 0) {
  const re = typeof keyword === 'string' ? new RegExp(keyword, 'i') : keyword;
  for (const line of lines) {
    if (!re.test(line)) continue;
    const matches = [...line.matchAll(/\b(\d{1,3}(?:,\d{3})+|\d{4,})\b/g)];
    if (matches.length === 0) continue;
    const amounts = matches
      .map(m => parseFloat(m[1].replace(/,/g, '')))
      .filter(n => n > minValue);
    if (amounts.length === 0) continue;
    return Math.max(...amounts);
  }
  return null;
}

/**
 * Like findOnLine but returns the SMALLEST number on the line (for month counts etc.)
 */
function findSmallOnLine(lines, keyword, minValue = 0) {
  const re = typeof keyword === 'string' ? new RegExp(keyword, 'i') : keyword;
  for (const line of lines) {
    if (!re.test(line)) continue;
    const matches = [...line.matchAll(/\b(\d{1,3}(?:,\d{3})+|\d{1,})\b/g)];
    if (matches.length === 0) continue;
    const amounts = matches
      .map(m => parseFloat(m[1].replace(/,/g, '')))
      .filter(n => n > minValue);
    if (amounts.length === 0) continue;
    return Math.min(...amounts);
  }
  return null;
}

/**
 * Parse Form 106 text into structured analysisData.
 */
function parseForm106Text(text) {
  const clean = stripBidi(text);
  const lines = clean.split(/\n/);

  // ── Tax year ────────────────────────────────────────────────────────────────
  const yearMatch = /(?:לשנת|שנת\s+המס)\s+(\d{4})/i.exec(clean);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  // ── Employee ─────────────────────────────────────────────────────────────────
  // Line format: "בלנקי אמילי ת.ז 314741877"
  const employeeIdMatch = /ת[.']\s*ז\s+(\d{7,9})/i.exec(clean);
  const employeeId = employeeIdMatch?.[1] ?? null;
  const employeeLine = lines.find(l => /ת[.']\s*ז/.test(l) && /\d{7,9}/.test(l));
  let employeeName = null;
  if (employeeLine) {
    const nm = /([\u05D0-\u05EA]+\s+[\u05D0-\u05EA]+)\s+ת[.']\s*ז/.exec(employeeLine);
    employeeName = nm?.[1]?.trim() ?? null;
  }

  // ── Employer name ─────────────────────────────────────────────────────────────
  // Look for a line with Hebrew company name + בע"מ
  const employerLine = lines.find(l => /בע"מ|בעמ/.test(l) && /[\u05D0-\u05EA]{3}/.test(l));
  let employerName = null;
  if (employerLine) {
    // The layout has 3+ spaces separating the left column (section title) from right column (company)
    // Split by large whitespace and take the segment containing בע"מ
    const segments = employerLine.split(/\s{3,}/);
    const seg = segments.find(s => /בע"מ|בעמ/.test(s));
    if (seg) {
      // Strip trailing address (starts with comma or digits)
      employerName = seg.replace(/\s*,.*$/, '').trim();
    }
  }

  // ── Work months ──────────────────────────────────────────────────────────────
  const workMonthsRaw = findSmallOnLine(lines, /סה"כ\s+חודשי\s+עבודה/, 0);
  const workMonths = workMonthsRaw && workMonthsRaw <= 12 ? workMonthsRaw : null;

  // ── Income (תשלומים) ─────────────────────────────────────────────────────────
  // Field 172/158: משכורת
  const annualGross =
    findOnLine(lines, /172[\/\\]158|^[\s\d,]+\s+משכורת(?!\s+ל)/m) ??
    findOnLine(lines, /משכורת(?!\s+ל)/) ??
    findOnLine(lines, /שכר\s+חייב\s+בדמי\s+ביטוח\s+לאומי/);

  // Field 219/218: השכר לקרן השתלמות
  const studyFundBase = findOnLine(lines, /219[\/\\]218|השכר\s+לקרן\s+השתלמות/);

  // Field 249/248: הפרשות לקופ"ג
  const pensionEmployer = findOnLine(lines, /249[\/\\]248|הפרשות\s+לקופ/);

  // Field 245/244: השכר המבוטח
  const pensionBase = findOnLine(lines, /245[\/\\]244|השכר\s+המבוטח/);

  // ── Deductions (ניכויים) ──────────────────────────────────────────────────────
  // Field 042: מס הכנסה
  const annualTax = findOnLine(lines, /\b042\b/) ??
    findOnLine(
      lines.filter(l => !/לשנת/.test(l)),
      /^[\s\d,]+\s+מס\s+הכנסה/m
    );

  // Field 086/045: ניכוי לקופות גמל
  const pensionEmployeeDeduction = findOnLine(lines, /086[\/\\]045|ניכוי\s+לקופות\s+גמל/);

  // דמי ביטוח לאומי (skip "שכר חייב" line)
  const annualNI = findOnLine(
    lines.filter(l => !/שכר\s+חייב/i.test(l)),
    /דמי\s+ביטוח\s+לאומי/
  );

  // דמי ביטוח בריאות
  const annualHealth = findOnLine(lines, /דמי\s+ביטוח\s+בריאות/);

  // ── Credits (זיכויים) ─────────────────────────────────────────────────────────
  const creditLine = lines.find(l => /ערך\s+נקודות\s+זיכוי/i.test(l));
  const taxCreditPoints = creditLine ? (() => {
    const frac = /(\d+\.\d+)/.exec(creditLine);
    return frac ? parseFloat(frac[1]) : null;
  })() : null;
  const taxCreditValue = creditLine ? (() => {
    const nums = [...creditLine.matchAll(/\b(\d{1,3}(?:,\d{3})+|\d{4,})\b/g)];
    const amounts = nums.map(m => parseFloat(m[1].replace(/,/g, ''))).filter(n => n >= 1000);
    return amounts.length ? Math.max(...amounts) : null;
  })() : null;

  return {
    source: 'form_106',
    schema_version: '1.0',
    period: {
      year,
      month: year ? `${year}-12` : null,
    },
    parties: {
      employee_name: employeeName,
      employee_id: employeeId,
      employer_name: employerName,
    },
    annual: {
      gross: annualGross,
      income_tax: annualTax,
      national_insurance: annualNI,
      health_insurance: annualHealth,
      pension_employer: pensionEmployer,
      pension_base: pensionBase,
      study_fund_base: studyFundBase,
      pension_employee_deduction: pensionEmployeeDeduction,
      work_months: workMonths,
      tax_credit_points: taxCreditPoints,
      tax_credit_value: taxCreditValue,
    },
    quality: {
      confidence: annualGross && annualTax ? 0.92 : 0.6,
      source: 'pdf_text',
    },
  };
}

module.exports = { isForm106, parseForm106Text };

