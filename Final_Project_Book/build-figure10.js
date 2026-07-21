#!/usr/bin/env node
/**
 * Generate Figure 10 — OCR evaluation chart PNG.
 * Usage: node build-figure10.js
 */

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'figures', 'fig10-ocr-results.png');
const SVG = path.join(__dirname, 'figures', 'fig10-ocr-results.svg');

const FIELD_DATA = [
  { field: 'period_month', accuracy: 57.1 },
  { field: 'gross_total', accuracy: 85.7 },
  { field: 'net_payable', accuracy: 42.9 },
  { field: 'employee_id', accuracy: 57.1 },
  { field: 'tax_credit_points', accuracy: 57.1 },
  { field: 'base_salary', accuracy: 0 },
  { field: 'mandatory_total', accuracy: 42.9 },
  { field: 'national_insurance', accuracy: 42.9 },
  { field: 'health_insurance', accuracy: 57.1 },
];

function buildSvg() {
  const w = 900;
  const h = 420;
  const margin = { top: 40, left: 180, right: 30, bottom: 40 };
  const barH = 28;
  const gap = 8;
  const maxBarW = w - margin.left - margin.right;

  let bars = '';
  FIELD_DATA.forEach((row, i) => {
    const y = margin.top + i * (barH + gap);
    const bw = (row.accuracy / 100) * maxBarW;
    const color = row.accuracy >= 90 ? '#2e7d32' : row.accuracy >= 70 ? '#f9a825' : '#c62828';
    bars += `<text x="${margin.left - 10}" y="${y + 18}" text-anchor="end" font-family="Times New Roman, serif" font-size="13">${row.field}</text>`;
    bars += `<rect x="${margin.left}" y="${y}" width="${bw}" height="${barH}" fill="${color}" stroke="#333" stroke-width="0.5"/>`;
    bars += `<text x="${margin.left + bw + 6}" y="${y + 18}" font-family="Times New Roman, serif" font-size="12">${row.accuracy.toFixed(1)}%</text>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="white"/>
  <text x="${w / 2}" y="24" text-anchor="middle" font-family="Times New Roman, serif" font-size="16" font-weight="bold">Field Extraction Accuracy (7 scored fixtures, July 2026)</text>
  <text x="${w / 2}" y="${h - 12}" text-anchor="middle" font-family="Times New Roman, serif" font-size="11">3 direct PDF-text fixtures + 4 OCR-fallback fixtures; 2 unscored IDF image fixtures excluded</text>
  ${bars}
</svg>`;
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(SVG, buildSvg(), 'utf8');

  const puppeteer = require('puppeteer-core');
  const chromePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  const chrome = chromePaths.find((p) => fs.existsSync(p));
  if (!chrome) throw new Error('Chrome not found for figure 10 export');

  const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 920, height: 440 });
    await page.goto(`file://${SVG}`, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: OUT, omitBackground: false });
    console.log(`Wrote ${OUT}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
