#!/usr/bin/env node
/**
 * Build FinGuide Final Project Book PDF from Markdown.
 * Uses puppeteer-core + system Chrome (no Chromium download).
 *
 * Usage: npm run build:pdf
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MD_FILE = path.join(ROOT, 'FinGuide_Final_Project_Book.md');
const CSS_FILE = path.join(ROOT, 'project-book.css');
const HTML_FILE = path.join(ROOT, 'FinGuide_Final_Project_Book.html');
const PDF_FILE = path.join(ROOT, 'FinGuide_Final_Project_Book.pdf');

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];

function findChrome() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('No Chrome/Chromium/Edge found. Install Google Chrome or set CHROME_PATH.');
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function processInlineMarkdown(text) {
  let out = text;
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    const safeAlt = escapeHtml(alt);
    const safeSrc = escapeHtml(src);
    return `%%IMG:${safeAlt}::${safeSrc}%%`;
  });
  out = out.replace(/\[([^\]]+)\]\(#([^)]+)\)/g, '<a href="#$2" class="toc-link">$1</a>');
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return out;
}

function expandImagePlaceholders(html) {
  return html.replace(/%%IMG:([^:]*?)::([^%]+?)%%/g, (_, alt, src) => {
    const caption = alt.trim();
    const imgPath = path.join(ROOT, src);
    if (!fs.existsSync(imgPath)) {
      console.warn(`Warning: missing figure ${src}`);
      return `<figure class="book-figure missing"><p class="figure-missing">[Figure asset not found: ${escapeHtml(src)}]</p></figure>`;
    }
    const fileUrl = `file://${imgPath}`;
    const figNum = caption.match(/Figure\s+(\d+)/i);
    const idAttr = figNum ? ` id="figure-${figNum[1]}"` : '';
    return `<figure class="book-figure"${idAttr}><img src="${fileUrl}" alt="${caption}" /><figcaption>${caption}</figcaption></figure>`;
  });
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function convertTables(text) {
  const lines = text.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('|') && line.includes('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      out.push(buildTable(tableLines));
    } else {
      out.push(line);
      i++;
    }
  }
  return out.join('\n');
}

function buildTable(lines) {
  const rows = lines
    .filter((l) => !/^\|[\s\-:|]+\|$/.test(l.trim()))
    .map((l) =>
      l
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim())
    );

  if (rows.length === 0) return '';

  const [header, ...body] = rows;
  let html = '<table><thead><tr>';
  header.forEach((c) => {
    html += `<th>${c}</th>`;
  });
  html += '</tr></thead><tbody>';
  body.forEach((row) => {
    html += '<tr>';
    row.forEach((c) => {
      html += `<td>${c}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function convertLists(text) {
  const lines = text.split('\n');
  const out = [];
  const stack = [];

  function closeAll() {
    while (stack.length) {
      out.push(stack.pop() === 'ol' ? '</ol>' : '</ul>');
    }
  }

  for (const line of lines) {
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    const ulMatch = line.match(/^(\s*)[-*]\s+(.+)$/);

    if (olMatch || ulMatch) {
      const indent = (olMatch || ulMatch)[1].length;
      const content = (olMatch || ulMatch)[2];
      const type = olMatch ? 'ol' : 'ul';
      const level = Math.floor(indent / 2) + 1;

      while (stack.length < level) {
        const openTag =
          type === 'ul' && stack.length === level - 1
            ? '<ul class="toc-list">'
            : `<${type}>`;
        out.push(openTag);
        stack.push(type);
      }
      while (stack.length > level) {
        out.push(stack.pop() === 'ol' ? '</ol>' : '</ul>');
      }

      out.push(`<li>${processInlineMarkdown(content)}</li>`);
    } else {
      closeAll();
      out.push(line);
    }
  }

  closeAll();
  return out.join('\n');
}

function markdownToHtml(md) {
  let html = md;

  const codeBlocks = [];
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
    return `%%CODEBLOCK_${idx}%%`;
  });

  html = html.replace(/`([^`\n]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);
  html = html.replace(/^---\s*$/gm, '<hr class="section-break" />');
  html = html.replace(/^#### (.+)$/gm, (_, title) => `<h4 id="${slugify(title)}">${title}</h4>`);
  html = html.replace(/^### (.+)$/gm, (_, title) => `<h3 id="${slugify(title)}">${title}</h3>`);
  html = html.replace(/^## (.+)$/gm, (_, title) => `<h2 id="${slugify(title)}">${title}</h2>`);
  html = html.replace(/^# (.+)$/gm, (_, title) => `<h1 class="book-title" id="${slugify(title)}">${title}</h1>`);

  // Images must be processed before bold/italic in paragraph lines
  html = html
    .split('\n')
    .map((line) => {
      if (/!\[[^\]]*\]\([^)]+\)/.test(line)) {
        return processInlineMarkdown(line.trim());
      }
      return line;
    })
    .join('\n');
  html = convertTables(html);
  html = convertLists(html);

  // Expand images before paragraph wrapping to avoid <p><figure> nesting
  html = expandImagePlaceholders(html);

  html = html
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (/^<[a-z/!]/.test(trimmed) || trimmed.startsWith('%%CODEBLOCK_')) return trimmed;
      if (trimmed.startsWith('|')) return trimmed;
      return `<p>${processInlineMarkdown(trimmed)}</p>`;
    })
    .join('\n');

  codeBlocks.forEach((block, idx) => {
    html = html.replace(`%%CODEBLOCK_${idx}%%`, block);
  });

  return html;
}

function buildHtmlDocument(body, css) {
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FinGuide Final Project Book</title>
  <style>${css}</style>
</head>
<body class="project-book">
${body}
</body>
</html>`;
}

async function printPdf(htmlPath, pdfPath, chromePath) {
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      tagged: true,
      margin: { top: '2.5cm', right: '2.5cm', bottom: '3cm', left: '2.5cm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="width:100%;font-size:9pt;text-align:center;color:#444;font-family:'Times New Roman',serif;padding-top:4px;">
          <span class="pageNumber"></span>
        </div>`,
    });
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('Reading markdown…');
  const md = fs.readFileSync(MD_FILE, 'utf8');
  const css = fs.readFileSync(CSS_FILE, 'utf8');

  console.log('Converting to HTML…');
  const body = markdownToHtml(md);
  const html = buildHtmlDocument(body, css);
  fs.writeFileSync(HTML_FILE, html, 'utf8');
  console.log(`Wrote ${HTML_FILE}`);

  const chrome = process.env.CHROME_PATH || findChrome();
  console.log(`Using browser: ${chrome}`);
  console.log('Generating PDF…');
  await printPdf(HTML_FILE, PDF_FILE, chrome);

  const stats = fs.statSync(PDF_FILE);
  console.log(`Done: ${PDF_FILE}`);
  console.log(`Size: ${(stats.size / 1024).toFixed(0)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
