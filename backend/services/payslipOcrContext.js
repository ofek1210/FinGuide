const {
  extractOrderedAmountsFromLine,
  normalizeLine,
  splitHeaderCells,
} = require('./payslipOcrLabelMap');
const { extractAllNumericTokens } = require('./payslipOcrNumbers');
const { linesOf } = require('./payslipOcrShared');

const SECTION_PATTERNS = {
  identity: [
    /שם\s+עובד/i,
    /שם\s+העובד/i,
    /Employee\s+Name/i,
    /ת\.?\s*ז\.?/i,
    /תעודת\s+זהות/i,
    /מספר\s+זהות/i,
    /שם\s+מעסיק/i,
    /שם\s+מעביד/i,
    /Employer\s+Name/i,
  ],
  earnings: [
    /שכר\s*בסיס/i,
    /שכר\s*ברוטו/i,
    /סך[-\s]?כל\s*התשלומים/i,
    /סה["״']?כ\s*תשלומים/i,
    /Gross/i,
    /Base\s*Salary/i,
    /נסיעות/i,
    /החזר\s*הוצאות/i,
    /overtime/i,
  ],
  deductions: [
    /ניכויי\s*חובה/i,
    /סה["״']?כ\s*ניכו/i,
    /כל\s*הניכו/i,
    /מס\s*הכנסה/i,
    /ביטוח\s*לאומי/i,
    /ביטוח\s*בריאות/i,
    /מס\s*בריאות/i,
    /Total\s*Deductions/i,
  ],
  contributions: [
    /קרן\s*השתלמות/i,
    /שכר\s*לקרן\s*השתלמות/i,
    /שכר\s*לקצבה/i,
    /פנסי/i,
    /תגמול/i,
    /פיצוי/i,
    /הפרשת\s*מעסיק/i,
    /ניכוי\s*עובד/i,
  ],
  summary: [
    /סכום\s*בבנק/i,
    /נטו\s*לתשלום/i,
    /שכר\s*נטו/i,
    /לתשלום/i,
    /ימי\s*עבודה/i,
    /שעות\s*עבודה/i,
    /חופשה/i,
    /מחלה/i,
  ],
  tax_base: [
    /ברוטו\s*למס/i,
    /הכנסה\s*חייבת/i,
    /שכר\s*חייב\s*ב/i,
    /לב\.?\s*לאומי/i,
  ],
  cumulative: [
    /נתונים\s*מצטברים/i,
    /סה"כ\s*מצטבר/i,
    /cumulative/i,
    /חישוב\s*מצטבר/i,
  ],
};

function extractLineEntriesFromText(text) {
  return linesOf(text).map(raw => ({ text: raw }));
}

function readObjectPath(object, paths) {
  for (const path of paths) {
    let current = object;
    let valid = true;

    for (const segment of path) {
      if (current == null || !(segment in current)) {
        valid = false;
        break;
      }
      current = current[segment];
    }

    if (valid && current != null) {
      return current;
    }
  }

  return undefined;
}

function extractLineEntriesFromOcrJson(payload) {
  const source = payload?.ocrJson || payload;
  const lineEntries = [];

  const pages = readObjectPath(source, [
    ['pages'],
    ['document', 'pages'],
    ['result', 'pages'],
  ]);

  if (Array.isArray(pages)) {
    for (const page of pages) {
      const lines = readObjectPath(page, [['lines'], ['Blocks'], ['blocks']]) || [];
      for (const line of lines) {
        const text =
          readObjectPath(line, [['text'], ['Text'], ['content'], ['lineText']]) ||
          readObjectPath(line, [['words']])?.map(word => word.text || word.Text || word.content).filter(Boolean).join(' ');

        if (!text || !String(text).trim()) {
          continue;
        }

        lineEntries.push({
          text: String(text).trim(),
          confidence: readObjectPath(line, [['confidence'], ['Confidence'], ['score']]),
          bbox: readObjectPath(line, [['bbox'], ['boundingBox'], ['Geometry', 'BoundingBox']]),
          words: readObjectPath(line, [['words'], ['Words']]) || [],
          pageNumber: page.pageNumber || page.page || page.number,
        });
      }
    }
  }

  if (lineEntries.length > 0) {
    return lineEntries;
  }

  const topLevelLines = readObjectPath(source, [
    ['lines'],
    ['result', 'lines'],
    ['document', 'lines'],
  ]);

  if (Array.isArray(topLevelLines)) {
    return topLevelLines
      .map(line => ({
        text: String(
          readObjectPath(line, [['text'], ['Text'], ['content'], ['lineText']]) || '',
        ).trim(),
        confidence: readObjectPath(line, [['confidence'], ['Confidence'], ['score']]),
        bbox: readObjectPath(line, [['bbox'], ['boundingBox']]),
        words: readObjectPath(line, [['words'], ['Words']]) || [],
      }))
      .filter(line => line.text);
  }

  return [];
}

function buildSectionHints(raw, orderedAmounts, headerCells) {
  const hints = new Set();

  Object.entries(SECTION_PATTERNS).forEach(([section, patterns]) => {
    if (patterns.some(pattern => pattern.test(raw))) {
      hints.add(section);
    }
  });

  if (orderedAmounts.length >= 4) {
    hints.add('table_row');
  }

  if (headerCells.length >= 4 && orderedAmounts.length === 0) {
    hints.add('table_header');
  }

  if (hints.has('identity')) {
    return [...hints];
  }

  if (hints.has('contributions') && hints.has('deductions')) {
    hints.delete('deductions');
  }

  return [...hints];
}

function buildLogicalRows(lines) {
  const rows = [];

  const toLogicalRowSections = hints =>
    [...new Set((hints || []).filter(section => !['table_row', 'table_header'].includes(section)))];

  const pickPrimarySection = sections =>
    sections[0] || null;

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    const next = lines[index + 1];

    if (!current || !next) {
      continue;
    }

    if (current.headerCells.length >= 4 && next.orderedAmounts.length === current.headerCells.length) {
      const sections = toLogicalRowSections([...current.sectionHints, ...next.sectionHints]);
      rows.push({
        type: 'header_then_row',
        headerLineIndex: current.index,
        dataLineIndex: next.index,
        sections,
        section: pickPrimarySection(sections) || 'summary',
      });
    }

    if (current.orderedAmounts.length >= 4 && next.headerCells.length === current.orderedAmounts.length) {
      const sections = toLogicalRowSections([...current.sectionHints, ...next.sectionHints]);
      rows.push({
        type: 'row_then_header',
        headerLineIndex: next.index,
        dataLineIndex: current.index,
        sections,
        section: pickPrimarySection(sections) || 'earnings',
      });
    }
  }

  return rows;
}

function buildSections(lines) {
  const sections = {
    identity: [],
    earnings: [],
    deductions: [],
    contributions: [],
    summary: [],
    tax_base: [],
    cumulative: [],
    tableHeaders: [],
    tableRows: [],
  };

  lines.forEach(line => {
    if (line.sectionHints.includes('identity')) sections.identity.push(line.index);
    if (line.sectionHints.includes('earnings')) sections.earnings.push(line.index);
    if (line.sectionHints.includes('deductions')) sections.deductions.push(line.index);
    if (line.sectionHints.includes('contributions')) sections.contributions.push(line.index);
    if (line.sectionHints.includes('summary')) sections.summary.push(line.index);
    if (line.sectionHints.includes('tax_base')) sections.tax_base.push(line.index);
    if (line.sectionHints.includes('cumulative')) sections.cumulative.push(line.index);
    if (line.sectionHints.includes('table_header')) sections.tableHeaders.push(line.index);
    if (line.sectionHints.includes('table_row')) sections.tableRows.push(line.index);
  });

  return sections;
}

function normalizeLineEntries(lineEntries) {
  const entries = lineEntries.map((entry, index) => {
    const raw = String(entry.text || '').trim();
    const orderedAmounts = extractOrderedAmountsFromLine(raw);
    const headerCells = splitHeaderCells(raw).map(cell => ({
      raw: cell,
      normalized: normalizeLine(cell),
    }));
    const sectionHints = buildSectionHints(raw, orderedAmounts, headerCells);

    return {
      index,
      raw,
      normalized: normalizeLine(raw),
      amounts: extractAllNumericTokens(raw),
      orderedAmounts,
      headerCells,
      confidence: Number.isFinite(entry.confidence) ? entry.confidence : undefined,
      bbox: entry.bbox,
      words: Array.isArray(entry.words) ? entry.words : [],
      pageNumber: entry.pageNumber,
      sectionHints,
      primarySection:
        sectionHints.find(section => !['table_row', 'table_header'].includes(section)) || null,
    };
  });

  // Propagate cumulative context: lines after a cumulative header
  // inherit the 'cumulative' hint until a new structural section begins
  // (identity or earnings headers that clearly indicate a new document part).
  const CUMULATIVE_BREAK_PATTERNS = [
    /תאור\s*התשלום/i,
    /פרטים\s*אישיים/i,
    /שם\s+עובד/i,
    /תלוש\s*(?:שכר|משכורת)/i,
    /סה["״']?כ\s*תשלומים/i,
  ];
  let inCumulative = false;
  for (const entry of entries) {
    if (entry.sectionHints.includes('cumulative')) {
      inCumulative = true;
    } else if (
      inCumulative &&
      CUMULATIVE_BREAK_PATTERNS.some(p => p.test(entry.raw))
    ) {
      inCumulative = false;
    }

    if (inCumulative && !entry.sectionHints.includes('cumulative')) {
      entry.sectionHints.push('cumulative');
    }
  }

  return entries;
}

function normalizeSourceInput(source) {
  if (typeof source === 'string') {
    return {
      sourceType: 'plain_text',
      text: source,
      lineEntries: extractLineEntriesFromText(source),
    };
  }

  if (source && typeof source === 'object') {
    const text =
      source.text ||
      source.rawText ||
      source.ocr_text ||
      '';
    const ocrLineEntries = extractLineEntriesFromOcrJson(source);

    if (ocrLineEntries.length > 0) {
      return {
        sourceType: 'ocr_json',
        text: text || ocrLineEntries.map(line => line.text).join('\n'),
        lineEntries: ocrLineEntries,
      };
    }

    return {
      sourceType: 'plain_text',
      text,
      lineEntries: extractLineEntriesFromText(text),
    };
  }

  return {
    sourceType: 'plain_text',
    text: '',
    lineEntries: [],
  };
}

function buildNormalizedOcrDocumentFromSource(source) {
  const normalizedSource = normalizeSourceInput(source);
  const lines = normalizeLineEntries(normalizedSource.lineEntries);
  const fullText = lines.map(line => line.raw).join('\n');

  return {
    sourceType: normalizedSource.sourceType,
    rawText: normalizedSource.text,
    fullText,
    lines,
    sections: buildSections(lines),
    logicalRows: buildLogicalRows(lines),
    layoutAvailable: normalizedSource.sourceType === 'ocr_json',
  };
}

function buildNormalizedOcrDocument(text) {
  return buildNormalizedOcrDocumentFromSource(text);
}

module.exports = {
  buildNormalizedOcrDocument,
  buildNormalizedOcrDocumentFromSource,
};
