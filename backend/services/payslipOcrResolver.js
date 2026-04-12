const {
  PAYSLIP_LABEL_MAP,
  extractAllAmountsFromLine,
  extractFromLinesByLabelMap,
  lineMatchesExclude,
  lineMatchesPattern,
} = require('./payslipOcrLabelMap');
const {
  clampScore,
  categorizeOcrWarning,
  dedupeStrings,
  extractMonthFromFilename,
  extractMonthYYYYMM,
  isCumulativeLine,
  isLikelyTaxBaseNoiseLine,
  match1,
  parseMoney,
  parsePercent,
} = require('./payslipOcrShared');

const CORE_NUMERIC_FIELDS = [
  'gross_total',
  'net_payable',
  'mandatory_total',
  'income_tax',
  'national_insurance',
  'health_insurance',
];

const SUPPLEMENTAL_NUMERIC_FIELDS = [
  'base_salary',
  'global_overtime',
  'travel_expenses',
  'gross_for_income_tax',
  'gross_for_national_insurance',
  'job_percent',
  'pension_base',
  'pension_employee',
  'pension_employer',
  'pension_severance',
  'study_base',
  'study_employee',
  'study_employer',
];

const CORE_TABLE_CANDIDATE_FIELDS = [
  ...CORE_NUMERIC_FIELDS,
];

const SUPPLEMENTAL_TABLE_CANDIDATE_FIELDS = [
  'base_salary',
  'global_overtime',
  'travel_expenses',
  'gross_for_income_tax',
  'gross_for_national_insurance',
];

const NUMERIC_FIELD_LIMITS = {
  gross_total: { min: 500, max: 200000 },
  net_payable: { min: 500, max: 200000 },
  mandatory_total: { min: 0, max: 60000 },
  income_tax: { min: 0, max: 30000 },
  national_insurance: { min: 0, max: 15000 },
  health_insurance: { min: 0, max: 15000 },
  base_salary: { min: 500, max: 200000 },
  global_overtime: { min: 0, max: 100000 },
  travel_expenses: { min: 0, max: 50000 },
  gross_for_income_tax: { min: 0, max: 200000 },
  gross_for_national_insurance: { min: 0, max: 200000 },
  job_percent: { min: 1, max: 200 },
  pension_base: { min: 5000, max: 200000 },
  pension_employee: { min: 0, max: 60000 },
  pension_employer: { min: 0, max: 60000 },
  pension_severance: { min: 0, max: 60000 },
  study_base: { min: 5000, max: 200000 },
  study_employee: { min: 0, max: 30000 },
  study_employer: { min: 0, max: 30000 },
};

const QUALITY_FIELD_WEIGHTS = {
  period_month: 1,
  gross_total: 3,
  net_payable: 3,
  mandatory_total: 2,
  income_tax: 1.5,
  national_insurance: 1,
  health_insurance: 1,
  employee_name: 1,
  employee_id: 1,
  employer_name: 0.75,
  pension_employee: 0.75,
  pension_employer: 0.75,
  study_employee: 0.5,
  study_employer: 0.5,
};

const FIELD_SECTIONS = {
  gross_total: ['earnings'],
  net_payable: ['summary', 'earnings', 'deductions'],
  mandatory_total: ['deductions'],
  income_tax: ['deductions'],
  national_insurance: ['deductions'],
  health_insurance: ['deductions'],
  base_salary: ['earnings'],
  global_overtime: ['earnings'],
  travel_expenses: ['earnings'],
  gross_for_income_tax: ['tax_base', 'deductions'],
  gross_for_national_insurance: ['tax_base', 'deductions'],
  job_percent: ['summary', 'identity'],
  pension_base: ['contributions'],
  pension_employee: ['contributions'],
  pension_employer: ['contributions'],
  pension_severance: ['contributions'],
  study_base: ['contributions'],
  study_employee: ['contributions'],
  study_employer: ['contributions'],
};

