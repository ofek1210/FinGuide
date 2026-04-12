/* eslint-disable camelcase, no-restricted-syntax, no-continue, no-await-in-loop */
const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const sharp = require('sharp');
const crypto = require('crypto');

const { extractFromLinesByLabelMap } = require('./payslipOcrLabelMap');
const { buildNormalizedOcrDocumentFromSource } = require('./payslipOcrContext');
const {
  buildQualityPayload,
  collectCoreFieldCandidates,
  collectPeriodMonthCandidates,
  collectSupplementalFieldCandidates,
  rankExtractionCandidates,
  resolveBestNumericCandidate,
  resolveGrossAndNetCandidates,
  resolveMandatoryTotalCandidate,
  sortCandidatesByScore,
} = require('./payslipOcrResolver');
const { collectPartyCandidates, resolvePartyCandidates } = require('./payslipOcrParties');
const {
  collectContributionCandidates,
  resolveContributionCandidates,
} = require('./payslipOcrContributions');
const { buildPayslipSummary } = require('./payslipOcrSummary');
const {
  extractHMO,
  extractMonthFromFilename,
  extractMonthYYYYMM,
  linesOf,
  match1,
  matchAmountFlexible,
  parseDateDDMMYYYYorYY,
  parseMoney,
  parseNumber,
  parsePercent,
  translateHMO,
} = require('./payslipOcrShared');

const execFileAsync = promisify(execFile);
let pdfParse;

const OCR_PDF_PAGES_MODE = (process.env.OCR_PDF_PAGES_MODE || 'all').toLowerCase();
const MIN_PDF_TEXT_LENGTH =
  Number(process.env.OCR_PDF_MIN_TEXT_LENGTH) && Number(process.env.OCR_PDF_MIN_TEXT_LENGTH) > 0
    ? Number(process.env.OCR_PDF_MIN_TEXT_LENGTH)
    : 200;

function sha256(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function toRawLines(text) {
  return linesOf(text);
}

// -------------------- OCR pipeline --------------------
async function preprocessImage(inPath) {
  const ext = path.extname(inPath).toLowerCase();

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
  } catch (error) {
    const message =
      error.code === 'ENOENT'
        ? 'tesseract binary not found. Run the backend via Docker or install Tesseract on this machine.'
        : 'tesseract OCR command failed. Check that Tesseract is installed and supports the requested options.';

    const wrapped = new Error(message);
    wrapped.cause = error;
    throw wrapped;
  }
}

async function extractPdfEmbeddedText(pdfPath) {
  try {
    if (!pdfParse) {
      // eslint-disable-next-line global-require
      pdfParse = require('pdf-parse');
    }
    const buffer = await fs.readFile(pdfPath);
    const result = await pdfParse(buffer);
    return (result.text || '').trim();
  } catch (error) {
    const wrapped = new Error('Failed to extract embedded text from PDF via pdf-parse.');
    wrapped.cause = error;
    throw wrapped;
  }
}

function isLikelyBrokenHebrew(text) {
  if (!text) return false;
  const value = String(text);
  const hebrewCount = (value.match(/[\u0590-\u05FF]/g) || []).length;
  const weirdLatinCount = (value.match(/[À-ÿ]/g) || []).length;
  return hebrewCount < 5 && weirdLatinCount > 20;
}

