/**
 * Vercel Function: browser -> /api/gas -> Google Apps Script
 * Required environment variable: APPS_SCRIPT_URL
 */
const ALLOWED_ACTIONS = new Set([
  'getStore', 'login', 'getAdminDashboard', 'logout', 'changePassword', 'uploadImage',
  'saveCategory', 'deleteCategory', 'saveButton', 'deleteButton', 'saveProduct',
  'deleteProduct', 'togglePopular', 'saveBanner', 'deleteBanner', 'deleteBatch',
  'saveSettings', 'savePopup'
]);

const MAX_BODY_CHARS = 1_500_000;

function sendJson(res, status, data) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { success: false, message: 'Metode tidak diizinkan.' });
  }

  const upstreamUrl = process.env.APPS_SCRIPT_URL;
  const proxySecret = process.env.GAS_PROXY_SECRET;
  if (!upstreamUrl || !proxySecret || proxySecret.length < 32) {
    return sendJson(res, 500, { success: false, message: 'Konfigurasi server belum lengkap.' });
  }

  // Pastikan environment variable hanya menunjuk ke endpoint Web App Apps Script.
  let parsedUrl;
  try {
    parsedUrl = new URL(upstreamUrl);
  } catch {
    return sendJson(res, 500, { success: false, message: 'Konfigurasi server tidak valid.' });
  }
  if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'script.google.com' || !/^\/macros\/s\/[^/]+\/exec\/?$/.test(parsedUrl.pathname)) {
    return sendJson(res, 500, { success: false, message: 'URL Apps Script tidak sesuai format.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch {
      return sendJson(res, 400, { success: false, message: 'Format permintaan tidak valid.' });
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return sendJson(res, 400, { success: false, message: 'Isi permintaan tidak valid.' });
  }

  const serialized = JSON.stringify(body);
  if (serialized.length > MAX_BODY_CHARS) {
    return sendJson(res, 413, { success: false, message: 'Ukuran permintaan terlalu besar.' });
  }
  if (!ALLOWED_ACTIONS.has(body.action)) {
    return sendJson(res, 400, { success: false, message: 'Aksi tidak diizinkan.' });
  }

  try {
    // Proxy secret ditambahkan hanya di server; nilai kiriman browser selalu ditimpa.
    const secureBody = JSON.stringify({ ...body, proxyKey: proxySecret });
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: secureBody,
      redirect: 'follow'
    });
    const responseText = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(responseText);
  } catch {
    return sendJson(res, 502, { success: false, message: 'Apps Script tidak dapat dihubungi.' });
  }
};