function inferEvidenceCategory(source) {
  if (!source) return 'unknown';
  if (source.startsWith('table_')) return 'table';
  if (source.startsWith('label_')) return 'label';
  if (source.startsWith('regex_')) return 'regex';
  if (source.includes('derived')) return 'derived';
  if (source.includes('fallback')) return 'fallback';
  return 'heuristic';
}

function pushCandidate(
  store,
  field,
  value,
  {
    source,
    lineIndex = null,
    score = 0.5,
    reason = '',
    section = null,
    evidenceCategory = undefined,
  } = {},
) {
  if (value === undefined || value === null) {
    return;
  }

  const normalizedValue =
    typeof value === 'string'
      ? value.replace(/\s+/g, ' ').trim()
      : value;

  if (
    (typeof normalizedValue === 'string' && !normalizedValue) ||
    (typeof normalizedValue === 'number' && !Number.isFinite(normalizedValue))
  ) {
    return;
  }

  if (!store[field]) {
    store[field] = [];
  }

  const key = `${field}|${source}|${lineIndex}|${String(normalizedValue)}`;
  const existing = store[field].find(candidate => candidate.key === key);

  if (existing) {
    existing.score = Math.max(existing.score, clampScore(score));
    if (!existing.reason && reason) {
      existing.reason = reason;
    }
    return;
  }

  store[field].push({
    key,
    field,
    value: normalizedValue,
    source,
    lineIndex,
    score: clampScore(score),
    reason,
    section,
    evidenceCategory: evidenceCategory || inferEvidenceCategory(source),
  });
}

function sortCandidatesByScore(candidates = []) {
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    if (typeof b.value === 'number' && typeof a.value === 'number') {
      return b.value - a.value;
    }

    return 0;
  });
}

function isReasonableFieldValue(field, value) {
  const limits = NUMERIC_FIELD_LIMITS[field];
  if (!limits || !Number.isFinite(value)) {
    return false;
  }

  return value >= limits.min && value <= limits.max;
}

function rankFieldAmounts(field, amounts) {
  const filtered = [...new Set(amounts.filter(value => isReasonableFieldValue(field, value)))];
  return filtered.sort((a, b) => b - a);
}

function isFieldBlockedByNoise(field, rawLine) {
  if (!rawLine) {
    return false;
  }

  if (
    ['gross_total', 'mandatory_total', 'base_salary', 'global_overtime', 'travel_expenses']
      .includes(field) &&
    isLikelyTaxBaseNoiseLine(rawLine)
  ) {
    return true;
  }

  if (
    [
      'income_tax',
      'national_insurance',
      'health_insurance',
      'mandatory_total',
      'base_salary',
      'global_overtime',
      'travel_expenses',
    ].includes(field)
    && isCumulativeLine(rawLine)
  ) {
    return true;
  }

  return false;
}

function linePreferredForField(field, entry) {
  const preferredSections = FIELD_SECTIONS[field] || [];
  if (!preferredSections.length) {
    return true;
  }

  if (!entry?.sectionHints?.length) {
    return true;
  }

  return preferredSections.some(section => entry.sectionHints.includes(section));
}

function adjustScoreForSection(field, entry, baseScore) {
  if (!entry) {
    return baseScore;
  }

  const preferredSections = FIELD_SECTIONS[field] || [];
  if (!preferredSections.length) {
    return baseScore;
  }

  if (preferredSections.some(section => entry.sectionHints.includes(section))) {
    return clampScore(baseScore + 0.05);
  }

  if (entry.sectionHints.includes('identity') && !preferredSections.includes('identity')) {
    return clampScore(baseScore - 0.2);
  }

  if (entry.sectionHints.includes('contributions') && preferredSections[0] !== 'contributions') {
    return clampScore(baseScore - 0.15);
  }

  if (entry.sectionHints.includes('tax_base') && !preferredSections.includes('tax_base')) {
    return clampScore(baseScore - 0.12);
  }

  return clampScore(baseScore - 0.05);
}

function resolveCandidateSection(field, sections = []) {
  const preferredSections = FIELD_SECTIONS[field] || [];
  const availableSections = Array.isArray(sections)
    ? sections.filter(Boolean)
    : [];

  if (!availableSections.length) {
    return preferredSections[0] || null;
  }

  const preferredMatch = preferredSections.find(section => availableSections.includes(section));
  if (preferredMatch) {
    return preferredMatch;
  }

  return availableSections[0];
}