async function pdfToPngs(pdfPath, outDir) {
  const prefix = path.join(outDir, 'page');
  const pngArgs = ['-png', '-r', '300', pdfPath, prefix];
  let pngSupported = true;

  try {
    await execFileAsync('pdftoppm', pngArgs);
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr) : '';
    const looksLikeUsageError = /Usage: pdftoppm/i.test(stderr);

    if (error.code === 'ENOENT') {
      const wrapped = new Error(
        'pdftoppm binary not found. Run the backend via Docker or install Poppler (pdftoppm) on this machine.',
      );
      wrapped.cause = error;
      throw wrapped;
    }

    if (looksLikeUsageError) {
      // eslint-disable-next-line no-console
      console.warn(
        'pdftoppm does not support -png flag in this environment, retrying without -png and returning PPM files.',
      );
      pngSupported = false;
      try {
        await execFileAsync('pdftoppm', ['-r', '300', pdfPath, prefix]);
      } catch (fallbackError) {
        const wrapped = new Error(
          'pdftoppm command failed while converting PDF to images (both with and without -png).',
        );
        wrapped.cause = fallbackError;
        throw wrapped;
      }
    } else {
      const wrapped = new Error('pdftoppm command failed while converting PDF to images.');
      wrapped.cause = error;
      throw wrapped;
    }
  }

  const files = await fs.readdir(outDir);
  const extension = pngSupported ? '.png' : '.ppm';

  return files
    .filter(file => file.startsWith('page-') && file.endsWith(extension))
    .map(file => path.join(outDir, file))
    .sort((a, b) => a.localeCompare(b));
}

function logExtractionResult({ sourcePath, extractionMethod, psm, data }) {
  // eslint-disable-next-line no-console
  console.log('[payslipOcr] extraction completed', {
    sourcePath: path.basename(sourcePath),
    extractionMethod,
    ...(psm ? { psm } : {}),
    schema_version: data.schema_version,
    confidence: data.quality?.confidence,
    resolution_score: data.quality?.resolution_score,
    warning_count: data.quality?.warnings?.length ?? 0,
  });
}

