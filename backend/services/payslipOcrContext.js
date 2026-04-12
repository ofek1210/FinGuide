const {
  extractOrderedAmountsFromLine,
  normalizeLine,
  splitHeaderCells,
} = require('./payslipOcrLabelMap');
const { extractAllNumericTokens } = require('./payslipOcrNumbers');
const { linesOf } = require('./payslipOcrShared');

function buildNormalizedOcrDocument(text) {
  const rawLines = linesOf(text);

  return {
    rawText: text,
    fullText: rawLines.join('\n'),
    lines: rawLines.map((raw, index) => ({
      index,
      raw,
      normalized: normalizeLine(raw),
      amounts: extractAllNumericTokens(raw),
      orderedAmounts: extractOrderedAmountsFromLine(raw),
      headerCells: splitHeaderCells(raw).map(cell => ({
        raw: cell,
        normalized: normalizeLine(cell),
      })),
    })),
  };
}

module.exports = {
  buildNormalizedOcrDocument,
};
