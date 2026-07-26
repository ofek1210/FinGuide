'use strict';

const fs = require('fs');

/**
 * Parse CKAN-export CSV (quoted fields) → array of objects keyed by header.
 */
function parseGovCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (!cells.length) continue;
    const row = {};
    header.forEach((h, idx) => {
      row[h] = cells[idx] ?? '';
    });
    if (row.FUND_ID != null && row.FUND_ID !== '') rows.push(row);
  }

  return rows;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * Read a gov CSV file with Hebrew text. Local exports from data.gov.il are often Windows-1255.
 */
function readGovCsvFile(filePath) {
  const buf = fs.readFileSync(filePath);
  let text = buf.toString('utf8');
  if (text.includes('\uFFFD') || !/[\u0590-\u05FF]/.test(text.slice(0, 8000))) {
    try {
      const iconv = require('iconv-lite');
      text = iconv.decode(buf, 'win1255');
    } catch {
      // keep utf8 fallback
    }
  }
  return text;
}

module.exports = { parseGovCsv, parseCsvLine, readGovCsvFile };
