#!/usr/bin/env node
/**
 * Generate Figure 12 — Capability comparison chart PNG.
 * Usage: node build-figure12.js
 */

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'figures', 'fig12-comparison.png');
const SVG = path.join(__dirname, 'figures', 'fig12-comparison.svg');

const ROWS = [
  { label: 'Payslip parse', manual: 1, hilan: 2, bank: 0, finguide: 2 },
  { label: 'Compliance checks', manual: 1, hilan: 0, bank: 0, finguide: 2 },
  { label: 'Longitudinal view', manual: 0, hilan: 0, bank: 1, finguide: 2 },
  { label: 'Hebrew AI advisory', manual: 0, hilan: 0, bank: 0, finguide: 2 },
  { label: 'No banking API', manual: 2, hilan: 2, bank: 0, finguide: 2 },
];

const COLS = [
  { key: 'manual', title: 'Manual' },
  { key: 'hilan', title: 'Hilan/iCount' },
  { key: 'bank', title: 'Bank PFM' },
  { key: 'finguide', title: 'FinGuide' },
];

function cellColor(score) {
  if (score >= 2) return '#2e7d32';
  if (score === 1) return '#f9a825';
  return '#e0e0e0';
}

function buildSvg() {
  const cell = 70;
  const labelW = 160;
  const headerH = 50;
  const w = labelW + COLS.length * cell + 40;
  const h = headerH + ROWS.length * cell + 60;
  let body = '';

  COLS.forEach((col, ci) => {
    const x = labelW + ci * cell + 20;
    body += `<text x="${x + cell / 2}" y="32" text-anchor="middle" font-family="Times New Roman" font-size="12" font-weight="bold">${col.title}</text>`;
  });

  ROWS.forEach((row, ri) => {
    const y = headerH + ri * cell + 20;
    body += `<text x="${labelW + 10}" y="${y + cell / 2 + 4}" text-anchor="end" font-family="Times New Roman" font-size="12">${row.label}</text>`;
    COLS.forEach((col, ci) => {
      const x = labelW + ci * cell + 20;
      const score = row[col.key];
      body += `<rect x="${x}" y="${y}" width="${cell - 4}" height="${cell - 4}" fill="${cellColor(score)}" stroke="#333" stroke-width="0.5"/>`;
      body += `<text x="${x + (cell - 4) / 2}" y="${y + cell / 2}" text-anchor="middle" font-family="Times New Roman" font-size="11" fill="#111">${score >= 2 ? 'Yes' : score === 1 ? 'Partial' : 'No'}</text>`;
    });
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="white"/>
  <text x="${w / 2}" y="18" text-anchor="middle" font-family="Times New Roman" font-size="15" font-weight="bold">Capability Comparison (qualitative scale)</text>
  ${body}
  <text x="${w / 2}" y="${h - 8}" text-anchor="middle" font-family="Times New Roman" font-size="10">Yes = full support; Partial = manual/limited; No = not supported</text>
</svg>`;
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(SVG, buildSvg(), 'utf8');

  const puppeteer = require('puppeteer-core');
  const chromePaths = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean);
  const chrome = chromePaths.find((p) => fs.existsSync(p));
  if (!chrome) throw new Error('Chrome not found for figure 12 export');

  const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 520, height: 380 });
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
