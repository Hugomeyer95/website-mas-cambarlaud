const { Resend } = require('resend');
const crypto = require('crypto');

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function makeToken(booking, action) {
  const payload = Buffer.from(JSON.stringify({
    booking,
    action,
    exp: Date.now() + TOKEN_TTL_MS,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.TOKEN_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function fmt(dateIso) {
  const [y, m, d] = dateIso.split('-');
  const months = ['jan.','fév.','mar.','avr.','mai','juin','juil.','août','sep.','oct.','nov.','déc.'];
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let booking;
  try {
    booking = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Corps JSON invalide.' }) };
  }

  // Honeypot
  if (booking.website) {
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  const { firstName, lastName, email, startDate, endDate, guests, message, phone } = booking;
  if (!firstName || !lastName || !email || !startDate || !endDate) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Champs requis manquants.' }) };
  }

  const PUBLIC_URL = (process.env.PUBLIC_URL || 'https://chemint.fr').replace(/\/$/, '');
  const approveToken = makeToken(booking, 'approve');
  const rejectToken = makeToken(booking, 'reject');
  const approveUrl = `${PUBLIC_URL}/.netlify/functions/decide?token=${approveToken}`;
  const rejectUrl = `${PUBLIC_URL}/.netlify/functions/decide?token=${rejectToken}`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: process.env.OWNER_EMAIL,
      subject: `Nouvelle demande — ${firstName} ${lastName}, ${fmt(startDate)} → ${fmt(endDate)}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#3a3a3a">Nouvelle demande de réservation</h2>
          <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:6px 0;color:#666;width:120px">Nom</td><td style="padding:6px 0"><strong>${firstName} ${lastName}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0">${email}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Téléphone</td><td style="padding:6px 0">${phone || '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Arrivée</td><td style="padding:6px 0">${fmt(startDate)}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Départ</td><td style="padding:6px 0">${fmt(endDate)}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Voyageurs</td><td style="padding:6px 0">${guests}</td></tr>
            <tr><td style="padding:6px 0;color:#666;vertical-align:top">Message</td><td style="padding:6px 0">${message || '—'}</td></tr>
          </table>
          <div style="margin-top:32px">
            <a href="${approveUrl}" style="display:inline-block;background:#2a7a2a;color:#fff;padding:14px 28px;border-radius:5px;text-decoration:none;font-size:15px;margin-right:12px">✓ Approuver</a>
            <a href="${rejectUrl}" style="display:inline-block;background:#c0392b;color:#fff;padding:14px 28px;border-radius:5px;text-decoration:none;font-size:15px">✗ Refuser</a>
          </div>
          <p style="margin-top:24px;font-size:12px;color:#aaa">Ces liens expirent dans 7 jours.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Resend error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: "Erreur lors de l'envoi de l'email." }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
