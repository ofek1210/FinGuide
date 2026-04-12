/* eslint-disable camelcase, no-restricted-syntax, no-continue, no-await-in-loop */
const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const sharp = require('sharp');
const crypto = require('crypto');

const { extractFromLinesByLabelMap } = require('./payslipOcrLabelMap');

const execFileAsync = promisify(execFile);
let pdfParse;

const OCR_PDF_PAGES_MODE = (process.env.OCR_PDF_PAGES_MODE || 'all').toLowerCase(); // 'all' | 'first'
const MIN_PDF_TEXT_LENGTH =
  Number(process.env.OCR_PDF_MIN_TEXT_LENGTH) && Number(process.env.OCR_PDF_MIN_TEXT_LENGTH) > 0
    ? Number(process.env.OCR_PDF_MIN_TEXT_LENGTH)
    : 200;

// -------------------- helpers --------------------
function sha256(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function cleanNum(s) {
  if (!s) return '';
  return String(s).replace(/[₪]/g, '').replace(/,/g, '').trim();
}

function parseMoney(s) {
  const c = cleanNum(s);
  if (!c) return undefined;
  const n = Number(c);
  return Number.isFinite(n) ? n : undefined;
}

function parsePercent(s) {
  if (!s) return undefined;
  const c = String(s).replace('%', '').trim();
  const n = Number(c);
  return Number.isFinite(n) ? n : undefined;
}

function parseNumber(s) {
  const c = cleanNum(s);
  if (!c) return undefined;
  const n = Number(c);
  return Number.isFinite(n) ? n : undefined;
}

function linesOf(text) {
  return String(text)
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
}

function match1(text, regex) {
  const m = String(text).match(regex);
  return m?.[1]?.trim();
}

function matchAmountFlexible(text, regex) {
  const s = match1(text, regex);
  return parseMoney(s);
}

function extractMonthFromFilename(filePath) {
  // PaySlip2024-02.pdf OR 2024-02 anywhere in filename
  const base = path.basename(filePath);
  const m = base.match(/(20\d{2})[-_.](\d{2})/);
  if (!m) return undefined;
  return `${m[1]}-${m[2]}`;
}

const HEBREW_MONTHS = {
  ינואר: '01', פברואר: '02', מרץ: '03', מרס: '03', אפריל: '04', מאי: '05', יוני: '06',
  יולי: '07', אוגוסט: '08', ספטמבר: '09', אוקטובר: '10', נובמבר: '11', דצמבר: '12',
};

function extractMonthYYYYMM(text) {
  const t = String(text);

  const hebrewMonth = t.match(/(ינואר|פברואר|מרץ|מרס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s*(20\d{2})/);
  if (hebrewMonth) {
    const mm = HEBREW_MONTHS[hebrewMonth[1]];
    if (mm) return `${hebrewMonth[2]}-${mm}`;
  }

  const m1 = t.match(/(\d{2})\/(20\d{2})/);
  if (m1) return `${m1[2]}-${m1[1]}`;

  const m2 = t.match(/מ-\d{2}\/(\d{2})\/(\d{2})\s+עד\s+\d{2}\/\1\/\2/);
  if (m2) return `20${m2[2]}-${m2[1]}`;

  return undefined;
}

function parseDateDDMMYYYYorYY(s) {
  if (!s) return undefined;
  const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{2}|\d{4})/);
  if (!m) return undefined;
  const dd = m[1];
  const mm = m[2];
  let yy = m[3];
  if (yy.length === 2) yy = `20${yy}`;
  return `${yy}-${mm}-${dd}`;
}

// -------------------- HMO translate --------------------
function extractHMO(text) {
  const m = String(text).match(/קופת[-\s]?חולים\s+([^\s]+)/i);
  return m?.[1];
}
function translateHMO(hmo) {
  if (!hmo) return undefined;
  const map = { מכבי: 'Maccabi', כללית: 'Clalit', מאוחדת: 'Meuhedet', לאומית: 'Leumit' };
  return map[hmo] || hmo;
}

// -------------------- OCR pipeline --------------------
async function preprocessImage(inPath) {
  const ext = path.extname(inPath).toLowerCase();

  // אם הקובץ הוא PPM (ברירת המחדל של pdftoppm ללא -png), תן אותו כמו שהוא ל-tesseract
  if (ext === '.ppm' || ext === '.pbm' || ext === '.pgm') {
    return inPath;
  }

  const outPath = `${inPath}.prep.png`;
  await sharp(inPath).rotate().grayscale().normalize().threshold(170).png().toFile(outPath);
  return outPath;
}

async function ocrWithTesseract(imagePath, { psm = '6' } = {}) {
  const args = [
    imagePath,
    'stdout',
    '-l',
    'heb+eng',
    '--oem',
    '1',
    '--psm',
    String(psm),
    '-c',
    'preserve_interword_spaces=1',
  ];

  try {
    const { stdout } = await execFileAsync('tesseract', args);
    return stdout || '';
  } catch (err) {
    const message =
      err.code === 'ENOENT'
        ? 'tesseract binary not found. Run the backend via Docker or install Tesseract on this machine.'
        : 'tesseract OCR command failed. Check that Tesseract is installed and supports the requested options.';

    const wrapped = new Error(message);
    wrapped.cause = err;
    throw wrapped;
  }
}

