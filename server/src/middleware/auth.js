const crypto = require('crypto');

const COOKIE_NAME = 'mc_admin';
const MAX_AGE_MS = 1000 * 60 * 60 * 12; // 12h

function sign(value) {
  const secret = process.env.SESSION_SECRET || 'insecure-dev-secret';
  const hmac = crypto.createHmac('sha256', secret).update(value).digest('hex');
  return `${value}.${hmac}`;
}

function verify(signed) {
  if (!signed || typeof signed !== 'string' || !signed.includes('.')) return null;
  const [value, hmac] = signed.split('.');
  const expected = sign(value).split('.')[1];
  if (hmac.length !== expected.length) return null;
  const ok = crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
  return ok ? value : null;
}

function issueSession(res) {
  const payload = JSON.stringify({ admin: true, exp: Date.now() + MAX_AGE_MS });
  const value = Buffer.from(payload).toString('base64url');
  res.cookie(COOKIE_NAME, sign(value), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: MAX_AGE_MS,
  });
}

function clearSession(res) {
  res.clearCookie(COOKIE_NAME);
}

function isAuthenticated(req) {
  const raw = req.cookies && req.cookies[COOKIE_NAME];
  const value = verify(raw);
  if (!value) return false;
  try {
    const payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    return !!payload.admin && payload.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  next();
}

module.exports = { issueSession, clearSession, isAuthenticated, requireAdmin };
