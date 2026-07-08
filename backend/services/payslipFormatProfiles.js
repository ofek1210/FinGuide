/**
 * Payslip format profile registry.
 *
 * A "profile" bundles everything that is specific to a payslip layout
 * (detection + salary candidate collection + candidate prioritization).
 * The resolver stays format-agnostic and only talks to this registry —
 * to support a new payroll format, add a profile object here.
 *
 * Format quirks that are NOT profiles (handled generically):
 * - Michpal cumulative zone ("נתונים מצטברים") → isLikelyCumulativeZoneLine in payslipOcrShared.
 * - Malam bank-amount layout ("סכום בבנק") → bank backward-scan in payslipOcrResolver.
 * - Underscore labels / split "סה כ" → normalizeHebrewLine in payslipOcrShared.
 */

const {
  detectIdfPayslip,
  extractIdfSalaryColumns,
  extractIdfSalaryFromFullText,
  prioritizeIdfSalaryCandidates,
} = require('./idfPayslipProfile');

/**
 * @typedef {object} PayslipFormatProfile
 * @property {string} id
 * @property {string} nameHe
 * @property {(lines: Array, fullText: string) => boolean} detect
 * @property {(args: {lines: Array, monthlyText: string, store: object, pushCandidate: Function}) => void} collectSalaryCandidates
 *   Push high-confidence, format-specific salary candidates into the store.
 * @property {(store: object) => void} prioritizeSalaryCandidates
 *   Runs after all generic collectors — lets the profile override weaker generic candidates.
 */

/** @type {PayslipFormatProfile[]} */
const PAYSLIP_FORMAT_PROFILES = [
  {
    id: 'idf',
    nameHe: 'תלוש צה"ל / משרד הביטחון',
    detect: detectIdfPayslip,
    collectSalaryCandidates({ lines, monthlyText, store, pushCandidate }) {
      extractIdfSalaryColumns(lines, store, pushCandidate);
      extractIdfSalaryFromFullText(monthlyText, store, pushCandidate);
    },
    prioritizeSalaryCandidates: prioritizeIdfSalaryCandidates,
  },
];

/**
 * @param {Array} lines - Normalized document line entries ({ raw, index, ... })
 * @param {string} fullText
 * @returns {PayslipFormatProfile|null} The first matching profile, or null for generic payslips.
 */
function detectPayslipFormatProfile(lines, fullText = '') {
  return PAYSLIP_FORMAT_PROFILES.find(profile => profile.detect(lines, fullText)) || null;
}

module.exports = {
  PAYSLIP_FORMAT_PROFILES,
  detectPayslipFormatProfile,
};