// -------------------- embedded PDF text --------------------
async function extractPdfEmbeddedText(pdfPath) {
  try {
    if (!pdfParse) {
      // eslint-disable-next-line global-require
      pdfParse = require('pdf-parse');
    }
    const buffer = await fs.readFile(pdfPath);
    const result = await pdfParse(buffer);
    const text = (result.text || '').trim();
    return text;
  } catch (err) {
    const wrapped = new Error('Failed to extract embedded text from PDF via pdf-parse.');
    wrapped.cause = err;
    throw wrapped;
  }
}

function isLikelyBrokenHebrew(text) {
  if (!text) return false;
  const t = String(text);
  const hebrewMatches = t.match(/[\u0590-\u05FF]/g) || [];
  const hebrewCount = hebrewMatches.length;

  // אופייני ל-mojibake של עברית: הרבה תווים בטווח 0xE0-0xFF (ã å î ò וכו')
  const weirdLatinMatches = t.match(/[À-ÿ]/g) || [];
  const weirdLatinCount = weirdLatinMatches.length;

  // אם כמעט ואין עברית, אבל יש הרבה "לטינית מוזרה", סביר שזה קידוד עברית שבור
  if (hebrewCount < 5 && weirdLatinCount > 20) {
    return true;
  }

  return false;
}

async function pdfToPngs(pdfPath, outDir) {
  const prefix = path.join(outDir, 'page');

  // Prefer PNG – supported by Poppler's pdftoppm (used in Docker image).
  // On systems where pdftoppm doesn't support -png, this will fail fast with
  // a clear error message so developers know to use Docker or install Poppler.
  const pngArgs = ['-png', '-r', '300', pdfPath, prefix];

  let pngSupported = true;

  try {
    await execFileAsync('pdftoppm', pngArgs);
  } catch (err) {
    const stderr = err.stderr ? String(err.stderr) : '';
    const looksLikeUsageError = /Usage: pdftoppm/i.test(stderr);

    if (err.code === 'ENOENT') {
      const wrapped = new Error(
        'pdftoppm binary not found. Run the backend via Docker or install Poppler (pdftoppm) on this machine.',
      );
      wrapped.cause = err;
      throw wrapped;
    }

    if (looksLikeUsageError) {
      // eslint-disable-next-line no-console
      console.warn(
        'pdftoppm does not support -png flag in this environment, retrying without -png and returning PPM files.',
      );
      pngSupported = false;
      const ppmArgs = ['-r', '300', pdfPath, prefix];
      try {
        await execFileAsync('pdftoppm', ppmArgs);
      } catch (err2) {
        const wrapped = new Error(
          'pdftoppm command failed while converting PDF to images (both with and without -png).',
        );
        wrapped.cause = err2;
        throw wrapped;
      }
    } else {
      const wrapped = new Error('pdftoppm command failed while converting PDF to images.');
      wrapped.cause = err;
      throw wrapped;
    }
  }

  const files = await fs.readdir(outDir);

  if (pngSupported) {
    return files
      .filter(f => f.startsWith('page-') && f.endsWith('.png'))
      .map(f => path.join(outDir, f))
      .sort((a, b) => a.localeCompare(b));
  }

  // Fallback: return PPM files when -png is not supported.
  return files
    .filter(f => f.startsWith('page-') && f.endsWith('.ppm'))
    .map(f => path.join(outDir, f))
    .sort((a, b) => a.localeCompare(b));
}

// -------------------- number extraction --------------------
function extractAllNumericTokens(line) {
  // ints or decimals. Used as "raw candidates" (includes rates like 7.50)
  const ms = String(line).match(/\d[\d,]*(?:\.\d{1,2})?/g) || [];
  return ms.map(parseMoney).filter(x => x !== undefined);
}

function extractPercentTokens(line) {
  // percent tokens that appear without % in OCR tables are hard; we treat "small decimals < 30" as rates candidates
  const nums = extractAllNumericTokens(line);
  return nums.filter(n => n > 0 && n < 30);
}

function isLikelyTaxBaseNoiseLine(line) {
  return /(שכר\s*חייב|הכנסה\s*חייבת|ברוטו\s*למס|לב\.?\s*לאומי|ב\.?\s*ל\.?|מס\s*מצטבר)/i.test(line);
}

function pickReasonableAmount(nums, { min = 50, max = 50000 } = {}) {
  // pick the first "real money" candidate by preference:
  // biggest in range (avoids picking tiny 4/6/14)
  const filtered = nums.filter(n => n >= min && n <= max);
  if (!filtered.length) return undefined;
  return filtered.sort((a, b) => b - a)[0];
}

function bestAmountByExpected(amounts, expected, tolerance = 15) {
  let best;
  let bestDiff = Infinity;
  for (const a of amounts) {
    const d = Math.abs(a - expected);
    if (d < bestDiff) {
      bestDiff = d;
      best = a;
    }
  }
  if (best === undefined) return undefined;
  return bestDiff <= tolerance ? best : undefined;
}

