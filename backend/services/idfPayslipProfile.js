/**
 * IDF (צה"ל) payslip column profile.
 *
 * Fixed columns (underscores on payslip):
 * - gross: סה_כ_תשלומים_שוטפים
 * - net: שכר_חודשי_נטו
 * - pension employee: ניכוי_לקרן_הפנסיה
 * - pension total: השתתפות_בקרן_הפנסיה
 * - study employee: ניכוי_לקרן__השתלמות
 * - study total: השתתפות_בקרן_ההשתלמו
 */

const { extractAllNumericTokens } = require('./payslipOcrNumbers');
const { parseMoney, normalizeHebrewLine } = require('./payslipOcrShared');

const IDF_EMPLOYER_MARKERS = [
  /צבא\s*הגנה\s*לישראל/i,
  /צה["״']?ל/i,
  /משרד\s*הביטחון/i,
];

const IDF_GROSS_RAW_MARKERS = [
  'סה_כ_תשלומים_שוטפים',
  'סהכ_תשלומים_שוטפים',
  'סה_כ_תשלומיםשוטפים',
];

const IDF_NET_RAW_MARKERS = ['שכר_חודשי_נטו', 'נטו_לתשלום'];

const IDF_SALARY_COLUMNS = Object.freeze([
  {
    field: 'gross_total',
    descriptionHe: 'סה"כ תשלומים שוטפים — ברוטו',
    labelPatterns: [
      /סה\s*["״'']?כ\s+תשלומים\s+שוטפים/i,
      /סהכ\s+תשלומים\s+שוטפים/i,
      /תשלומים\s+שוטפים/i,
    ],
    rawMarkers: IDF_GROSS_RAW_MARKERS,
    amountRange: { min: 5000, max: 250000 },
  },
  {
    field: 'net_payable',
    descriptionHe: 'שכר חודשי נטו',
    labelPatterns: [/שכר\s+חודשי\s+נטו/i, /נטו\s+לתשלום/i],
    rawMarkers: IDF_NET_RAW_MARKERS,
    amountRange: { min: 500, max: 250000 },
    strictRawOnly: false,
  },
]);

const IDF_CONTRIBUTION_COLUMNS = Object.freeze([
  {
    field: 'pension_employee',
    fund: 'pension',
    role: 'employee',
    descriptionHe: 'ניכוי לקרן הפנסיה — הפרשת העובד',
    labelPatterns: [
      /ניכוי\s+ל\s*קרן\s+ה+פנסיה/i,
      /נכוי\s+ל\s*קרן\s+ה+פנסיה/i,
      /ניכוי\s+ל\s*קרן\s+פנסיה/i,
    ],
    rawMarkers: ['ניכוי_לקרן_הפנסיה', 'ניכוי_לקרן__הפנסיה', 'נכוי_לקרן_הפנסיה'],
    amountRange: { min: 1, max: 60000 },
  },
  {
    field: 'pension_participation_total',
    fund: 'pension',
    role: 'participation_total',
    descriptionHe: 'השתתפות בקרן הפנסיה — הפרשת המעסיק',
    labelPatterns: [/השתתפות\s+ב\s*קרן\s+ה*פנסיה/i],
    rawMarkers: ['השתתפות_בקרן_הפנסיה', 'השתתפות_בקרן_הפנס'],
    amountRange: { min: 1, max: 120000 },
  },
  {
    field: 'study_employee',
    fund: 'study',
    role: 'employee',
    descriptionHe: 'ניכוי לקרן השתלמות — הפרשת העובד',
    labelPatterns: [
      /ניכוי\s+ל\s*קרן\s+[\s|"'״']*(?:ה+)?שתלמ/i,
      /נכוי\s+ל\s*קרן\s+[\s|"'״']*(?:ה+)?שתלמ/i,
      /ניכוי\s+ל\s*קרן\s+השתלמות/i,
    ],
    rawMarkers: [
      'ניכוי_לקרן__השתלמות',
      'ניכוי_לקרן_השתלמות',
      'נכוי_לקרן__השתלמות',
      'נכוי_לקרן_השתלמות',
    ],
    amountRange: { min: 1, max: 30000 },
  },
  {
    field: 'study_participation_total',
    fund: 'study',
    role: 'participation_total',
    descriptionHe: 'השתתפות בקרן ההשתלמות — הפרשת המעסיק',
    labelPatterns: [/השתתפות\s+ב\s*קרן\s+ה*שתלמ/i],
    rawMarkers: ['השתתפות_בקרן_ההשתלמו', 'השתתפות_בקרן_השתלמות'],
    amountRange: { min: 1, max: 60000 },
  },
]);

const IDF_COLUMN_MARKER_REGEX =
  /(?:ניכוי|נכוי)_?ל_?קרן|השתתפות_בקרן|סה[_\s]*כ[_\s]*תשלומים[_\s]*שוטפים|שכר[_\s]*חודשי[_\s]*נטו/i;

const IDF_GROSS_LINE_REGEX =
  /סה\s*["״'']?כ[^\n]{0,40}תשלומים[^\n]{0,20}שוטפים|תשלומים\s+שוטפים|תשלו[^\n]{0,12}מים\s+שוטפים/i;

const IDF_NET_HEADER_REGEX = /שכר\s+חודשי\s+נטו/i;
const IDF_NET_HEADER_LOOSE_REGEX = /שכר[_\s]*חודשי/i;

const IDF_GROSS_TEXT_REGEXES = [
  /סה[_\s"״'']*כ[_\s]*תשלומים[_\s]*שוטפים[^\d\n]{0,80}(\d[\d,.\s₪]+)/i,
  /(\d[\d,.\s₪]+)[^\d\n]{0,80}סה[_\s"״'']*כ[_\s]*תשלומים[_\s]*שוטפים/i,
  /תשלומים[_\s]*שוטפים[^\d\n]{0,80}(\d[\d,.\s₪]+)/i,
];

/** OCR often mangles "נטו" into a tiny code like 101 / 102 / )10 glued onto the amount. */
const IDF_NET_TEXT_REGEXES = [
  /שכר[_\s]*חודשי[_\s]*נטו[^\d\n]*(\d[\d,.\s₪]+)/i,
  /שכר[_\s]*חודשי[^\n]{0,24}?((?:102|101|10)?[1-9]\d{3,}(?:[.,]\d+)?)/i,
];

const IDF_DEDUCTIONS_TEXT_REGEXES = [
  // Prefer amount AFTER the ניכויים label. Never use the amount-before variant on a
  // dual-column line — it often captures סה״כ תשלומים שוטפים instead.
  /סה[_\s"״'']*כ[_\s]*ניכויים[_\s]*שוטפים[^\d\n]{0,40}(\d[\d,.\s₪]+)/i,
];

function isLikelyLeaveBalanceAmount(value) {
  if (!Number.isFinite(value)) return false;
  // Classic OCR glue: sick-day balance 235 + date 01.01.24 → 23501.01
  if (Math.abs(value - 23501.01) < 0.001) return true;
  const text = String(value);
  return /^\d{2,3}01\.01(?:0+)?$/.test(text);
}

const normalizeIdfLine = normalizeHebrewLine;

function isCalendarYearAmount(value) {
  return (
    Number.isFinite(value) &&
    value >= 1990 &&
    value <= 2099 &&
    Math.abs(value - Math.round(value)) < 0.001
  );
}

function isLeaveBalanceNoiseLine(text) {
  return /(?:יתרת\s*ימי|ימי\s*מחלה|ימי\s*חופשה|ניצול\s*שנתי|לניצול)/i.test(String(text || ''));
}

/**
 * IDF amounts are printed with 3 decimal places (21653.250). OCR often drops
 * the dot → 21653250, which then exceeds salary max and is discarded — leaving
 * a wrong gross and causing the true net to be rejected as "above gross".
 */
function repairIdfOcrAmount(value) {
  if (!Number.isFinite(value)) {
    return value;
  }
  if (value >= 100000 && Math.abs(value - Math.round(value)) < 0.001) {
    const digits = String(Math.round(value));
    if (digits.length >= 7 && digits.length <= 9) {
      const repaired = Number((value / 1000).toFixed(3));
      if (repaired >= 500 && repaired <= 250000) {
        return repaired;
      }
    }
  }
  return value;
}

function parseIdfMoney(token) {
  return repairIdfOcrAmount(parseMoney(token));
}

function idfAmountsFromLine(line) {
  return extractAllNumericTokens(line).map(repairIdfOcrAmount);
}

/**
 * Repair OCR glitches like ")1012734.430" / "1012734.430" where "נטו"→101
 * was glued onto the real net amount 12734.430.
 */
function repairIdfGluedNetAmount(rawToken) {
  const digits = String(rawToken || '').replace(/[^\d.]/g, '');
  const peeledCandidates = [];

  // OCR often replaces "נטו" with a tiny code glued onto the amount:
  //   )1017423.930 → 17423.930 (via 10…) or wrongly 7423 via 101…
  //   10217423.930 → 17423.930
  //   10112734.430 → 12734.430
  const peelPrefixes = [
    { re: /^101([1-9]\d{3,4}(?:\.\d+)?)$/, min: 3000, max: 80000 },
    { re: /^102([1-9]\d{3,4}(?:\.\d+)?)$/, min: 3000, max: 80000 },
    { re: /^10([1-9]\d{4}(?:\.\d+)?)$/, min: 10000, max: 80000 },
  ];
  for (const { re, min, max } of peelPrefixes) {
    const match = digits.match(re);
    if (!match) continue;
    const peeled = parseIdfMoney(match[1]);
    if (Number.isFinite(peeled) && peeled >= min && peeled <= max) {
      peeledCandidates.push(peeled);
    }
  }
  if (peeledCandidates.length) {
    return Math.max(...peeledCandidates);
  }

  const direct = parseIdfMoney(rawToken);
  if (Number.isFinite(direct) && direct >= 3000 && direct <= 250000 && !isCalendarYearAmount(direct)) {
    return direct;
  }
  return null;
}

function pickIdfNetAmountFromTokens(amounts) {
  const salaryLike = (amounts || [])
    .map(repairIdfOcrAmount)
    .filter(
      value => Number.isFinite(value) && value >= 3000 && value <= 250000 && !isCalendarYearAmount(value),
    );
  if (!salaryLike.length) return null;
  return Math.max(...salaryLike);
}

function lineMatchesIdfColumn(raw, column) {
  const text = String(raw || '');
  const normalized = normalizeIdfLine(text);

  if (column.rawMarkers?.some(marker => text.includes(marker))) {
    return true;
  }

  if (column.field === 'gross_total' && isIdfGrossLabelText(normalized)) {
    return true;
  }

  return column.labelPatterns.some(
    pattern => pattern.test(normalized) || pattern.test(text),
  );
}

function isIdfNetHeaderText(text) {
  const raw = String(text || '');
  const normalized = normalizeIdfLine(raw);
  if (IDF_NET_HEADER_REGEX.test(normalized) || IDF_NET_HEADER_REGEX.test(raw)) {
    return true;
  }
  if (!IDF_NET_HEADER_LOOSE_REGEX.test(normalized) && !IDF_NET_HEADER_LOOSE_REGEX.test(raw)) {
    return false;
  }
  if (/נטו/i.test(normalized) || /נטו/i.test(raw)) {
    return true;
  }
  // "שכר חודשי 101 12734.430" — OCR replaced נטו with a tiny integer code
  const amounts = extractAllNumericTokens(raw);
  const tinyCodes = amounts.filter(value => value >= 50 && value <= 250 && Number.isInteger(value));
  const salaryLike = pickIdfNetAmountFromTokens(amounts);
  return Boolean(tinyCodes.length && salaryLike);
}

function isIdfGrossLabelText(text) {
  const normalized = normalizeIdfLine(text);
  if (!IDF_GROSS_LINE_REGEX.test(normalized) && !IDF_GROSS_LINE_REGEX.test(text)) {
    return false;
  }
  // Must be the שוטפים column, not generic סך כל התשלומים.
  return /שוטפים/i.test(normalized) || /שוטפים/i.test(text);
}

function findIdfGrossLabelIndex(entries) {
  for (let index = 0; index < entries.length; index += 1) {
    const raw = String(entries[index]?.raw || '');
    if (isIdfGrossLabelText(raw)) {
      return index;
    }

    const window = entries
      .slice(index, index + 5)
      .map(entry => normalizeIdfLine(entry?.raw || ''))
      .join(' ');
    if (isIdfGrossLabelText(window)) {
      return index;
    }
  }
  return -1;
}

function pushIdfGrossCandidate(store, pushCandidate, amount, lineIndex, source, adjacent) {
  const repaired = repairIdfOcrAmount(amount);
  if (!Number.isFinite(repaired) || repaired < 5000 || repaired > 250000) {
    return;
  }
  if (isLikelyLeaveBalanceAmount(repaired)) {
    return;
  }
  amount = repaired;
  pushCandidate(store, 'gross_total', amount, {
    source: adjacent ? `${source}_adjacent` : source,
    lineIndex,
    score: adjacent ? 0.97 : 0.99,
    reason: 'תלוש צה"ל — סה"כ תשלומים שוטפים',
    section: 'earnings',
    evidenceCategory: 'idf_column',
  });
}

function pushIdfNetCandidate(store, pushCandidate, amount, lineIndex, source, adjacent) {
  amount = repairIdfOcrAmount(amount);
  if (!Number.isFinite(amount) || amount < 500 || amount > 250000 || isCalendarYearAmount(amount)) {
    return;
  }
  pushCandidate(store, 'net_payable', amount, {
    source: adjacent ? `${source}_adjacent` : source,
    lineIndex,
    score: adjacent ? 0.97 : 0.99,
    reason: 'תלוש צה"ל — שכר חודשי נטו',
    section: 'summary',
    evidenceCategory: 'idf_column',
  });
}

function resolveIdfTableAmountPair(amounts) {
  const repaired = (amounts || []).map(repairIdfOcrAmount);
  const grossCandidates = repaired.filter(value => value >= 5000 && value <= 250000);
  if (!grossCandidates.length) {
    return null;
  }

  const gross = Math.max(...grossCandidates);
  const netCandidates = repaired.filter(
    value => value >= 500 && value <= 250000 && value < gross * 0.98,
  );
  if (!netCandidates.length) {
    return { gross };
  }

  return {
    gross,
    net: Math.max(...netCandidates),
  };
}

function extractIdfTableRowSalary(entries, store, pushCandidate) {
  for (let index = 0; index < entries.length; index += 1) {
    const raw = String(entries[index]?.raw || '');
    const normalized = normalizeIdfLine(raw);
    const hasGrossHeader = isIdfGrossLabelText(raw) || isIdfGrossLabelText(normalized);
    const hasNetHeader = isIdfNetHeaderText(raw) || isIdfNetHeaderText(normalized);
    const amounts = idfAmountsFromLine(raw).filter(
      value => value >= 500 && value <= 250000,
    );

    if (hasNetHeader && !hasGrossHeader) {
      const netAmount =
        amounts.length === 1 && amounts[0] >= 3000
          ? amounts[0]
          : pickIdfNetAmountFromTokens(amounts);
      if (Number.isFinite(netAmount)) {
        pushIdfNetCandidate(
          store,
          pushCandidate,
          netAmount,
          entries[index].index,
          'idf_salary_table_row',
          false,
        );
      }
      continue;
    }

    if (hasGrossHeader && !hasNetHeader && amounts.length === 1 && amounts[0] >= 5000) {
      pushIdfGrossCandidate(
        store,
        pushCandidate,
        amounts[0],
        entries[index].index,
        'idf_salary_table_row',
        false,
      );
      continue;
    }

    if (!hasGrossHeader || !hasNetHeader) {
      continue;
    }

    const inlinePair = resolveIdfTableAmountPair(amounts);
    if (inlinePair?.gross) {
      pushIdfGrossCandidate(
        store,
        pushCandidate,
        inlinePair.gross,
        entries[index].index,
        'idf_salary_table_row',
        false,
      );
      if (inlinePair.net) {
        pushIdfNetCandidate(
          store,
          pushCandidate,
          inlinePair.net,
          entries[index].index,
          'idf_salary_table_row',
          false,
        );
      }
      if (inlinePair.gross && inlinePair.net) {
        return;
      }
    }

    for (let offset = 1; offset <= 4; offset += 1) {
      const neighbor = entries[index + offset];
      if (!neighbor) {
        continue;
      }

      const pair = resolveIdfTableAmountPair(idfAmountsFromLine(neighbor.raw));
      if (!pair?.gross) {
        continue;
      }

      pushIdfGrossCandidate(
        store,
        pushCandidate,
        pair.gross,
        neighbor.index,
        'idf_salary_table_row',
        true,
      );
      if (pair.net) {
        pushIdfNetCandidate(
          store,
          pushCandidate,
          pair.net,
          neighbor.index,
          'idf_salary_table_row',
          true,
        );
      }
      if (pair.gross && pair.net) {
        return;
      }
    }
  }
}

function extractIdfGrossFromLabelWindow(entries, store, pushCandidate) {
  const labelIndex = findIdfGrossLabelIndex(entries);
  if (labelIndex < 0) {
    return;
  }

  const grossColumn = IDF_SALARY_COLUMNS.find(column => column.field === 'gross_total');
  const labelEntry = entries[labelIndex];
  const inline = pickIdfColumnAmount(labelEntry, entries, grossColumn);
  if (inline) {
    pushIdfGrossCandidate(
      store,
      pushCandidate,
      inline.amount,
      inline.lineIndex,
      'idf_gross_window',
      inline.adjacent,
    );
    return;
  }

  for (let offset = 0; offset <= 5; offset += 1) {
    for (const sign of [1, -1]) {
      const neighbor = entries[labelIndex + sign * offset];
      if (!neighbor || neighborMatchesExcludedColumn(neighbor.raw, ['net_payable'])) {
        continue;
      }
      if (isLeaveBalanceNoiseLine(neighbor.raw)) {
        continue;
      }
      if (findIdfSalaryColumnForLine(neighbor.raw)?.field === 'net_payable') {
        continue;
      }

      const amounts = idfAmountsFromLine(neighbor.raw).filter(
        value => value >= 5000 && value <= 250000 && !isCalendarYearAmount(value),
      );
      if (amounts.length === 1) {
        pushIdfGrossCandidate(
          store,
          pushCandidate,
          amounts[0],
          neighbor.index,
          'idf_gross_window',
          offset > 0,
        );
        return;
      }
      if (amounts.length > 1 && isIdfGrossLabelText(neighbor.raw)) {
        // Prefer the amount sitting on the gross total line itself
        pushIdfGrossCandidate(
          store,
          pushCandidate,
          Math.max(...amounts),
          neighbor.index,
          'idf_gross_window',
          offset > 0,
        );
        return;
      }
    }
  }
}

function isAmountOnlyNeighbor(raw) {
  const text = normalizeIdfLine(raw);
  if (!text || !/\d/.test(text)) {
    return false;
  }
  const withoutNumbers = text.replace(/[\d,.\s₪%-]/g, '').trim();
  return withoutNumbers.length <= 2;
}

function neighborMatchesExcludedColumn(raw, excludedFields = []) {
  if (!excludedFields.length) {
    return false;
  }

  const salaryHit = findIdfSalaryColumnForLine(raw);
  if (salaryHit && excludedFields.includes(salaryHit.field)) {
    return true;
  }

  const contributionHit = findIdfColumnForLine(raw);
  if (contributionHit && excludedFields.includes(contributionHit.field)) {
    return true;
  }

  return false;
}

function findIdfColumnLabelEnd(raw, column) {
  if (!raw || !column) {
    return -1;
  }

  for (const pattern of column.labelPatterns || []) {
    const match = String(raw).match(pattern);
    if (match && match.index !== undefined) {
      return match.index + match[0].length;
    }
  }

  for (const marker of column.rawMarkers || []) {
    const idx = String(raw).indexOf(marker);
    if (idx >= 0) {
      return idx + marker.length;
    }
  }

  return -1;
}

function pickIdfContributionColumnAmount(amounts, role) {
  const substantial = amounts.filter(value => value >= 50);
  if (!substantial.length) {
    return amounts[amounts.length - 1];
  }

  // Employee lines may carry prior-month amounts; current month is usually last.
  if (role === 'employee') {
    return substantial[substantial.length - 1];
  }

  // Participation/employer lines often have a glued pay-period suffix (e.g. 3176.4101.06.26).
  return substantial[0];
}

function pickIdfColumnAmount(entry, entries, column) {
  const { min, max } = column.amountRange;
  const isContributionColumn = column.fund === 'pension' || column.fund === 'study';
  const excludedNeighborFields =
    column.field === 'gross_total'
      ? ['net_payable']
      : column.field === 'net_payable'
        ? ['gross_total']
        : [];

  const labelEnd = isContributionColumn ? findIdfColumnLabelEnd(entry.raw, column) : -1;
  const ownSource = labelEnd >= 0 ? entry.raw.slice(labelEnd) : entry.raw;
  const ownNums = idfAmountsFromLine(ownSource).filter(value => value >= min && value <= max);
  if (ownNums.length === 1) {
    return { amount: ownNums[0], lineIndex: entry.index, adjacent: false };
  }
  if (ownNums.length > 1) {
    const amount = isContributionColumn
      ? pickIdfContributionColumnAmount(ownNums, column.role)
      : Math.max(...ownNums);
    return { amount, lineIndex: entry.index, adjacent: false };
  }

  for (let offset = 1; offset <= 5; offset += 1) {
    for (const sign of [1, -1]) {
      const neighborIndex = entry.index + sign * offset;
      const neighbor = entries[neighborIndex];
      if (!neighbor) {
        continue;
      }
      if (isLeaveBalanceNoiseLine(neighbor.raw)) {
        continue;
      }
      if (neighborMatchesExcludedColumn(neighbor.raw, excludedNeighborFields)) {
        continue;
      }
      if (findIdfSalaryColumnForLine(neighbor.raw) || findIdfColumnForLine(neighbor.raw)) {
        continue;
      }

      const neighborMin = isAmountOnlyNeighbor(neighbor.raw) ? 1 : min;
      const neighborNums = idfAmountsFromLine(neighbor.raw).filter(
        value => value >= neighborMin && value <= max && !isCalendarYearAmount(value),
      );
      if (neighborNums.length === 1) {
        return { amount: neighborNums[0], lineIndex: neighbor.index, adjacent: true };
      }
    }
  }

  return null;
}

function pushIdfSalaryCandidate(store, pushCandidate, column, resolved) {
  const { amount, lineIndex, adjacent } = resolved;
  pushCandidate(store, column.field, amount, {
    source: adjacent ? 'idf_salary_column_adjacent' : 'idf_salary_column',
    lineIndex,
    score: adjacent ? 0.97 : 0.99,
    reason: `תלוש צה"ל — ${column.descriptionHe}`,
    section: column.field === 'gross_total' ? 'earnings' : 'summary',
    evidenceCategory: 'idf_column',
  });
}

function extractIdfSalaryColumns(entries, store, pushCandidate) {
  extractIdfTableRowSalary(entries, store, pushCandidate);
  extractIdfGrossFromLabelWindow(entries, store, pushCandidate);

  entries.forEach(entry => {
    const column = findIdfSalaryColumnForLine(entry.raw);
    if (!column) {
      return;
    }

    const resolved = pickIdfColumnAmount(entry, entries, column);
    if (!resolved) {
      return;
    }

    pushIdfSalaryCandidate(store, pushCandidate, column, resolved);
  });
}

function extractIdfSalaryFromFullText(fullText, store, pushCandidate) {
  if (!fullText) {
    return;
  }

  let grossFound = false;
  for (const pattern of IDF_GROSS_TEXT_REGEXES) {
    const grossMatch = fullText.match(pattern);
    if (!grossMatch) {
      continue;
    }
    const gross = parseIdfMoney(grossMatch[1]);
    if (
      Number.isFinite(gross) &&
      gross >= 5000 &&
      gross <= 250000 &&
      !isLikelyLeaveBalanceAmount(gross)
    ) {
      pushCandidate(store, 'gross_total', gross, {
        source: 'idf_salary_text_regex',
        lineIndex: null,
        score: 0.98,
        reason: 'תלוש צה"ל — סה"כ תשלומים שוטפים (regex)',
        section: 'earnings',
        evidenceCategory: 'idf_column',
      });
      grossFound = true;
      break;
    }
  }

  if (!grossFound) {
    extractIdfGrossLooseFromFullText(fullText, store, pushCandidate);
  }

  let netFound = false;
  for (const pattern of IDF_NET_TEXT_REGEXES) {
    const netMatch = fullText.match(pattern);
    if (!netMatch) continue;
    const net = repairIdfGluedNetAmount(netMatch[1]);
    if (Number.isFinite(net) && net >= 3000 && net <= 250000 && !isCalendarYearAmount(net)) {
      pushCandidate(store, 'net_payable', net, {
        source: 'idf_salary_text_regex',
        lineIndex: null,
        score: 0.98,
        reason: 'תלוש צה"ל — שכר חודשי נטו (regex)',
        section: 'summary',
        evidenceCategory: 'idf_column',
      });
      netFound = true;
      break;
    }
  }

  let deductionsTotal;
  for (const pattern of IDF_DEDUCTIONS_TEXT_REGEXES) {
    const match = fullText.match(pattern);
    if (!match) continue;
    const amount = parseIdfMoney(match[1]);
    // OCR often emits "שוטפים0" / "שוטפים20" when the real deductions are missing.
    if (!Number.isFinite(amount) || amount < 200 || amount > 100000) {
      continue;
    }
    const knownGross = (store.gross_total || []).some(
      candidate => Math.abs(candidate.value - amount) < 0.05,
    );
    if (knownGross) {
      continue;
    }
    deductionsTotal = amount;
    pushCandidate(store, 'mandatory_total', amount, {
      source: 'idf_deductions_text_regex',
      lineIndex: null,
      score: 0.9,
      reason: 'תלוש צה"ל — סה"כ ניכויים שוטפים (regex)',
      section: 'deductions',
      evidenceCategory: 'idf_column',
    });
    break;
  }

  if (!netFound) {
    const gross = (store.gross_total || []).sort((a, b) => b.score - a.score)[0]?.value;
    if (Number.isFinite(gross) && Number.isFinite(deductionsTotal)) {
      const derived = Number((gross - deductionsTotal).toFixed(2));
      if (derived >= 500 && derived < gross * 0.98) {
        pushCandidate(store, 'net_payable', derived, {
          source: 'idf_derived_gross_minus_deductions',
          lineIndex: null,
          score: 0.92,
          reason: 'תלוש צה"ל — נטו מחושב: תשלומים שוטפים − ניכויים שוטפים',
          section: 'summary',
          evidenceCategory: 'idf_column',
        });
        netFound = true;
      }
    }
  }

  // When OCR drops the gross decimal (21653250) or picks a wrong nearby amount,
  // recover gross from net + current deductions — exact on IDF Mofet slips.
  // Never derive when deductions equal a labeled gross candidate (dual-column OCR trap).
  if (Number.isFinite(deductionsTotal)) {
    const bestNet = (store.net_payable || []).sort((a, b) => b.score - a.score)[0]?.value;
    const bestGross = (store.gross_total || [])
      .filter(candidate => !String(candidate.source || '').includes('derived'))
      .sort((a, b) => b.score - a.score)[0]?.value;
    const deductionsLooksLikeGross =
      Number.isFinite(bestGross) && Math.abs(bestGross - deductionsTotal) < 0.05;
    if (Number.isFinite(bestNet) && !deductionsLooksLikeGross) {
      const derivedGross = Number((bestNet + deductionsTotal).toFixed(2));
      if (
        derivedGross >= 5000 &&
        derivedGross <= 250000 &&
        !isLikelyLeaveBalanceAmount(derivedGross)
      ) {
        const closeEnough =
          Number.isFinite(bestGross) &&
          Math.abs(bestGross - derivedGross) <= Math.max(5, derivedGross * 0.01);
        if (!closeEnough) {
          pushCandidate(store, 'gross_total', derivedGross, {
            source: 'idf_derived_net_plus_deductions',
            lineIndex: null,
            score: 0.97,
            reason: 'תלוש צה"ל — ברוטו מחושב: נטו + ניכויים שוטפים',
            section: 'earnings',
            evidenceCategory: 'idf_column',
          });
        }
      }
    }
  }
}

function extractIdfGrossLooseFromFullText(fullText, store, pushCandidate) {
  const lines = String(fullText).split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (!isIdfGrossLabelText(lines[index])) {
      continue;
    }
    for (let offset = 0; offset <= 3; offset += 1) {
      for (const sign of [0, 1, -1]) {
        const line = lines[index + sign * offset];
        if (!line || isLeaveBalanceNoiseLine(line)) {
          continue;
        }
        const amounts = idfAmountsFromLine(line).filter(
          value => value >= 5000 && value <= 250000 && !isCalendarYearAmount(value),
        );
        if (amounts.length === 1) {
          pushIdfGrossCandidate(
            store,
            pushCandidate,
            amounts[0],
            index + sign * offset,
            'idf_gross_text_window',
            offset > 0,
          );
          return;
        }
        if (amounts.length > 1 && isIdfGrossLabelText(line)) {
          pushIdfGrossCandidate(
            store,
            pushCandidate,
            Math.max(...amounts),
            index + sign * offset,
            'idf_gross_text_window',
            offset > 0,
          );
          return;
        }
      }
    }
  }
}

function prioritizeIdfSalaryCandidates(store) {
  for (const field of ['gross_total', 'net_payable']) {
    const candidates = store[field];
    if (!Array.isArray(candidates) || !candidates.length) {
      continue;
    }

    const idfCandidates = candidates.filter(candidate =>
      String(candidate.source || '').startsWith('idf_'),
    );
    if (idfCandidates.length > 0) {
      for (const candidate of idfCandidates) {
        const source = String(candidate.source || '');
        if (source.includes('text_regex')) {
          candidate.score = Math.min(1, (candidate.score || 0) + 0.04);
        } else if (source.includes('window') || source.includes('adjacent')) {
          candidate.score = Math.max(0.01, (candidate.score || 0) - 0.08);
        }
      }
      store[field] = idfCandidates.sort((a, b) => b.score - a.score);
    }
  }

  const bestGross = (store.gross_total || [])
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0))[0]?.value;

  // Drop dual-column misreads where סה״כ תשלומים was collected as ניכויים,
  // and OCR zeros like "שוטפים0".
  if (Array.isArray(store.mandatory_total) && store.mandatory_total.length) {
    store.mandatory_total = store.mandatory_total.filter(candidate => {
      if (!Number.isFinite(candidate?.value) || candidate.value < 200) {
        return false;
      }
      if (Number.isFinite(bestGross) && Math.abs(candidate.value - bestGross) < 0.05) {
        return false;
      }
      if (Number.isFinite(bestGross) && candidate.value >= bestGross * 0.95) {
        return false;
      }
      return true;
    });
  }

  const deductionsTotal = (store.mandatory_total || [])
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0))[0]?.value;
  const bestNet = (store.net_payable || [])
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0))[0]?.value;
  if (
    Number.isFinite(deductionsTotal) &&
    Number.isFinite(bestNet) &&
    Array.isArray(store.gross_total) &&
    store.gross_total.length
  ) {
    const expectedGross = Number((bestNet + deductionsTotal).toFixed(2));
    for (const candidate of store.gross_total) {
      const delta = Math.abs(candidate.value - expectedGross);
      if (delta <= Math.max(5, expectedGross * 0.01)) {
        candidate.score = Math.min(1, (candidate.score || 0) + 0.15);
      } else {
        candidate.score = Math.max(0.01, (candidate.score || 0) - 0.25);
      }
    }
    store.gross_total = store.gross_total.slice().sort((a, b) => {
      if ((b.score || 0) !== (a.score || 0)) {
        return (b.score || 0) - (a.score || 0);
      }
      const aDerived = String(a.source || '').includes('derived') ? 1 : 0;
      const bDerived = String(b.source || '').includes('derived') ? 1 : 0;
      return bDerived - aDerived;
    });
  }

  const grossCandidates = store.gross_total || [];
  const netCandidates = store.net_payable || [];
  const gross = grossCandidates[0]?.value;
  const net = netCandidates[0]?.value;
  if (Number.isFinite(gross) && Number.isFinite(net) && Math.abs(gross - net) < 0.01) {
    const alternateNet = netCandidates.filter(
      candidate => !String(candidate.source || '').includes('gross'),
    );
    if (alternateNet.length) {
      store.net_payable = alternateNet;
    }
  }
}

function countIdfContributionColumns(entries) {
  let matched = 0;
  for (const entry of entries) {
    const raw = entry?.raw || entry;
    if (!raw) {
      continue;
    }
    if (IDF_CONTRIBUTION_COLUMNS.some(column => lineMatchesIdfColumn(raw, column))) {
      matched += 1;
    }
  }
  return matched;
}

function hasIdfEmployerMarker(entries) {
  for (let index = 0; index < entries.length; index += 1) {
    const raw = String(entries[index]?.raw || entries[index] || '');
    if (IDF_EMPLOYER_MARKERS.some(pattern => pattern.test(raw))) {
      return true;
    }
  }
  return false;
}

function hasIdfUnderscoreMarkers(entries) {
  return entries.some(entry => {
    const raw = String(entry?.raw || entry || '');
    return raw.includes('_') && IDF_COLUMN_MARKER_REGEX.test(raw);
  });
}

function detectIdfPayslip(entries, fullText = '') {
  if (!Array.isArray(entries) || !entries.length) {
    return false;
  }

  if (hasIdfEmployerMarker(entries)) {
    return true;
  }

  if (fullText && IDF_EMPLOYER_MARKERS.some(pattern => pattern.test(fullText))) {
    return true;
  }

  if (hasIdfUnderscoreMarkers(entries)) {
    const columnHits = countIdfContributionColumns(entries);
    const salaryHits = entries.filter(entry =>
      findIdfSalaryColumnForLine(entry?.raw || entry),
    ).length;
    return columnHits >= 1 || salaryHits >= 1;
  }

  if (isIdfGrossLabelText(fullText)) {
    return true;
  }

  return entries.some(entry => isIdfGrossLabelText(entry?.raw || entry));
}

function findIdfColumnForLine(raw) {
  return IDF_CONTRIBUTION_COLUMNS.find(column => lineMatchesIdfColumn(raw, column)) || null;
}

function findIdfSalaryColumnForLine(raw) {
  return IDF_SALARY_COLUMNS.find(column => lineMatchesIdfColumn(raw, column)) || null;
}

module.exports = {
  IDF_CONTRIBUTION_COLUMNS,
  IDF_SALARY_COLUMNS,
  detectIdfPayslip,
  extractIdfSalaryColumns,
  extractIdfSalaryFromFullText,
  findIdfColumnForLine,
  lineMatchesIdfColumn,
  pickIdfColumnAmount,
  prioritizeIdfSalaryCandidates,
  repairIdfOcrAmount,
};
