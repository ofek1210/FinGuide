#!/usr/bin/env node
/**
 * Render Mermaid sources in figures/src/*.mmd to PNG in figures/.
 * Usage: npm run build:figures
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const SRC_DIR = path.join(ROOT, 'figures', 'src');
const OUT_DIR = path.join(ROOT, 'figures');
const WIDTH = 1200;
const CONFIG = path.join(ROOT, 'figures', 'mermaid.config.json');

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`Missing ${SRC_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const mmdc = path.join(ROOT, 'node_modules', '.bin', 'mmdc');
  if (!fs.existsSync(mmdc)) {
    console.error('Run npm install in Final_Project_Book first.');
    process.exit(1);
  }

  const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.mmd')).sort();
  if (files.length === 0) {
    console.log('No .mmd files found.');
    return;
  }

  const puppeteerConfig = path.join(ROOT, 'figures', 'puppeteer.config.json');
  const chromePath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (chromePath && fs.existsSync(puppeteerConfig)) {
    const cfg = JSON.parse(fs.readFileSync(puppeteerConfig, 'utf8'));
    cfg.executablePath = chromePath;
    fs.writeFileSync(puppeteerConfig, JSON.stringify(cfg, null, 2));
  }

  for (const file of files) {
    const input = path.join(SRC_DIR, file);
    const base = file.replace(/\.mmd$/, '.png');
    const output = path.join(OUT_DIR, base);
    const args = ['-i', input, '-o', output, '-w', String(WIDTH), '-b', 'white'];
    if (fs.existsSync(CONFIG)) args.push('-c', CONFIG);
    if (fs.existsSync(puppeteerConfig)) args.push('-p', puppeteerConfig);

    console.log(`Rendering ${file} → figures/${base}`);
    execFileSync(mmdc, args, { stdio: 'inherit' });
  }

  console.log(`Done. ${files.length} figure(s) rendered.`);
}

main();
