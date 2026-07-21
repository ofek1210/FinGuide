'use strict';

const cmaConfig = require('../config/cmaReportsConfig');

function isExcelBuffer(buf) {
  if (!buf || buf.length < 4) return false;
  const head = buf.slice(0, 4);
  // OLE2 / BIFF (.xls) or ZIP (.xlsx)
  if (head[0] === 0xD0 && head[1] === 0xCF) return true;
  if (head[0] === 0x50 && head[1] === 0x4B) return true;
  return false;
}

/**
 * Attempt to download tsuotHodPtihaRDL.xls from CMA (Pensia-Net / Gemel-Net UI).
 * Returns null when the endpoint is down, blocked, or returns HTML instead of Excel.
 *
 * @param {'pensia'|'gemel'} net
 * @returns {Promise<{ buffer: Buffer, sourceUrl: string, contentType: string|null }|null>}
 */
async function downloadCmaCohortExcel(net) {
  if (!cmaConfig.enabled) return null;

  const url = net === 'gemel' ? cmaConfig.gemel.excelUrl : cmaConfig.pensia.excelUrl;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cmaConfig.fetchTimeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'application/vnd.ms-excel,application/octet-stream,*/*',
        'User-Agent': cmaConfig.userAgent,
      },
    });

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type');
    if (contentType && /text\/html/i.test(contentType)) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (!isExcelBuffer(buf)) return null;

    return { buffer: buf, sourceUrl: url, contentType };
  } catch (err) {
    console.warn(`[cmaDownload:${net}]`, err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { downloadCmaCohortExcel, isExcelBuffer };
