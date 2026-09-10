const { Resend } = require('resend');
const crypto = require('crypto');

const GITHUB_REPO = process.env.GITHUB_REPO || 'Hugomeyer95/website-mas-cambarlaud';
const BLOCKED_DATES_PATH = 'public/data/blocked-dates.json';

function extractToken(event) {
  if (event.queryStringParameters && event.queryStringParameters.token) {
    return event.queryStringParameters.token;
  }
  if (event.body) {
    const ct = (event.headers && (event.headers['content-type'] || event.headers['Content-Type'])) || '';
    if (ct.includes('application/json')) {
      try { return JSON.parse(event.body).token; } catch {}
    }
    // application/x-www-form-urlencoded
    try {
      const params = new URLSearchParams(event.body);
      if (params.get('token')) return params.get('token');
    } catch {}
  }
  return null;
}

function verifyToken(token) {
  const dotIdx = token.lastIndexOf('.');
  if (dotIdx < 0) return null;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expected = crypto.createHmac('sha256', process.env.TOKEN_SECRET).update(payload).digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
  } catch {
    return null;
  }
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
  if (Date.now() > parsed.exp) return null;
  return parsed;
}

async function updateBlockedDates(newRange) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${BLOCKED_DATES_PATH}`;
  const headers = {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const getRes = await fetch(url, { headers });
  if (!getRes.ok) throw new Error(`GitHub GET échoué : ${getRes.status}`);
  const { content, sha } = await getRes.json();

  const current = JSON.parse(Buffer.from(content, 'base64').toString('utf-8'));
  current.push(newRange);
  current.sort((a, b) => a.start.localeCompare(b.start));

  const putRes = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `book: bloquer ${newRange.start} → ${newRange.end}`,
      content: Buffer.from(JSON.stringify(current, null, 2) + '\n').toString('base64'),
      sha,
    }),
  });
  if (!putRes.ok) {
    const errBody = await putRes.text();
    throw new Error(`GitHub PUT échoué : ${putRes.status} — ${errBody}`);
  }
}

function fmt(dateIso) {
  const [y, m, d] = dateIso.split('-');
  const months = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

function page(title, body, color = '#2a7a2a') {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Mas Cambarlaud</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f0ea;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{background:#fff;border-radius:8px;box-shadow:0 2px 16px rgba(0,0,0,.08);padding:40px;max-width:500px;width:100%}
  h2{color:${color};margin-bottom:16px;font-size:22px}
  p{color:#555;line-height:1.6;margin-bottom:12px}
  .back{display:inline-block;margin-top:20px;color:#888;font-size:14px;text-decoration:none}
  .back:hover{text-decoration:underline}
  table{border-collapse:collapse;width:100%;margin:16px 0}
  td{padding:6px 0;color:#555;font-size:14px;vertical-align:top}
  td:first-child{color:#888;width:110px;padding-right:12px}
  .btn{display:inline-block;padding:13px 28px;border-radius:5px;font-size:15px;cursor:pointer;border:none;color:#fff;background:${color};text-decoration:none}
  .btn:hover{opacity:.9}
</style></head>
<body><div class="card">${body}</div></body></html>`;
}