function collectTableCandidates(store, context, fields, { tableMinCols = 6, baseScore = 0.98 } = {}) {
  for (const logicalRow of context.logicalRows || []) {
    const entry = context.lines[logicalRow.dataLineIndex];
    const headerEntry = context.lines[logicalRow.headerLineIndex];
    if (
      !entry ||
      !headerEntry ||
      entry.orderedAmounts.length < tableMinCols ||
      headerEntry.headerCells.length !== entry.orderedAmounts.length ||
      isCumulativeLine(entry.raw) ||
      isCumulativeLine(headerEntry.raw)
    ) {
      continue;
    }

    const hasSalaryRange = entry.orderedAmounts.some(value => value >= 500 && value <= 200000);
    if (!hasSalaryRange) {
      continue;
    }

    for (const field of fields) {
      const patterns = PAYSLIP_LABEL_MAP[field] || [];
      let matchedIndex = -1;

      for (let columnIndex = 0; columnIndex < headerEntry.headerCells.length; columnIndex += 1) {
        const cell = headerEntry.headerCells[columnIndex];
        if (!cell.normalized || lineMatchesExclude(cell.normalized, field) || isCumulativeLine(cell.raw)) {
          continue;
        }

        if (patterns.some(pattern => lineMatchesPattern(cell.normalized, pattern))) {
          matchedIndex = columnIndex;
          break;
        }
      }

      if (matchedIndex < 0) {
        continue;
      }

      const value = entry.orderedAmounts[matchedIndex];
      const logicalRowSections = logicalRow.sections?.length
        ? logicalRow.sections
        : (logicalRow.section ? [logicalRow.section] : []);
      const candidateSectionHints = dedupeStrings([
        ...logicalRowSections,
        ...(FIELD_SECTIONS[field] || []),
      ]);

      if (
        !isReasonableFieldValue(field, value) ||
        isFieldBlockedByNoise(field, entry.raw) ||
        !linePreferredForField(field, { sectionHints: candidateSectionHints })
      ) {
        continue;
      }

      pushCandidate(store, field, value, {
        source: 'table_header_column',
        lineIndex: entry.index,
        score: adjustScoreForSection(
          field,
          { ...entry, sectionHints: candidateSectionHints },
          baseScore,
        ),
        reason: `Matched "${field}" from a table header column.`,
        section: resolveCandidateSection(field, candidateSectionHints),
      });
    }
  }
}

function collectPeriodMonthCandidates(context, { sourcePath } = {}) {
  const candidates = [];

  const fromText = extractMonthYYYYMM(context.fullText);
  if (fromText) {
    candidates.push({
      field: 'period_month',
      value: fromText,
      source: 'text_period_label',
      score: 0.96,
      reason: 'Found month in OCR text.',
    });
  }

  const fromFilename = sourcePath ? extractMonthFromFilename(sourcePath) : undefined;
  if (fromFilename) {
    candidates.push({
      field: 'period_month',
      value: fromFilename,
      source: 'filename_period_fallback',
      score: 0.7,
      reason: 'Fell back to filename-based period extraction.',
    });
  }

  return candidates;
}

function pushRegexValueCandidates(
  store,
  field,
  text,
  regexes,
  { score, source, reason, parser, section = null } = {},
) {
  for (const regex of regexes) {
    const captured = match1(text, regex);
    const normalizedCapture =
      typeof captured === 'string'
        ? captured.split(/\r?\n/)[0].trim()
        : captured;
    const value = parser ? parser(normalizedCapture) : parseMoney(normalizedCapture);
    if (value !== undefined && isReasonableFieldValue(field, value)) {
      pushCandidate(store, field, value, {
        source,
        score,
        reason,
        section,
      });
    }
  }
}

