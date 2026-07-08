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
    descriptionHe: 'השתתפות בקרן הפנסיה — סך הכל נכנס לקרן',
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
      /ניכוי\s+ל\s*קרן\s+ה+שתלמ/i,
      /נכוי\s+ל\s*קרן\s+ה+שתלמ/i,
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
    descriptionHe: 'השתתפות בקרן ההשתלמות — סך הכל נכנס לקרן',
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

const IDF_GROSS_TEXT_REGEXES = [
  /סה[_\s"״'']*כ[_\s]*תשלומים[_\s]*שוטפים[^\d\n]{0,40}(\d[\d,.\s₪]+)/i,
  /(\d[\d,.\s₪]+)[^\d\n]{0,40}סה[_\s"״'']*כ[_\s]*תשלומים[_\s]*שוטפים/i,
  /תשלומים[_\s]*שוטפים[^\d\n]{0,40}(\d[\d,.\s₪]+)/i,
];

const IDF_NET_TEXT_REGEX =
  /שכר[_\s]*חודשי[_\s]*נטו[^\d\n]*(\d[\d,.\s₪]+)/i;

const normalizeIdfLine = normalizeHebrewLine;

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
  return IDF_NET_HEADER_REGEX.test(normalizeIdfLine(text)) || IDF_NET_HEADER_REGEX.test(String(text || ''));
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
  if (!Number.isFinite(amount) || amount < 5000 || amount > 250000) {
    return;
  }
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
  if (!Number.isFinite(amount) || amount < 500 || amount > 250000) {
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
  const grossCandidates = amounts.filter(value => value >= 5000 && value <= 250000);
  if (!grossCandidates.length) {
    return null;
  }

  const gross = Math.max(...grossCandidates);
  const netCandidates = amounts.filter(
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
    const amounts = extractAllNumericTokens(raw).filter(
      value => value >= 500 && value <= 250000,
    );

    if (hasNetHeader && !hasGrossHeader && amounts.length === 1) {
      pushIdfNetCandidate(
        store,
        pushCandidate,
        amounts[0],
        entries[index].index,
        'idf_salary_table_row',
        false,
      );
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

      const pair = resolveIdfTableAmountPair(extractAllNumericTokens(neighbor.raw));
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
      if (findIdfSalaryColumnForLine(neighbor.raw)?.field === 'net_payable') {
        continue;
      }

      const amounts = extractAllNumericTokens(neighbor.raw).filter(
        value => value >= 5000 && value <= 250000,
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
      if (amounts.length > 1) {
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

function pickIdfColumnAmount(entry, entries, column) {
  const { min, max } = column.amountRange;
  const excludedNeighborFields =
    column.field === 'gross_total'
      ? ['net_payable']
      : column.field === 'net_payable'
        ? ['gross_total']
        : [];

  const ownNums = extractAllNumericTokens(entry.raw).filter(value => value >= min && value <= max);
  if (ownNums.length === 1) {
    return { amount: ownNums[0], lineIndex: entry.index, adjacent: false };
  }
  if (ownNums.length > 1) {
    return { amount: Math.max(...ownNums), lineIndex: entry.index, adjacent: false };
  }

  for (let offset = 1; offset <= 5; offset += 1) {
    for (const sign of [1, -1]) {
      const neighborIndex = entry.index + sign * offset;
      const neighbor = entries[neighborIndex];
      if (!neighbor) {
        continue;
      }
      if (neighborMatchesExcludedColumn(neighbor.raw, excludedNeighborFields)) {
        continue;
      }
      if (findIdfSalaryColumnForLine(neighbor.raw) || findIdfColumnForLine(neighbor.raw)) {
        continue;
      }

      const neighborMin = isAmountOnlyNeighbor(neighbor.raw) ? 1 : min;
      const neighborNums = extractAllNumericTokens(neighbor.raw).filter(
        value => value >= neighborMin && value <= max,
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
    const gross = parseMoney(grossMatch[1]);
    if (Number.isFinite(gross) && gross >= 5000 && gross <= 250000) {
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

  const netMatch = fullText.match(IDF_NET_TEXT_REGEX);
  if (netMatch) {
    const net = parseMoney(netMatch[1]);
    if (Number.isFinite(net) && net >= 500 && net <= 250000) {
      pushCandidate(store, 'net_payable', net, {
        source: 'idf_salary_text_regex',
        lineIndex: null,
        score: 0.98,
        reason: 'תלוש צה"ל — שכר חודשי נטו (regex)',
        section: 'summary',
        evidenceCategory: 'idf_column',
      });
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
        if (!line) {
          continue;
        }
        const amounts = extractAllNumericTokens(line).filter(
          value => value >= 5000 && value <= 250000,
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
      store[field] = idfCandidates.sort((a, b) => b.score - a.score);
    }
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
};
