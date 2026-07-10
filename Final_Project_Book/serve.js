#!/usr/bin/env node
/**
 * Serve the project book on localhost for browser preview.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8765;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.pdf': 'application/pdf',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/FinGuide_Final_Project_Book.html';

  const filePath = path.join(ROOT, urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const htmlUrl = `http://127.0.0.1:${PORT}/FinGuide_Final_Project_Book.html`;
  const pdfUrl = `http://127.0.0.1:${PORT}/FinGuide_Final_Project_Book.pdf`;
  console.log(`Project book preview:`);
  console.log(`  HTML: ${htmlUrl}`);
  console.log(`  PDF:  ${pdfUrl}`);
  console.log('Press Ctrl+C to stop.');
});