function collectLabelCandidates(store, context, fields, { adjacentWindow = 5, adjacentScore = 0.86 } = {}) {
  for (const field of fields) {
    const patterns = PAYSLIP_LABEL_MAP[field] || [];

    for (const entry of context.lines) {
      if (isFieldBlockedByNoise(field, entry.raw)) {
        continue;
      }

      const matchesField = patterns.some(pattern => lineMatchesPattern(entry.normalized, pattern));
      if (!matchesField || lineMatchesExclude(entry.normalized, field)) {
        continue;
      }

      if (!linePreferredForField(field, entry)) {
        continue;
      }

      const rankedAmounts = rankFieldAmounts(field, entry.amounts);
      rankedAmounts.slice(0, 3).forEach((value, index) => {
        pushCandidate(store, field, value, {
          source: 'label_same_line',
          lineIndex: entry.index,
          score: adjustScoreForSection(field, entry, 0.96 - (index * 0.05)),
          reason: `Matched "${field}" on the same line as the label.`,
          section: entry.primarySection,
        });
      });

      if (rankedAmounts.length > 0) {
        continue;
      }

      for (let distance = 1; distance <= adjacentWindow; distance += 1) {
        for (const direction of [1, -1]) {
          const neighbor = context.lines[entry.index + (direction * distance)];
          if (!neighbor || isFieldBlockedByNoise(field, neighbor.raw) || !linePreferredForField(field, neighbor)) {
            continue;
          }

          const neighborAmounts = rankFieldAmounts(field, neighbor.amounts);
          if (neighborAmounts.length !== 1) {
            continue;
          }

          pushCandidate(store, field, neighborAmounts[0], {
            source: 'label_adjacent_line',
            lineIndex: neighbor.index,
            score: adjustScoreForSection(field, neighbor, adjacentScore - ((distance - 1) * 0.07)),
            reason: `Matched "${field}" from a nearby labeled line.`,
            section: neighbor.primarySection,
          });
        }
      }
    }
  }
}

