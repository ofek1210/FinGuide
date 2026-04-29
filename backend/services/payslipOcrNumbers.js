const { parseNumericInput, normalizeAmount } = require('../utils/numeric');

const DIRECT_NUMERIC_SEQUENCE_REGEX = /\d[\d.,]*/g;
const MERGED_DECIMAL_SEGMENT_REGEX = /\d[\d,]*(?:\.\d{1,2})?/g;

function parseOcrNumber(value) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).replace(/[₪]/g, '').trim();
  if (!normalized) {
    return undefined;
  }

  try {
    return normalizeAmount(parseNumericInput(normalized));
  } catch (error) {
    return undefined;
  }
}

function tokenizeNumericSequences(line) {
  return String(line).match(DIRECT_NUMERIC_SEQUENCE_REGEX) || [];
}

function extractAllNumericTokens(line) {
  const tokens = tokenizeNumericSequences(line);
  const values = [];

  for (const token of tokens) {
    const direct = parseOcrNumber(token);
    if (direct !== undefined) {
      values.push(direct);
      continue;
    }

    const mergedSegments = token.match(MERGED_DECIMAL_SEGMENT_REGEX) || [];
    if (mergedSegments.length <= 1) {
      continue;
    }

    for (const segment of mergedSegments) {
      const parsed = parseOcrNumber(segment);
      if (parsed !== undefined) {
        values.push(parsed);
      }
    }
  }

  return values;
}

function extractOrderedNumericTokens(line) {
  const raw = String(line).trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(/\s+/)
    .map(parseOcrNumber)
    .filter(value => value !== undefined);
}

function extractPercentTokens(line) {
  return extractAllNumericTokens(line).filter(value => value > 0 && value < 30);
}

module.exports = {
  parseOcrNumber,
  extractAllNumericTokens,
  extractOrderedNumericTokens,
  extractPercentTokens,
};