exports.handler = async (event) => {
  const PUBLIC_URL = (process.env.PUBLIC_URL || 'https://chemint.fr').replace(/\/$/, '');
  const token = extractToken(event);

  if (!token) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html' },
      body: page('Lien invalide', '<h2>Lien invalide</h2><p>Aucun jeton fourni.</p>', '#c0392b'),
    };
  }

  let data;
  try { data = verifyToken(token); } catch {}

  if (!data) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html' },
      body: page('Lien invalide', '<h2>Lien invalide ou expiré</h2><p>Ce lien a peut-être expiré (7 jours) ou a déjà été utilisé.</p>', '#c0392b'),
    };
  }

  const { booking, action } = data;
  const { firstName, lastName, email, startDate, endDate, guests, message } = booking;
  const actionLabel = action === 'approve' ? 'approuver' : 'refuser';
  const color = action === 'approve' ? '#2a7a2a' : '#c0392b';

  // ── GET : page de confirmation ──────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const body = `
      <h2>Confirmer la décision</h2>
      <table>
        <tr><td>Nom</td><td><strong>${firstName} ${lastName}</strong></td></tr>
        <tr><td>Email</td><td>${email}</td></tr>
        <tr><td>Arrivée</td><td>${fmt(startDate)}</td></tr>
        <tr><td>Départ</td><td>${fmt(endDate)}</td></tr>
        <tr><td>Voyageurs</td><td>${guests}</td></tr>
        ${message ? `<tr><td>Message</td><td>${message}</td></tr>` : ''}
      </table>
      <form method="POST" action="/.netlify/functions/decide">
        <input type="hidden" name="token" value="${token.replace(/"/g, '&quot;')}">
        <button type="submit" class="btn">Confirmer : ${actionLabel}</button>
      </form>
      <a class="back" href="${PUBLIC_URL}">← Retour au site</a>
    `;
    return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: page('Confirmer', body, color) };
  }

  // ── POST : traitement ───────────────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    const resend = new Resend(process.env.RESEND_API_KEY);
    // Le SDK Resend renvoie { data, error } au lieu de lever : sans ce contrôle
    // un refus de l'API passerait pour un succès.
    const check = (r) => {
      if (r && r.error) throw new Error(`Resend : ${r.error.message || r.error.name}`);
      return r;
    };

    try {
      if (action === 'approve') {
        await updateBlockedDates({ start: startDate, end: endDate });

        check(await resend.emails.send({
          from: process.env.FROM_EMAIL,
          to: email,
          subject: 'Votre réservation au Mas Cambarlaud est confirmée !',
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
              <h2 style="color:#2a7a2a">Réservation confirmée ✓</h2>
              <p>Bonjour ${firstName},</p>
              <p>Nous avons le plaisir de confirmer votre séjour au <strong>Mas Cambarlaud</strong> :</p>
              <table style="border-collapse:collapse;margin:16px 0">
                <tr><td style="padding:5px 16px 5px 0;color:#666">Arrivée</td><td><strong>${fmt(startDate)}</strong></td></tr>
                <tr><td style="padding:5px 16px 5px 0;color:#666">Départ</td><td><strong>${fmt(endDate)}</strong></td></tr>
                <tr><td style="padding:5px 16px 5px 0;color:#666">Voyageurs</td><td>${guests}</td></tr>
              </table>
              <p>Nous vous contacterons très prochainement avec toutes les informations pratiques pour votre séjour.</p>
              <p>À bientôt en Provence !<br>L'équipe Mas Cambarlaud</p>
            </div>
          `,
        }));

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'text/html' },
          body: page('Approuvé', `
            <h2>Réservation approuvée ✓</h2>
            <p>Un email de confirmation a été envoyé à <strong>${firstName} ${lastName}</strong> (${email}).</p>
            <p>Les dates <strong>${fmt(startDate)} → ${fmt(endDate)}</strong> sont maintenant bloquées dans le calendrier.</p>
            <p style="font-size:13px;color:#aaa">La mise à jour est immédiate sur le site — aucun délai d'attente.</p>
            <a class="back" href="${PUBLIC_URL}">← Retour au site</a>
          `),
        };

      } else {
        check(await resend.emails.send({
          from: process.env.FROM_EMAIL,
          to: email,
          subject: 'Votre demande au Mas Cambarlaud',
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
              <h2 style="color:#3a3a3a">Votre demande de séjour</h2>
              <p>Bonjour ${firstName},</p>
              <p>Merci de l'intérêt que vous portez au <strong>Mas Cambarlaud</strong>.</p>
              <p>Nous sommes malheureusement dans l'impossibilité de donner suite à votre demande pour les dates du ${fmt(startDate)} au ${fmt(endDate)}.</p>
              <p>N'hésitez pas à consulter nos disponibilités pour d'autres dates — nous serons ravis de vous accueillir.</p>
              <p>Cordialement,<br>L'équipe Mas Cambarlaud</p>
              <p><a href="${PUBLIC_URL}" style="color:#8c5e32">${PUBLIC_URL}</a></p>
            </div>
          `,
        }));

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'text/html' },
          body: page('Refusé', `
            <h2 style="color:#555">Demande refusée</h2>
            <p>Un email a été envoyé à <strong>${firstName} ${lastName}</strong> (${email}) pour l'informer.</p>
            <a class="back" href="${PUBLIC_URL}">← Retour au site</a>
          `, '#555'),
        };
      }
    } catch (err) {
      console.error('decide POST error:', err);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'text/html' },
        body: page('Erreur', `<h2>Erreur serveur</h2><p>${err.message}</p><a class="back" href="${PUBLIC_URL}">← Retour</a>`, '#c0392b'),
      };
    }
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