function collectCoreFieldCandidates(context) {
  const store = {};
  const legacyLabelMap = extractFromLinesByLabelMap(context.lines.map(line => line.raw));

  collectLabelCandidates(store, context, CORE_NUMERIC_FIELDS);
  collectTableCandidates(store, context, CORE_TABLE_CANDIDATE_FIELDS, { tableMinCols: 6 });

  for (const entry of context.lines) {
    if (isLikelyTaxBaseNoiseLine(entry.raw) || isCumulativeLine(entry.raw)) {
      continue;
    }

    const amounts = extractAllAmountsFromLine(entry.raw, { min: 1, max: 500000 });
    if (amounts.length < 3) {
      continue;
    }

    const salaryRangeAmounts = amounts
      .filter(value => value >= 2000 && value <= 100000)
      .sort((a, b) => b - a);
    const deductionRangeAmounts = amounts
      .filter(value => value >= 100 && value <= NUMERIC_FIELD_LIMITS.mandatory_total.max)
      .sort((a, b) => b - a);

    const previousLine = context.lines[entry.index - 1];
    const nextLine = context.lines[entry.index + 1];
    const previousNormalized = previousLine?.normalized || '';
    const nextNormalized = nextLine?.normalized || '';

    const matchesNearbyLabel = field => {
      const patterns = PAYSLIP_LABEL_MAP[field] || [];
      const previousMatches = previousNormalized
        && !lineMatchesExclude(previousNormalized, field)
        && patterns.some(pattern => lineMatchesPattern(previousNormalized, pattern));
      const nextMatches = nextNormalized
        && !lineMatchesExclude(nextNormalized, field)
        && patterns.some(pattern => lineMatchesPattern(nextNormalized, pattern));

      return previousMatches || nextMatches;
    };

    if (salaryRangeAmounts.length > 0 && matchesNearbyLabel('gross_total')) {
      pushCandidate(store, 'gross_total', salaryRangeAmounts[0], {
        source: 'table_main_row',
        lineIndex: entry.index,
        score: adjustScoreForSection('gross_total', entry, 0.92),
        reason: 'Resolved gross salary from a nearby labeled table row.',
        section: entry.primarySection,
      });
    }

    if (deductionRangeAmounts.length > 0 && matchesNearbyLabel('mandatory_total')) {
      pushCandidate(store, 'mandatory_total', deductionRangeAmounts[0], {
        source: 'table_main_row',
        lineIndex: entry.index,
        score: adjustScoreForSection('mandatory_total', entry, 0.9),
        reason: 'Resolved mandatory deductions from a nearby labeled table row.',
        section: entry.primarySection,
      });
    }
  }

  pushRegexValueCandidates(store, 'gross_total', context.fullText, [
    /סך[-\s]?כל\s*התשלומים[^\d]*(\d[\d,.\s₪]+)/i,
    /סה['"״]כ\s*תשלומים[^\d]*(\d[\d,.\s₪]+)/i,
    /שכר\s*ברוטו[^\d]*(\d[\d,.\s₪]+)/i,
  ], {
    source: 'regex_gross_label',
    score: 0.94,
    reason: 'Matched gross salary with a dedicated regex.',
    section: 'earnings',
  });

  pushRegexValueCandidates(store, 'net_payable', context.fullText, [
    /נטו\s*לתשלום[^\d]*(\d[\d,.\s₪]+)/i,
    /שכר\s*נטו(?:\s*לתשלום)?[^\d]*(\d[\d,.\s₪]+)/i,
    /סה['"״]כ\s*לתשלום[^\d]*(\d[\d,.\s₪]+)/i,
  ], {
    source: 'regex_net_label',
    score: 0.93,
    reason: 'Matched net salary with a dedicated regex.',
    section: 'summary',
  });

  pushRegexValueCandidates(store, 'mandatory_total', context.fullText, [
    /כל\s*הניכו\w*[^\d]*(\d[\d,.\s₪]+)/i,
    /סה["״']?כ\s*ניכו\w*[^\d]*(\d[\d,.\s₪]+)/i,
    /ניכויי\s*חובה[^\d]*(\d[\d,.\s₪]+)/i,
  ], {
    source: 'regex_mandatory_total',
    score: 0.9,
    reason: 'Matched mandatory deductions total with a dedicated regex.',
    section: 'deductions',
  });

  pushRegexValueCandidates(store, 'income_tax', context.fullText, [/מס\s*הכנסה[^\d]*(\d[\d,.\s₪]+)/i], {
    source: 'regex_income_tax',
    score: 0.89,
    reason: 'Matched income tax with a dedicated regex.',
    section: 'deductions',
  });

  pushRegexValueCandidates(store, 'national_insurance', context.fullText, [
    /ביטוח\s*לאומי[^\d]*(\d[\d,.\s₪]+)/i,
    /National\s+Insurance[^\d]*(\d[\d,.\s₪]+)/i,
  ], {
    source: 'regex_national_insurance',
    score: 0.87,
    reason: 'Matched national insurance with a dedicated regex.',
    section: 'deductions',
  });

  pushRegexValueCandidates(store, 'health_insurance', context.fullText, [
    /ביטוח\s*בריאות[^\d]*(\d[\d,.\s₪]+)/i,
    /מס\s*בריאות[^\d]*(\d[\d,.\s₪]+)/i,
    /Health\s+Insurance[^\d]*(\d[\d,.\s₪]+)/i,
  ], {
    source: 'regex_health_insurance',
    score: 0.87,
    reason: 'Matched health insurance with a dedicated regex.',
    section: 'deductions',
  });

  if (/סכום\s*בבנק/i.test(context.fullText)) {
    const labelIndex = context.fullText.search(/סכום\s*בבנק/i);
    const beforeLabel = context.fullText.slice(Math.max(0, labelIndex - 350), labelIndex);
    const bankCandidates = beforeLabel
      .match(/\d[\d.,]*/g)
      ?.map(token => parseMoney(token))
      .filter(value => isReasonableFieldValue('net_payable', value))
      .sort((a, b) => b - a) || [];

    if (bankCandidates[0] !== undefined) {
      pushCandidate(store, 'net_payable', bankCandidates[0], {
        source: 'bank_label_backward_scan',
        score: 0.74,
        reason: 'Used the amount immediately before the bank amount label.',
        section: 'summary',
      });
    }
  }

  for (const field of [...CORE_NUMERIC_FIELDS, 'base_salary', 'global_overtime', 'travel_expenses']) {
    const value = legacyLabelMap[field];
    if (value !== undefined && isReasonableFieldValue(field, value)) {
      pushCandidate(store, field, value, {
        source: 'legacy_label_map',
        score: 0.66,
        reason: 'Fallback candidate from the legacy label-map extractor.',
        section: FIELD_SECTIONS[field]?.[0] || null,
      });
    }
  }

  return store;
}

function collectSupplementalFieldCandidates(context, labelMap = {}) {
  const store = {};

  collectLabelCandidates(store, context, ['base_salary', 'global_overtime', 'travel_expenses'], {
    adjacentWindow: 1,
    adjacentScore: 0.8,
  });
  collectLabelCandidates(store, context, ['gross_for_income_tax', 'gross_for_national_insurance'], {
    adjacentWindow: 2,
    adjacentScore: 0.82,
  });
  collectTableCandidates(store, context, SUPPLEMENTAL_TABLE_CANDIDATE_FIELDS, { tableMinCols: 4, baseScore: 0.94 });

  pushRegexValueCandidates(store, 'base_salary', context.fullText, [
    /שכר\s*בסיס[^\d]*(\d[\d,.\s₪]+)/i,
    /Base\s*Salary[^\d]*(\d[\d,.\s₪]+)/i,
  ], {
    source: 'regex_base_salary',
    score: 0.88,
    reason: 'Matched base salary with a dedicated regex.',
    section: 'earnings',
  });

  pushRegexValueCandidates(store, 'global_overtime', context.fullText, [
    /ש\.?\s*נוס\.?\s*גלובל(?:י(?:ו(?:ת)?)?)?[^\d]*(\d[\d,.\s₪]+)/i,
    /שעות\s*נוספות\s*גלובל[^\d]*(\d[\d,.\s₪]+)/i,
    /overtime[^\d]*(\d[\d,.\s₪]+)/i,
  ], {
    source: 'regex_global_overtime',
    score: 0.84,
    reason: 'Matched global overtime with a dedicated regex.',
    section: 'earnings',
  });

  pushRegexValueCandidates(store, 'travel_expenses', context.fullText, [
    /נסיעות[^\d]*(\d[\d,.\s₪]+)/i,
    /דמי\s*נסיעה[^\d]*(\d[\d,.\s₪]+)/i,
    /travel[^\d]*(\d[\d,.\s₪]+)/i,
  ], {
    source: 'regex_travel_expenses',
    score: 0.84,
    reason: 'Matched travel expenses with a dedicated regex.',
    section: 'earnings',
  });

  pushRegexValueCandidates(store, 'gross_for_income_tax', context.fullText, [
    /ברוטו\s*למס\s*הכנסה[^\d]*(\d[\d,.\s₪]+)/i,
    /הכנסה\s*חייבת\s*במס[^\d]*(\d[\d,.\s₪]+)/i,
  ], {
    source: 'regex_gross_for_income_tax',
    score: 0.86,
    reason: 'Matched taxable gross with a dedicated regex.',
    section: 'tax_base',
  });

  pushRegexValueCandidates(store, 'gross_for_national_insurance', context.fullText, [
    /(?:שכר\s*חייב\s*ב\.?\s*ל\.?|שכר\s*חייב\s*בב\.?\s*ל\.?|ברוטו\s*לב\.?\s*לאומי|הכנסה\s*חייבת\s*ביטוח\s*לאומי)[^\d]*(\d[\d,.\s₪]+)/i,
  ], {
    source: 'regex_gross_for_national_insurance',
    score: 0.86,
    reason: 'Matched national insurance gross with a dedicated regex.',
    section: 'tax_base',
  });

  pushRegexValueCandidates(store, 'job_percent', context.fullText, [
    /חלקיות\s+(\d+(?:\.\d+)?)%/i,
    /אחוז\s*משרה[^\d]*(\d+(?:\.\d+)?)\s*%?/i,
  ], {
    source: 'regex_job_percent',
    score: 0.82,
    reason: 'Matched job percentage with a dedicated regex.',
    parser: parsePercent,
    section: 'summary',
  });

  for (const field of ['base_salary', 'global_overtime', 'travel_expenses']) {
    const value = labelMap[field];
    if (value !== undefined && isReasonableFieldValue(field, value)) {
      pushCandidate(store, field, value, {
        source: 'label_map_fallback',
        score: 0.62,
        reason: 'Fallback candidate from the label map.',
        section: FIELD_SECTIONS[field]?.[0] || null,
      });
    }
  }

  return store;
}

function resolveBestNumericCandidate(field, candidates, { minScore = 0.45 } = {}) {
  const viable = sortCandidatesByScore(candidates).filter(
    candidate => isReasonableFieldValue(field, candidate.value) && candidate.score >= minScore,
  );

  return viable[0];
}

function resolveGrossAndNetCandidates(grossCandidates, netCandidates, warnings) {
  const viableGross = sortCandidatesByScore(grossCandidates).filter(
    candidate => candidate.score >= 0.45 && isReasonableFieldValue('gross_total', candidate.value),
  );
  const viableNet = sortCandidatesByScore(netCandidates).filter(
    candidate => candidate.score >= 0.45 && isReasonableFieldValue('net_payable', candidate.value),
  );

  let bestPair;

  for (const grossCandidate of [undefined, ...viableGross]) {
    for (const netCandidate of [undefined, ...viableNet]) {
      if (!grossCandidate && !netCandidate) {
        continue;
      }

      if (grossCandidate && netCandidate && netCandidate.value > grossCandidate.value) {
        continue;
      }

      let score = (grossCandidate?.score || 0) + (netCandidate?.score || 0);

      if (grossCandidate && netCandidate) {
        const netRatio = grossCandidate.value > 0 ? netCandidate.value / grossCandidate.value : 0;
        if (netRatio < 0.25) {
          score -= 0.08;
        }
      }

      if (
        !bestPair ||
        score > bestPair.score ||
        (score === bestPair.score && grossCandidate && !bestPair.grossCandidate)
      ) {
        bestPair = {
          grossCandidate,
          netCandidate,
          score,
        };
      }
    }
  }

  if (
    viableGross[0] &&
    viableNet[0] &&
    viableNet[0].value > viableGross[0].value &&
    (!bestPair?.grossCandidate || !bestPair?.netCandidate)
  ) {
    warnings.push('Conflicting gross/net candidates detected; kept only the stronger validated salary field.');
  }

  return bestPair || {
    grossCandidate: undefined,
    netCandidate: undefined,
    score: 0,
  };
}

function resolveMandatoryTotalCandidate(explicitCandidates, resolvedComponents, grossTotal, warnings) {
  const candidates = [...(explicitCandidates || [])];
  const componentValues = [
    resolvedComponents.income_tax?.value,
    resolvedComponents.national_insurance?.value,
    resolvedComponents.health_insurance?.value,
  ].filter(value => Number.isFinite(value));

  const componentSum =
    componentValues.length === 3
      ? Number((componentValues[0] + componentValues[1] + componentValues[2]).toFixed(2))
      : undefined;

  if (componentSum !== undefined) {
    candidates.push({
      field: 'mandatory_total',
      value: componentSum,
      source: 'derived_component_sum',
      lineIndex: null,
      score: 0.68,
      reason: 'Derived from income tax + national insurance + health insurance.',
    });
  }

  const scored = sortCandidatesByScore(candidates)
    .map(candidate => {
      let adjustedScore = candidate.score;

      if (!isReasonableFieldValue('mandatory_total', candidate.value)) {
        return null;
      }

      if (grossTotal !== undefined && candidate.value > grossTotal) {
        return null;
      }

      if (grossTotal !== undefined && candidate.value < Math.max(150, grossTotal * 0.005)) {
        adjustedScore -= 0.25;
      }

      if (componentSum !== undefined) {
        const delta = Math.abs(componentSum - candidate.value);
        const closeTolerance = Math.max(25, componentSum * 0.08);
        const mismatchTolerance = Math.max(150, componentSum * 0.35);

        if (delta <= closeTolerance) {
          adjustedScore += 0.15;
        } else if (candidate.source !== 'derived_component_sum' && delta > mismatchTolerance) {
          adjustedScore -= 0.25;
        }
      }

      return {
        ...candidate,
        score: clampScore(adjustedScore),
        section: candidate.section || FIELD_SECTIONS.mandatory_total?.[0] || null,
      };
    })
    .filter(Boolean)
    .filter(candidate => candidate.score >= 0.4)
    .sort((a, b) => b.score - a.score || b.value - a.value);

  const best = scored[0];

  if (best && componentSum !== undefined && best.source !== 'derived_component_sum') {
    const delta = Math.abs(componentSum - best.value);
    const mismatchTolerance = Math.max(150, componentSum * 0.35);
    if (delta > mismatchTolerance) {
      warnings.push('Mandatory deductions total conflicts with the resolved component deductions.');
    }
  }

  return {
    candidate: best,
    total_is_derived: best?.source === 'derived_component_sum',
  };
}

function buildQualityPayload(fieldCandidates, warnings) {
  const fields = {};
  let weightedSum = 0;
  let totalWeight = 0;
  let resolvedCount = 0;
  const normalizedWarnings = dedupeStrings(warnings);
  const warningDetails = normalizedWarnings.map(message => ({
    message,
    category: categorizeOcrWarning(message),
  }));
  const warningCategories = dedupeStrings(warningDetails.map(detail => detail.category));

  Object.entries(QUALITY_FIELD_WEIGHTS).forEach(([field, weight]) => {
    totalWeight += weight;
    const candidate = fieldCandidates[field];
    if (!candidate) {
      return;
    }

    resolvedCount += 1;
    weightedSum += candidate.score * weight;
    fields[field] = {
      confidence: Number(candidate.score.toFixed(2)),
      source: candidate.source,
      evidence_category: candidate.evidenceCategory || inferEvidenceCategory(candidate.source),
      section: candidate.section || null,
      reason: candidate.reason || null,
      abstained: false,
    };
  });

  Object.keys(QUALITY_FIELD_WEIGHTS).forEach(field => {
    if (fields[field]) {
      return;
    }

    fields[field] = {
      confidence: 0,
      source: null,
      evidence_category: null,
      section: null,
      reason: null,
      abstained: true,
    };
  });

  const warningPenalty = Math.min(0.2, normalizedWarnings.length * 0.02);
  const confidence = clampScore((totalWeight > 0 ? weightedSum / totalWeight : 0) - warningPenalty);

  return {
    confidence,
    resolution_score: Number(Math.max(0, weightedSum - warningPenalty).toFixed(3)),
    resolved_core_fields: resolvedCount,
    warnings: normalizedWarnings,
    warning_categories: warningCategories,
    warning_details: warningDetails,
    fields,
  };
}

function rankExtractionCandidates(candidates = []) {
  return [...candidates].sort(
    (a, b) =>
      (b.data?.quality?.resolution_score ?? 0) - (a.data?.quality?.resolution_score ?? 0) ||
      (b.data?.quality?.confidence ?? 0) - (a.data?.quality?.confidence ?? 0) ||
      (a.data?.quality?.warnings?.length ?? 0) - (b.data?.quality?.warnings?.length ?? 0),
  );
}

module.exports = {
  CORE_NUMERIC_FIELDS,
  QUALITY_FIELD_WEIGHTS,
  SUPPLEMENTAL_NUMERIC_FIELDS,
  buildQualityPayload,
  collectCoreFieldCandidates,
  collectPeriodMonthCandidates,
  collectSupplementalFieldCandidates,
  isReasonableFieldValue,
  pushCandidate,
  rankExtractionCandidates,
  resolveBestNumericCandidate,
  resolveGrossAndNetCandidates,
  resolveMandatoryTotalCandidate,
  sortCandidatesByScore,
  inferEvidenceCategory,
};