function extractPayslipFinancialEN(ocrInput, { sourcePath, ocrJson } = {}) {
  const warnings = [];
  const sourcePayload =
    typeof ocrInput === 'string'
      ? (ocrJson ? { text: ocrInput, ocrJson } : ocrInput)
      : ocrInput;
  const normalizedDoc = buildNormalizedOcrDocumentFromSource(sourcePayload);
  const fullTextSource = normalizedDoc.fullText;
  const textHash = sha256(fullTextSource);
  const lines = normalizedDoc.lines.map(line => line.raw);
  const full = normalizedDoc.fullText;
  const labelMap = extractFromLinesByLabelMap(lines);

  const monthCandidate = sortCandidatesByScore(
    collectPeriodMonthCandidates(normalizedDoc, { sourcePath }),
  )[0];
  const month = monthCandidate?.value;

  const coreFieldCandidates = collectCoreFieldCandidates(normalizedDoc);
  const supplementalFieldCandidates = collectSupplementalFieldCandidates(normalizedDoc, labelMap);

  const resolvedIncomeTax = resolveBestNumericCandidate('income_tax', coreFieldCandidates.income_tax);
  const resolvedNationalInsurance = resolveBestNumericCandidate(
    'national_insurance',
    coreFieldCandidates.national_insurance,
  );
  const resolvedHealthInsurance = resolveBestNumericCandidate(
    'health_insurance',
    coreFieldCandidates.health_insurance,
  );
  const { grossCandidate, netCandidate } = resolveGrossAndNetCandidates(
    coreFieldCandidates.gross_total,
    coreFieldCandidates.net_payable,
    warnings,
  );

  const gross_total = grossCandidate?.value;
  const net_payable = netCandidate?.value;

  const mandatoryResolution = resolveMandatoryTotalCandidate(
    coreFieldCandidates.mandatory_total || [],
    {
      income_tax: resolvedIncomeTax,
      national_insurance: resolvedNationalInsurance,
      health_insurance: resolvedHealthInsurance,
    },
    gross_total,
    warnings,
  );
  const mandatory_total = mandatoryResolution.candidate?.value;

  const base_salary = resolveBestNumericCandidate(
    'base_salary',
    supplementalFieldCandidates.base_salary,
    { minScore: 0.35 },
  )?.value;
  const global_overtime = resolveBestNumericCandidate(
    'global_overtime',
    supplementalFieldCandidates.global_overtime,
    { minScore: 0.35 },
  )?.value;
  const travel_expenses = resolveBestNumericCandidate(
    'travel_expenses',
    supplementalFieldCandidates.travel_expenses,
    { minScore: 0.35 },
  )?.value;
  const gross_for_income_tax = resolveBestNumericCandidate(
    'gross_for_income_tax',
    supplementalFieldCandidates.gross_for_income_tax,
    { minScore: 0.4 },
  )?.value;
  const gross_for_national_insurance = resolveBestNumericCandidate(
    'gross_for_national_insurance',
    supplementalFieldCandidates.gross_for_national_insurance,
    { minScore: 0.4 },
  )?.value;
  const job_percent = resolveBestNumericCandidate(
    'job_percent',
    supplementalFieldCandidates.job_percent,
    { minScore: 0.35 },
  )?.value;

  const components = [];
  if (base_salary !== undefined) components.push({ type: 'base_salary', amount: base_salary });
  if (global_overtime !== undefined) components.push({ type: 'global_overtime', amount: global_overtime });
  if (travel_expenses !== undefined) components.push({ type: 'travel_expenses', amount: travel_expenses });

  let gross_minus_mandatory_deductions;
  if (gross_total !== undefined && mandatory_total !== undefined) {
    gross_minus_mandatory_deductions = +(gross_total - mandatory_total).toFixed(2);
  }

  const taxable_income = matchAmountFlexible(full, /הכנסה\s*חייבת\s*במס\s+(\d[\d,]*(?:\.\d{1,2})?)/i);
  const marginal_tax_rate = parsePercent(match1(full, /אחוז\s*מס\s*שולי\s+(\d+(?:\.\d+)?)%/i));
  const tax_credit_points = parseNumber(match1(full, /נקודות\s*זיכוי\s+(\d+(?:\.\d+)?)/i));
  const credit_resident = parseNumber(match1(full, /תושב\s*ישראל\s+(\d+(?:\.\d+)?)/i));
  const credit_woman =
    parseNumber(match1(full, /(?:אישה|אשה)\s+(\d+(?:\.\d+)?)/i)) ??
    parseNumber(match1(full, /\bAWN\b\s+(\d+(?:\.\d+)?)/i));

  const employment_start_raw = match1(full, /התחלת\s*עבודה\s+(\d{2}\/\d{2}\/\d{2,4})/i);
  const employment_start_date = parseDateDDMMYYYYorYY(employment_start_raw);
  const hmo = translateHMO(extractHMO(full));

  const resolvedParties = resolvePartyCandidates(collectPartyCandidates(normalizedDoc));
  const employer_name = resolvedParties.employer_name?.value;
  const employee_name = resolvedParties.employee_name?.value;
  const employee_id = resolvedParties.employee_id?.value;

  const contributionCollection = collectContributionCandidates(lines);
  const { study, pension } = resolveContributionCandidates(
    contributionCollection.store,
    contributionCollection.stats,
    warnings,
  );

  if (!month) {
    warnings.push('Missing period.month (OCR+filename fallback failed)');
  }
  if (gross_total === undefined) {
    warnings.push('Missing salary.gross_total');
  }
  if (net_payable === undefined) {
    warnings.push('Missing salary.net_payable');
  }
  if (mandatory_total === undefined) {
    warnings.push('Missing deductions.mandatory.total');
  }

  const tooBig = value => value !== undefined && value > 100000;
  if (
    tooBig(pension.employee) ||
    tooBig(pension.employer) ||
    tooBig(study.employee) ||
    tooBig(study.employer)
  ) {
    warnings.push('Unrealistic contribution amount detected (possible OCR/table confusion).');
  }

  const quality = buildQualityPayload(
    {
      period_month: monthCandidate,
      gross_total: grossCandidate,
      net_payable: netCandidate,
      mandatory_total: mandatoryResolution.candidate,
      income_tax: resolvedIncomeTax,
      national_insurance: resolvedNationalInsurance,
      health_insurance: resolvedHealthInsurance,
      employee_name: resolvedParties.employee_name,
      employee_id: resolvedParties.employee_id,
      employer_name: resolvedParties.employer_name,
      pension_employee: pension.quality.employee,
      pension_employer: pension.quality.employer,
      study_employee: study.quality.employee,
      study_employer: study.quality.employer,
    },
    warnings,
  );

  const result = {
    schema_version: '1.8',
    period: month ? { month } : {},

    salary: {
      gross_total,
      net_payable,
      gross_minus_mandatory_deductions,
      components,
    },

    deductions: {
      mandatory: {
        total: mandatory_total,
        total_is_derived: mandatoryResolution.total_is_derived,
        income_tax: resolvedIncomeTax?.value,
        national_insurance: resolvedNationalInsurance?.value,
        health_insurance: resolvedHealthInsurance?.value,
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
      ...quality,
      debug: {
        source_type: normalizedDoc.sourceType,
        sections: normalizedDoc.sections,
        study_line: study.debug_line,
        pension_lines_sample: pension.debug_lines,
      },
    },

    raw: {
      ocr_engine: 'tesseract-cli',
      ocr_lang: 'heb+eng',
      text_sha256: textHash,
      rawText: fullTextSource,
      ocr_text: fullTextSource,
    },
  };

  result.summary = buildPayslipSummary(result, fullTextSource);
  return result;
}

async function extractPayslipFile(inputPath) {
  const abs = path.resolve(inputPath);
  const ext = path.extname(abs).toLowerCase();
  let extractionMethod = 'ocr';

  const workDir = path.join(process.cwd(), '.work');
  await fs.mkdir(workDir, { recursive: true });

  let imagePaths = [];
  if (ext === '.pdf') {
    try {
      const embeddedText = await extractPdfEmbeddedText(abs);
      const normalized = embeddedText.replace(/\s+/g, ' ').trim();
      const brokenHebrew = isLikelyBrokenHebrew(embeddedText);

      if (normalized.length >= MIN_PDF_TEXT_LENGTH && !brokenHebrew) {
        extractionMethod = 'pdf_text';
        const data = extractPayslipFinancialEN(embeddedText, { sourcePath: abs });
        logExtractionResult({
          sourcePath: abs,
          extractionMethod,
          data,
        });
        data.raw = {
          ...data.raw,
          rawText: embeddedText,
          rawLines: toRawLines(embeddedText),
          extractionMethod,
        };
        return { data };
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('PDF text extraction failed, falling back to OCR:', error.message);
    }

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
      for (const imagePath of pagesToProcess) {
        const prepped = await preprocessImage(imagePath);
        try {
          const text = await ocrWithTesseract(prepped, { psm });
          fullText += `\n${text}`;
        } finally {
          if (prepped !== imagePath) {
            await fs.unlink(prepped).catch(() => {});
          }
        }
      }

      if (!fullText.trim()) {
        // eslint-disable-next-line no-console
        console.warn('[payslipOcr] OCR produced empty text', {
          sourcePath: path.basename(abs),
          psm,
        });
        continue;
      }

      const data = extractPayslipFinancialEN(fullText, { sourcePath: abs });
      logExtractionResult({
        sourcePath: abs,
        extractionMethod,
        psm,
        data,
      });
      data.raw = {
        ...data.raw,
        rawText: fullText,
        rawLines: toRawLines(fullText),
        extractionMethod,
      };
      candidates.push({ psm, data });
    } catch (error) {
      lastOcrError = error;
      // eslint-disable-next-line no-console
      console.warn('[payslipOcr] OCR pass failed', {
        sourcePath: path.basename(abs),
        psm,
        error: error.message,
      });
    }
  }

  if (!candidates.length) {
    if (lastOcrError) {
      throw lastOcrError;
    }
    throw new Error('OCR failed: no text extracted from any pass.');
  }

  return rankExtractionCandidates(candidates)[0];
}

module.exports = {
  extractPayslipFinancialEN,
  extractPayslipFile,
};