// -------------------- Mandatory deductions --------------------
function extractMandatoryDeductions(lines, warnings) {
  const joined = lines.join('\n');

  // total can be integer or decimals
  const total =
    matchAmountFlexible(joined, /כל\s*הניכו\w*\s*[: ]\s*(\d[\d,]*(?:\.\d{1,2})?)/i) ??
    matchAmountFlexible(joined, /סה["״]כ\s*ניכו\w*\s*[: ]\s*(\d[\d,]*(?:\.\d{1,2})?)/i);

  const findAmountOnLabelLine = labelRx => {
    const line = lines.find(l => labelRx.test(l));
    if (!line) return undefined;
    const nums = extractAllNumericTokens(line);
    // Avoid tiny tokens: pick something >= 50
    return pickReasonableAmount(nums, { min: 50, max: 60000 });
  };

  const income_tax = findAmountOnLabelLine(/(?:מס\s*הכנסה|income\s+tax)/i);
  const national_insurance = findAmountOnLabelLine(/(?:ביטוח\s*לאומי|national\s+insurance)/i);
  const health_insurance = findAmountOnLabelLine(/(?:ביטוח\s*בריאות|health\s+insurance)/i);

  // derived total (only if looks real)
  let derived_total;
  if ([income_tax, national_insurance, health_insurance].every(x => x !== undefined)) {
    const sum = +(income_tax + national_insurance + health_insurance).toFixed(2);
    if (sum >= 200) derived_total = sum; // prevent "14"
  }

  if (!lines.some(l => /מס\s*הכנסה/i.test(l))) warnings.push('Income tax line not found (מס הכנסה).');

  return {
    total: total ?? derived_total,
    total_is_derived: total === undefined && derived_total !== undefined,
    income_tax,
    national_insurance,
    health_insurance,
  };
}

// -------------------- Study fund extraction --------------------
function extractStudyFund(lines, warnings) {
  // base: "שכר לקרן השתלמות 20,800"
  const baseLine = lines.find(l => /שכר\s*לקרן\s*השתלמות/i.test(l));
  const baseFromBaseLine = baseLine
    ? pickReasonableAmount(extractAllNumericTokens(baseLine), { min: 5000, max: 200000 })
    : undefined;

  // contribution line with rates & amounts:
  const line = lines.find(
    l =>
      /קרן\s*השתלמות/i.test(l) &&
      !/נתוניס\s*מצטברים|מצטבר/i.test(l),
  );

  if (!line) {
    warnings.push('Study fund line not found (קרן השתלמות).');
    return { base: baseFromBaseLine };
  }

  const nums = extractAllNumericTokens(line);

  // base candidate should be large (like 20800)
  const baseCandidate = pickReasonableAmount(nums, { min: 5000, max: 200000 });
  const base = baseFromBaseLine ?? baseCandidate;

  // rates candidates (7.5, 2.5) from small decimals
  const rates = extractPercentTokens(line).slice(0, 4);

  // money amounts should be >= 50 (avoid grabbing 2.5)
  const moneyAmounts = nums.filter(n => n >= 50 && n <= 30000);

  let employeeRate;
  let employerRate;
  let employee;
  let employer;

  if (base !== undefined && rates.length >= 2) {
    // In many slips: employee rate is the higher one (7.5) and employer lower (2.5) OR vice versa,
    // We'll compute both and match to amounts.
    const rA = rates[0];
    const rB = rates[1];

    const expA = +(base * (rA / 100)).toFixed(2);
    const expB = +(base * (rB / 100)).toFixed(2);

    const aAmt = bestAmountByExpected(moneyAmounts, expA, 20);
    const bAmt = bestAmountByExpected(moneyAmounts, expB, 20);

    if (aAmt !== undefined && bAmt !== undefined) {
      employeeRate = rA;
      employee = aAmt;
      employerRate = rB;
      employer = bAmt;
    }
  }

  // fallback: take last two money amounts (often 1560 and 520)
  if ((employee === undefined || employer === undefined) && moneyAmounts.length >= 2) {
    const lastTwo = moneyAmounts.slice(-2);
    employee = employee ?? lastTwo[0];
    employer = employer ?? lastTwo[1];
  }

  return { base, employee, employer, employeeRate, employerRate, debug_line: line };
}

// -------------------- Pension extraction --------------------
function extractPension(lines, warnings) {
  // base: "שכר לקצבה 26,000"
  const baseLine = lines.find(l => /שכר\s*לקצבה/i.test(l));
  const base = baseLine
    ? pickReasonableAmount(extractAllNumericTokens(baseLine), { min: 5000, max: 200000 })
    : undefined;

  // We parse lines that mention תגמולים/פיצויים/פנסיה/ניכוי עובד/הפרשת מעסיק etc
  const pensionLines = lines.filter(
    l =>
      (
        /(תגמול|תגמולים|פיצוי|פיצויים|פנסי|ביטוח\s*מנהלים|קופ["״]?ג|גמל)/i.test(l) ||
        /(ניכוי\s*עובד|הפרשת\s*מעסיק)/i.test(l)
      ) &&
      !/נתוניס\s*מצטברים|מצטבר/i.test(l) &&
      !isLikelyTaxBaseNoiseLine(l),
  );

  let employee;
  let employer;
  let severance;
  let base_for_severance;

  for (const l of pensionLines) {
    const nums = extractAllNumericTokens(l);
    if (!nums.length) continue;

    const localBase = pickReasonableAmount(nums, { min: 5000, max: 200000 });
    const rates = extractPercentTokens(l);
    const amounts = nums.filter(n => n >= 50 && n <= 60000);

    if (localBase !== undefined && rates.length) {
      // try each rate to match some amount
      for (const r of rates) {
        const expected = +(localBase * (r / 100)).toFixed(2);
        const amt = bestAmountByExpected(amounts, expected, 25);
        if (amt === undefined) continue;

        if (/פיצוי|פיצויים/i.test(l)) {
          severance = severance ?? amt;
          base_for_severance = base_for_severance ?? localBase;
        } else if (/(עובד|תגמולי\s*עובד|ניכוי\s*עובד)/i.test(l)) {
          employee = employee ?? amt;
        } else if (/(מעביד|מעסיק|תגמולי\s*מעביד|הפרשת\s*מעסיק)/i.test(l)) {
          employer = employer ?? amt;
        } else {
          employee = employee ?? amt;
        }
      }
    }
  }

  if ((employee === undefined || employer === undefined) && pensionLines.length) {
    const allAmounts = pensionLines
      .flatMap(extractAllNumericTokens)
      .filter(n => n >= 50 && n <= 60000);

    const filtered = allAmounts.filter(n => !(base && Math.abs(n - base) < 5));
    filtered.sort((a, b) => b - a);

    if (filtered.length >= 2) {
      employer = employer ?? filtered[0];
      employee = employee ?? filtered[1];
    }
  }

  if (!pensionLines.length) warnings.push('Pension lines not found (פנסיה/תגמולים/פיצויים).');

  return {
    base,
    employee,
    employer,
    severance,
    base_for_severance,
    debug_lines: pensionLines.slice(0, 8),
  };
}

// -------------------- main extraction --------------------
function extractPayslipFinancialEN(ocrText, { sourcePath } = {}) {
  const warnings = [];
  let confidence = 1.0;

  const textHash = sha256(ocrText);
  const lines = linesOf(ocrText);
  const full = lines.join('\n');

  const labelMap = extractFromLinesByLabelMap(lines);

  const month = extractMonthYYYYMM(full) ?? (sourcePath ? extractMonthFromFilename(sourcePath) : undefined);

  let gross_total =
    matchAmountFlexible(full, /סך[-\s]?כל\s*התשלומים\s+(\d[\d,]*(?:\.\d{1,2})?)/i) ??
    matchAmountFlexible(full, /סה''כ\s*תשלומים\s+(\d[\d,]*(?:\.\d{1,2})?)/i) ??
    matchAmountFlexible(full, /שכר\s*ברוטו\s+(\d[\d,]*(?:\.\d{1,2})?)/i) ??
    parseMoney(match1(full, /שכר\s*לקצבה\s+(\d[\d,]*)/i)) ??
    labelMap.gross_total;

  let net_payable =
    matchAmountFlexible(full, /(?:נטו\s*לתשלום|שכר\s*נטו|שכר\s*נטו\s*לתשלום)\s+(\d[\d,]*(?:\.\d{1,2})?)/i) ??
    matchAmountFlexible(full, /\)\s*\d+\s*לתשלום\s+(\d[\d,]*(?:\.\d{1,2})?)/i) ??
    matchAmountFlexible(full, /לתשלום\s+(\d[\d,]*(?:\.\d{1,2})?)\s*$/im) ??
    labelMap.net_payable;
  if (net_payable === undefined && /סכום\s*בבנק/i.test(full)) {
    const idx = full.search(/סכום\s*בבנק/i);
    const start = Math.max(0, idx - 350);
    const beforeLabel = idx > 0 ? full.slice(start, idx) : '';
    const ms = beforeLabel.match(/\d[\d,]*(?:\.\d{1,2})?/g) || [];
    const candidates = ms.map(parseMoney).filter(n => n != null && n >= 1000 && n <= 100000);
    const [firstCandidate] = candidates;
    if (firstCandidate !== undefined) net_payable = firstCandidate;
  }

  if (gross_total !== undefined && net_payable !== undefined && net_payable > gross_total) {
    [gross_total, net_payable] = [net_payable, gross_total];
  }

  const base_salary =
    matchAmountFlexible(full, /שכר\s*בסיס\s+(\d[\d,]*(?:\.\d{1,2})?)/i) ?? labelMap.base_salary;

  const global_overtime =
    matchAmountFlexible(
      full,
      /ש\.?\s*נוס\.?\s*גלובל(?:י(?:ו(?:ת)?)?)?\s+(\d[\d,]*(?:\.\d{1,2})?)/i,
    ) ?? labelMap.global_overtime;

  const travel_expenses =
    matchAmountFlexible(full, /נסיעות[^\d]*?(\d[\d,]*(?:\.\d{1,2})?)/i) ?? labelMap.travel_expenses;

  const components = [];
  if (base_salary !== undefined) components.push({ type: 'base_salary', amount: base_salary });
  if (global_overtime !== undefined) components.push({ type: 'global_overtime', amount: global_overtime });
  if (travel_expenses !== undefined) components.push({ type: 'travel_expenses', amount: travel_expenses });

  const mandatory = extractMandatoryDeductions(lines, warnings);
  mandatory.income_tax = mandatory.income_tax ?? labelMap.income_tax;
  mandatory.national_insurance = mandatory.national_insurance ?? labelMap.national_insurance;
  mandatory.health_insurance = mandatory.health_insurance ?? labelMap.health_insurance;
  mandatory.total = mandatory.total ?? labelMap.mandatory_total;

  let gross_minus_mandatory_deductions;
  if (gross_total !== undefined && mandatory.total !== undefined) {
    gross_minus_mandatory_deductions = +(gross_total - mandatory.total).toFixed(2);
  }

  const gross_for_income_tax = matchAmountFlexible(full, /ברוטו\s*למס\s*הכנסה\s+(\d[\d,]*(?:\.\d{1,2})?)/i);
  const taxable_income = matchAmountFlexible(full, /הכנסה\s*חייבת\s*במס\s+(\d[\d,]*(?:\.\d{1,2})?)/i);

  const marginal_tax_rate = parsePercent(match1(full, /אחוז\s*מס\s*שולי\s+(\d+(?:\.\d+)?)%/i));
  const tax_credit_points = parseNumber(match1(full, /נקודות\s*זיכוי\s+(\d+(?:\.\d+)?)/i));

  const credit_resident = parseNumber(match1(full, /תושב\s*ישראל\s+(\d+(?:\.\d+)?)/i));
  const credit_woman =
    parseNumber(match1(full, /(?:אישה|אשה)\s+(\d+(?:\.\d+)?)/i)) ??
    parseNumber(match1(full, /\bAWN\b\s+(\d+(?:\.\d+)?)/i));

  const gross_for_national_insurance = matchAmountFlexible(
    full,
    /(שכר\s*חייב\s*ב\.?\s*ל\.?|ברוטו\s*לב\.?\s*לאומי)\s*[:| ]\s*(\d[\d,]*(?:\.\d{1,2})?)/i,
  );

  const employment_start_raw = match1(full, /התחלת\s*עבודה\s+(\d{2}\/\d{2}\/\d{2,4})/i);
  const employment_start_date = parseDateDDMMYYYYorYY(employment_start_raw);

  const job_percent =
    parsePercent(match1(full, /חלקיות\s+(\d+(?:\.\d+)?)%/i)) ??
    parsePercent(match1(full, /אחוז\s*משרה[^\d]*(\d+(?:\.\d+)?)\s*%?/i));

  const hmo = translateHMO(extractHMO(full));

  // Parties (employer / employee)
  let employer_name;
  let employee_name;
  let employee_id;

  // Common Hebrew patterns
  employee_name =
    match1(full, /שם\s+עובד[:\s]+([^\n]+)/i) ??
    match1(full, /Employee\s+Name[:\s]+([^\n]+)/i) ??
    match1(full, /עובד[:\s]+([^\n]+)/i);

  employer_name =
    match1(full, /שם\s+מעסיק[:\s]+([^\n]+)/i) ??
    match1(full, /שם\s+מעביד[:\s]+([^\n]+)/i) ??
    match1(full, /Employer\s+Name[:\s]+([^\n]+)/i);

  // Same line: "דיל אופק322819145" (name immediately followed by 8–9 digits = Israeli ID)
  const nameIdSameLine = full.match(/([א-ת\s]{2,35})(\d{8,9})\b/);
  if (nameIdSameLine) {
    const namePart = nameIdSameLine[1].trim();
    const idPart = nameIdSameLine[2];
    const isHeader = /^(דצמבר|ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר)/.test(namePart);
    if (!/^\d+$/.test(namePart) && !isHeader && namePart.length >= 2) {
      if (!employee_name) employee_name = namePart;
      if (!employee_id) employee_id = idPart;
    }
  }

  if (!employee_name) {
    const nameBeforeId = full.match(/([א-ת\s]{2,35})\s*\n\s*(\d{7,9})\b/);
    if (nameBeforeId) {
      const [, namePart, idPart] = nameBeforeId;
      const candidate = namePart.trim();
      if (!/^\d+$/.test(candidate) && !/^(דצמבר|ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר)/.test(candidate)) {
        employee_name = candidate;
      }
      if (!employee_id) employee_id = idPart;
    }
  }

  if (!employer_name) {
    const withBam = full.match(/([^\n]*?[א-ת\s()\-]+בע["']?מ\s*)/);
    if (withBam) {
      employer_name = withBam[1].replace(/^\d+/, '').replace(/\s*בע["']?מ\s*$/, '').trim() || withBam[1].trim();
    }
  }

  // ID: ת.ז., ת. זהות:, מספר זהות, ID (same line or up to 40 chars / next line)
  if (!employee_id) {
    employee_id =
      match1(full, /(?:ת\.?\s*ז\.?|תעודת\s+זהות|מספר\s+זהות)[:\s-]*(\d{7,9})/i) ??
      match1(full, /ת\.\s*זהות\s*:?\s*(\d{7,9})/i) ??
      match1(full, /\bID[:\s-]*(\d{7,9})\b/i);
  }
  if (!employee_id) {
    const afterTeudat = full.match(/ת\.?\s*זהות\s*:?[\s\S]{0,40}?(\d{7,9})/i);
    if (afterTeudat) {
      const [, idFromTeudat] = afterTeudat;
      employee_id = idFromTeudat;
    }
  }

  const study = extractStudyFund(lines, warnings);
  const pension = extractPension(lines, warnings);

  if (!month) {
    warnings.push('Missing period.month (OCR+filename fallback failed)');
    confidence -= 0.15;
  }
  if (gross_total === undefined) {
    warnings.push('Missing salary.gross_total');
    confidence -= 0.25;
  }
  if (net_payable === undefined) {
    warnings.push('Missing salary.net_payable');
    confidence -= 0.2;
  }
  if (mandatory.total === undefined) {
    warnings.push('Missing deductions.mandatory.total');
    confidence -= 0.2;
  }

  const tooBig = v => v !== undefined && v > 100000;
  if (tooBig(pension.employee) || tooBig(pension.employer) || tooBig(study.employee) || tooBig(study.employer)) {
    warnings.push('Unrealistic contribution amount detected (possible OCR/table confusion).');
    confidence -= 0.25;
  }

  if (mandatory.total_is_derived && gross_total !== undefined && mandatory.total !== undefined) {
    if (mandatory.total < Math.max(200, gross_total * 0.01)) {
      warnings.push(`Derived mandatory.total looks too small (${mandatory.total}). Ignoring derived total.`);
      mandatory.total = undefined;
      mandatory.total_is_derived = false;
      confidence -= 0.15;
    }
  }

  confidence = Math.max(0, Math.min(1, confidence));

  return {
    schema_version: '1.5',
    period: month ? { month } : {},

    salary: {
      gross_total,
      net_payable,
      gross_minus_mandatory_deductions,
      components,
    },

    deductions: {
      mandatory: {
        total: mandatory.total,
        total_is_derived: mandatory.total_is_derived,
        income_tax: mandatory.income_tax,
        national_insurance: mandatory.national_insurance,
        health_insurance: mandatory.health_insurance,
      },
      voluntary: {},
    },

    contributions: {
      pension: {
        base_salary_for_pension: pension.base,
        employee: pension.employee,
        employer: pension.employer,
        severance: pension.severance,
        base_for_severance: pension.base_for_severance,
      },
      study_fund: {
        base_salary_for_study_fund: study.base,
        employee: study.employee,
        employer: study.employer,
        employee_rate_percent: study.employeeRate,
        employer_rate_percent: study.employerRate,
      },
    },

    tax: {
      gross_for_income_tax,
      taxable_income,
      marginal_tax_rate_percent: marginal_tax_rate,
      tax_credit_points,
      tax_credit_points_breakdown: {
        resident: credit_resident,
        woman: credit_woman,
      },
    },

    national_insurance: {
      gross_for_national_insurance,
    },

    employment: {
      employment_start_date,
      job_percent,
    },

    parties: {
      employer_name,
      employee_name,
      employee_id,
    },

    insurances: {
      hmo,
    },

    quality: {
      confidence,
      warnings,
      debug: {
        study_line: study.debug_line,
        pension_lines_sample: pension.debug_lines,
      },
    },

    raw: {
      ocr_engine: 'tesseract-cli',
      ocr_lang: 'heb+eng',
      text_sha256: textHash,
      rawText: ocrText,
      ocr_text: ocrText,
    },
  };
}

// -------------------- lightweight summary for frontend --------------------
function extractNumberByRegexes(full, regexes, parser = parseNumber) {
  if (!full) return null;
  for (const rx of regexes) {
    const m = String(full).match(rx);
    if (m && m[1]) {
      const val = parser(m[1]);
      if (val !== undefined && val !== null) {
        return val;
      }
    }
  }
  return null;
}

function inferGrossAndNetFromNumbers(lines) {
  const histogram = new Map();

  lines.forEach((line, idx) => {
    const nums = extractAllNumericTokens(line);
    for (const n of nums) {
      if (!Number.isFinite(n)) continue;
      const key = n;
      const existing = histogram.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        histogram.set(key, { count: 1, firstLineIdx: idx });
      }
    }
  });

  const entries = Array.from(histogram.entries())
    .map(([amount, meta]) => ({ amount, count: meta.count, firstLineIdx: meta.firstLineIdx }))
    // סינון לרמות שכר סבירות
    .filter(e => e.amount >= 1000 && e.amount <= 200000);

  if (!entries.length) return {};

  // ברוטו – המספר הגבוה ביותר
  entries.sort((a, b) => b.amount - a.amount);
  const grossCandidate = entries[0]?.amount;

  // נטו – המספר הגבוה הבא שמופיע לפחות פעמיים, אם יש
  let netCandidateEntry = entries.find(e => e.count >= 2 && e.amount < grossCandidate);
  if (!netCandidateEntry && entries.length > 1) {
    const [, secondEntry] = entries;
    netCandidateEntry = secondEntry;
  }

  return {
    gross: grossCandidate,
    net: netCandidateEntry ? netCandidateEntry.amount : undefined,
  };
}

function buildPayslipSummary(data, rawText) {
  if (!data || typeof data !== 'object') return null;

  const textSource =
    rawText ||
    data.raw?.ocr_text ||
    data.raw?.rawText ||
    '';

  const lines = linesOf(textSource);
  const full = lines.join('\n');

  // --- employee name & date (string fields) ---
  const employeeNameFromText =
    data.parties?.employee_name ||
    match1(full, /שם\s+עובד[:\s]+([^\n]+)/i) ||
    match1(full, /\bשם[:\s]+([^\n]+)/i) ||
    (() => {
      const m = full.match(/([א-ת\s]{2,35})\s*\n\s*(\d{7,9})\b/);
      if (m) {
        const c = m[1].trim();
        if (!/^\d+$/.test(c) && !/^(דצמבר|ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר)/.test(c))
          return c;
      }
      return null;
    })();

  const dateFromText =
    // "לחודש 02/2024"
    match1(full, /לחודש\s+([0-9]{2}\/[0-9]{4})/i) ||
    // "תאריך: 01/02/2024"
    match1(full, /תאריך[:\s]+([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i) ||
    // generic fallback
    match1(full, /חודש[:\s]+([^\n]+)/i);

  const employeeName = employeeNameFromText || null;
  const date =
    data.period?.month ||
    dateFromText ||
    data.employment?.employment_start_date ||
    null;

  // --- numeric helpers (all normalized to JS numbers or null) ---
  let grossSalary =
    data.salary?.gross_total ??
    extractNumberByRegexes(full, [/שכר\s*ברוטו[^\d]*(\d[\d,.\s₪]+)/i], parseMoney) ??
    null;

  let netSalary =
    data.salary?.net_payable ??
    extractNumberByRegexes(
      full,
      [
        /שכר\s*נטו\s*לתשלום[^\d]*(\d[\d,.\s₪]+)/i,
        /שכר\s*נטו[^\d]*(\d[\d,.\s₪]+)/i,
        /נטו\s*לתשלום[^\d]*(\d[\d,.\s₪]+)/i,
      ],
      parseMoney,
    ) ??
    null;

  // Fallback: אם לא הצלחנו לזהות ברוטו/נטו לפי תוויות (בעיות קידוד OCR),
  // ננסה להסיק אותם מהמספרים הגדולים החוזרים בתלוש.
  if (grossSalary === null || netSalary === null) {
    const inferred = inferGrossAndNetFromNumbers(lines);
    if (grossSalary === null && inferred.gross !== undefined) {
      grossSalary = inferred.gross;
    }
    if (netSalary === null && inferred.net !== undefined) {
      netSalary = inferred.net;
    }
  }

  const vacationDays =
    extractNumberByRegexes(
      full,
      [
        /(?:ימי|יתרת)\s*חופשה[^\d]*(\d[\d,.\s]+)/i,
        /חופשה\s*צבורה[^\d]*(\d[\d,.\s]+)/i,
        /(?:ניצול\s*חופש|יתרת\s*פתיחה)[\s\S]{0,120}?(\d+(?:[.,]\d+)?)/i,
      ],
      parseNumber,
    ) ?? null;

  const sickDays =
    extractNumberByRegexes(
      full,
      [
        /(?:ימי|יתרת)\s*מחלה[^\d]*(\d[\d,.\s]+)/i,
        /מחלה\s*צבורה[^\d]*(\d[\d,.\s]+)/i,
        /(?:מחלת\s*עובד|יתרת\s*פתיחה)[\s\S]{0,120}?(\d+(?:[.,]\d+)?)/i,
      ],
      parseNumber,
    ) ?? null;

  const pensionEmployee =
    data.contributions?.pension?.employee ??
    extractNumberByRegexes(
      full,
      [
        /(?:פנסיה|ביטוח\s*מנהלים|תגמולים)[^\n]*?(?:עובד|ניכוי\s*עובד)[^\d]*(\d[\d,.\s₪]+)/i,
      ],
      parseMoney,
    ) ??
    null;

  const pensionEmployer =
    data.contributions?.pension?.employer ??
    extractNumberByRegexes(
      full,
      [
        /(?:פנסיה|ביטוח\s*מנהלים|תגמולים)[^\n]*?(?:מעסיק|מעביד)[^\d]*(\d[\d,.\s₪]+)/i,
      ],
      parseMoney,
    ) ??
    null;

  const trainingFundEmployee =
    data.contributions?.study_fund?.employee ??
    extractNumberByRegexes(
      full,
      [
        /(?:קרן\s*השתלמות|קופת\s*גמל)[^\n]*?(?:עובד|ניכוי\s*עובד)[^\d]*(\d[\d,.\s₪]+)/i,
      ],
      parseMoney,
    ) ??
    null;

  const trainingFundEmployer =
    data.contributions?.study_fund?.employer ??
    extractNumberByRegexes(
      full,
      [
        /(?:קרן\s*השתלמות|קופת\s*גמל)[^\n]*?(?:מעסיק|מעביד)[^\d]*(\d[\d,.\s₪]+)/i,
      ],
      parseMoney,
    ) ??
    null;

  const tax =
    data.deductions?.mandatory?.income_tax ??
    extractNumberByRegexes(
      full,
      [/מס\s*הכנסה[^\d]*(\d[\d,.\s₪]+)/i],
      parseMoney,
    ) ??
    null;

  const nationalInsurance =
    data.deductions?.mandatory?.national_insurance ??
    extractNumberByRegexes(
      full,
      [/ביטוח\s*לאומי[^\d]*(\d[\d,.\s₪]+)/i],
      parseMoney,
    ) ??
    null;

  const healthInsurance =
    data.deductions?.mandatory?.health_insurance ??
    extractNumberByRegexes(
      full,
      [
        /מס\s*בריאות[^\d]*(\d[\d,.\s₪]+)/i,
        /ביטוח\s*בריאות[^\d]*(\d[\d,.\s₪]+)/i,
      ],
      parseMoney,
    ) ??
    null;

  const jobPercentage =
    data.employment?.job_percent ??
    extractNumberByRegexes(
      full,
      [
        /אחוז\s*משרה[^\d]*(\d+(?:[.,]\d+)?)\s*%?/i,
        /אחוז\s*משרה[\s\S]{0,80}?(\d+(?:[.,]\d+)?)\s*%?/i,
        /חלקיות\s*משרה[^\d]*(\d+(?:[.,]\d+)?)\s*%/i,
        /חלקיות[^\d]*(\d+(?:[.,]\d+)?)\s*%/i,
        /(\d+(?:[.,]\d+)?)\s*%[\s\S]{0,40}?אחוז\s*משרה/i,
      ],
      s => parsePercent(String(s).includes('%') ? s : `${s}%`),
    ) ??
    null;

  let workingDays =
    extractNumberByRegexes(
      full,
      [
        /ימי\s*עבודה[^\d]*(\d[\d,.\s]+)/i,
        /ימי\s*עבודה[\s\S]{0,120}?(\d{1,2})\b/,
      ],
      parseNumber,
    ) ?? null;
  if (workingDays != null && (workingDays < 1 || workingDays > 31)) workingDays = null;

  const workingHours =
    extractNumberByRegexes(
      full,
      [/(?:שעות\s*עבודה|סה["״']?כ\s*שעות)[^\d]*(\d[\d,.\s]+)/i],
      parseNumber,
    ) ?? null;

  return {
    employeeName,
    date,
    grossSalary,
    netSalary,
    vacationDays,
    sickDays,
    pensionEmployee,
    pensionEmployer,
    trainingFundEmployee,
    trainingFundEmployer,
    tax,
    nationalInsurance,
    healthInsurance,
    jobPercentage,
    workingDays,
    workingHours,
  };
}

// -------------------- high-level API --------------------
async function extractPayslipFile(inputPath) {
  const abs = path.resolve(inputPath);
  const ext = path.extname(abs).toLowerCase();
  let extractionMethod = 'ocr';

  const workDir = path.join(process.cwd(), '.work');
  await fs.mkdir(workDir, { recursive: true });

  let imagePaths = [];
  if (ext === '.pdf') {
    // Stage A: try embedded text first
    try {
      const embeddedText = await extractPdfEmbeddedText(abs);
      const normalized = embeddedText.replace(/\s+/g, ' ').trim();
      const brokenHebrew = isLikelyBrokenHebrew(embeddedText);

      if (normalized.length >= MIN_PDF_TEXT_LENGTH && !brokenHebrew) {
        extractionMethod = 'pdf_text';
        const data = extractPayslipFinancialEN(embeddedText, { sourcePath: abs });
        const summary = buildPayslipSummary(data, embeddedText);
        if (summary) {
          data.summary = summary;
        }
        // eslint-disable-next-line no-console
        console.log('[payslipOcr] extractPayslipFile(pdf_text)', {
          sourcePath: abs,
          summary: data.summary,
          salary: data.salary,
          parties: data.parties,
          quality: data.quality,
          rawPreview: embeddedText.slice(0, 2000),
        });
        data.raw = {
          ...data.raw,
          rawText: embeddedText,
          extractionMethod,
        };
        return { data };
      }
    } catch (err) {
      // Log and fall back to OCR
      // eslint-disable-next-line no-console
      console.warn('PDF text extraction failed, falling back to OCR:', err.message);
    }

    // Stage B: fallback to OCR
    const pdfOut = path.join(workDir, `pdf_${Date.now()}`);
    await fs.mkdir(pdfOut, { recursive: true });
    imagePaths = await pdfToPngs(abs, pdfOut);
  } else {
    imagePaths = [abs];
  }

  const pagesToProcess =
    OCR_PDF_PAGES_MODE === 'first' && imagePaths.length > 0 ? [imagePaths[0]] : imagePaths;

  const candidates = [];
  extractionMethod = 'ocr';
  let lastOcrError;

  for (const psm of [6, 4, 3]) {
    let fullText = '';
    try {
      for (const img of pagesToProcess) {
        const prepped = await preprocessImage(img);
        try {
          const text = await ocrWithTesseract(prepped, { psm });
          fullText += `\n${text}`;
        } finally {
          // אם יצרנו קובץ ביניים (PNG), מחק אותו. אם זה קובץ המקור (PPM/PDF), אל תמחק.
          if (prepped !== img) {
            await fs.unlink(prepped).catch(() => {});
          }
        }
      }

      if (!fullText.trim()) {
        // אין טקסט מה‑OCR בפס זה – נמשיך לפס הבא
        // eslint-disable-next-line no-console
        console.warn('[payslipOcr] OCR produced empty text', { sourcePath: abs, psm });
        continue;
      }

      const data = extractPayslipFinancialEN(fullText, { sourcePath: abs });
      const summary = buildPayslipSummary(data, fullText);
      if (summary) {
        data.summary = summary;
      }
      // eslint-disable-next-line no-console
      console.log('[payslipOcr] extractPayslipFile(ocr candidate)', {
        sourcePath: abs,
        psm,
        summary: data.summary,
        salary: data.salary,
        parties: data.parties,
        quality: data.quality,
        rawPreview: fullText.slice(0, 2000),
      });
      data.raw = {
        ...data.raw,
        rawText: fullText,
        extractionMethod,
      };
      candidates.push({ psm, data });
    } catch (err) {
      lastOcrError = err;
      // eslint-disable-next-line no-console
      console.warn('[payslipOcr] OCR pass failed', {
        sourcePath: abs,
        psm,
        error: err.message,
      });
      // לא מפילים את כל התהליך – ננסה psm אחר או נחזור למועמד הקודם
    }
  }

  if (!candidates.length) {
    // כל נסיונות ה‑OCR נכשלו – אם יש שגיאה אחרונה, נזרוק אותה, אחרת נזרוק שגיאה כללית
    if (lastOcrError) {
      throw lastOcrError;
    }
    throw new Error('OCR failed: no text extracted from any pass.');
  }

  candidates.sort(
    (a, b) => (b.data.quality.confidence ?? 0) - (a.data.quality.confidence ?? 0),
  );
  return candidates[0];
}

module.exports = {
  extractPayslipFinancialEN,
  extractPayslipFile,
};
