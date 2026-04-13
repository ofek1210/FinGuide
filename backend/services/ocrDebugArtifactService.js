const fs = require('fs/promises');
const path = require('path');

const DEBUG_DIR = path.join(__dirname, '..', 'uploads', 'ocr-debug');

const shouldPersistOcrDebugArtifacts = () =>
  String(process.env.OCR_DEBUG_PERSIST || '').toLowerCase() === 'true';

const ensureDebugDir = async () => {
  await fs.mkdir(DEBUG_DIR, { recursive: true });
};

const persistOcrDebugArtifact = async ({ documentId, payload }) => {
  if (!shouldPersistOcrDebugArtifacts() || !documentId || !payload) {
    return null;
  }

  await ensureDebugDir();
  const filename = `${documentId}.json`;
  const targetPath = path.join(DEBUG_DIR, filename);
  await fs.writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8');
  return targetPath;
};

const removeOcrDebugArtifact = async targetPath => {
  if (!targetPath || typeof targetPath !== 'string') {
    return;
  }

  const relativePath = path.relative(DEBUG_DIR, targetPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return;
  }

  await fs.unlink(targetPath).catch(() => {});
};

module.exports = {
  DEBUG_DIR,
  persistOcrDebugArtifact,
  removeOcrDebugArtifact,
  shouldPersistOcrDebugArtifacts,
};
