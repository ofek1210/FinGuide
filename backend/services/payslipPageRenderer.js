'use strict';

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const sharp = require('sharp');
const { PdfPasswordRequiredError, isPdfPasswordError } = require('../utils/pdfPassword');
const { VISION_DPI, VISION_MAX_IMAGE_WIDTH, VISION_DUAL_CROP } = require('../config/payslipExtractionConfig');

const execFileAsync = promisify(execFile);

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.ppm', '.pbm', '.pgm', '.tif', '.tiff']);

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function pdfToPageImages(pdfPath, outDir, { password, dpi = VISION_DPI } = {}) {
  const prefix = path.join(outDir, 'page');
  const passwordArgs = password ? ['-upw', password] : [];
  const pngArgs = [...passwordArgs, '-png', '-r', String(dpi), pdfPath, prefix];
  let pngSupported = true;

  try {
    await execFileAsync('pdftoppm', pngArgs);
  } catch (error) {
    if (isPdfPasswordError(error) && !password) {
      throw new PdfPasswordRequiredError();
    }
    const stderr = error.stderr ? String(error.stderr) : '';
    if (error.code === 'ENOENT') {
      const wrapped = new Error(
        'pdftoppm binary not found. Run the backend via Docker or install Poppler (pdftoppm).',
      );
      wrapped.cause = error;
      throw wrapped;
    }
    if (/Usage: pdftoppm/i.test(stderr)) {
      pngSupported = false;
      await execFileAsync('pdftoppm', [...passwordArgs, '-r', String(dpi), pdfPath, prefix]);
    } else {
      const wrapped = new Error('pdftoppm command failed while converting PDF to images.');
      wrapped.cause = error;
      throw wrapped;
    }
  }

  const files = await fs.readdir(outDir);
  const extension = pngSupported ? '.png' : '.ppm';
  return files
    .filter(file => file.startsWith('page-') && file.endsWith(extension))
    .map(file => path.join(outDir, file))
    .sort((a, b) => a.localeCompare(b));
}

async function prepareVisionImageBuffer(inputBuffer, { maxWidth = VISION_MAX_IMAGE_WIDTH } = {}) {
  const image = sharp(inputBuffer).rotate();
  const meta = await image.metadata();
  let pipeline = image.sharpen({ sigma: 1 }).normalize();
  if (meta.width && meta.width > maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }
  const full = await pipeline.png({ compressionLevel: 4 }).toBuffer();
  const fullMeta = await sharp(full).metadata();
  const width = fullMeta.width || maxWidth;
  const height = fullMeta.height || 0;

  if (!VISION_DUAL_CROP || height < 1200) {
    return {
      full,
      metadataCrop: null,
      paymentsCrop: null,
      width,
      height,
    };
  }

  const metadataHeight = Math.max(400, Math.floor(height * 0.44));
  const paymentsTop = Math.floor(height * 0.36);
  const paymentsHeight = Math.max(500, height - paymentsTop);

  const metadataCrop = await sharp(full)
    .extract({ left: 0, top: 0, width, height: metadataHeight })
    .png({ compressionLevel: 4 })
    .toBuffer();
  const paymentsCrop = await sharp(full)
    .extract({ left: 0, top: paymentsTop, width, height: paymentsHeight })
    .png({ compressionLevel: 4 })
    .toBuffer();

  return { full, metadataCrop, paymentsCrop, width, height };
}

async function compressImageBuffer(inputBuffer, options = {}) {
  const prepared = await prepareVisionImageBuffer(inputBuffer, options);
  return prepared.full;
}

/**
 * Render payslip file to one or more PNG page buffers ready for vision API.
 *
 * @returns {Promise<Array<{ buffer: Buffer, mimeType: string, sha256: string, pageIndex: number }>>}
 */
async function renderPayslipPages(inputPath, { password } = {}) {
  const abs = path.resolve(inputPath);
  const ext = path.extname(abs).toLowerCase();
  const pages = [];

  if (ext === '.pdf') {
    const workDir = path.join(process.cwd(), '.work', `vision_${crypto.randomUUID()}`);
    await fs.mkdir(workDir, { recursive: true });
    try {
      const imagePaths = await pdfToPageImages(abs, workDir, { password });
      for (let i = 0; i < imagePaths.length; i += 1) {
        const raw = await fs.readFile(imagePaths[i]);
        const prepared = await prepareVisionImageBuffer(raw);
        pages.push({
          buffer: prepared.full,
          metadataCrop: prepared.metadataCrop,
          paymentsCrop: prepared.paymentsCrop,
          mimeType: 'image/png',
          sha256: sha256Buffer(prepared.full),
          pageIndex: i,
        });
      }
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
    return pages;
  }

  if (!IMAGE_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported payslip file type for vision extraction: ${ext || '(none)'}`);
  }

  const raw = await fs.readFile(abs);
  const prepared = await prepareVisionImageBuffer(raw);
  return [{
    buffer: prepared.full,
    metadataCrop: prepared.metadataCrop,
    paymentsCrop: prepared.paymentsCrop,
    mimeType: 'image/png',
    sha256: sha256Buffer(prepared.full),
    pageIndex: 0,
  }];
}

module.exports = {
  renderPayslipPages,
  compressImageBuffer,
  prepareVisionImageBuffer,
  sha256Buffer,
};
