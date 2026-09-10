const express = require('express');
const db = require('../db');
const { issueSession, clearSession, isAuthenticated, requireAdmin } = require('../middleware/auth');
const { sendDecisionEmail } = require('../email');

const router = express.Router();

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }
  issueSession(res);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  res.json({ authenticated: isAuthenticated(req) });
});

router.get('/bookings', requireAdmin, (req, res) => {
  const rows = db.getAllBookings().slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  res.json({ bookings: rows });
});

// Public (token-secured) approve/reject link clicked from the owner's email.
// Step 1 (GET): show an intermediate form so the host can optionally add a personal message.
// Step 2 (POST): apply the decision and send the decision email (with the optional message).
router.get('/decide', (req, res) => {
  const { token, action } = req.query;
  if (!token || !['approve', 'reject'].includes(action)) {
    return res.status(400).send(renderDecisionPage('Lien invalide.', false));
  }
  const field = action === 'approve' ? 'approve_token' : 'reject_token';
  const booking = db.getBookingByToken(field, token);
  if (!booking) {
    return res.status(404).send(renderDecisionPage('Ce lien est invalide ou introuvable.', false));
  }
  res.send(renderDecisionForm(booking, action));
});

router.post('/decide', async (req, res) => {
  const { token, action, personalMessage, skipMessage } = req.body || {};
  if (!token || !['approve', 'reject'].includes(action)) {
    return res.status(400).send(renderDecisionPage('Lien invalide.', false));
  }
  const field = action === 'approve' ? 'approve_token' : 'reject_token';
  const booking = db.getBookingByToken(field, token);
  if (!booking) {
    return res.status(404).send(renderDecisionPage('Ce lien est invalide ou introuvable.', false));
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const wasApproved = booking.status === 'approved';

  if (booking.status !== newStatus) {
    db.updateBookingStatus(booking.id, newStatus, new Date().toISOString());
  }

  const msg = skipMessage ? '' : (personalMessage || '').trim();

  try {
    await sendDecisionEmail(booking, newStatus, msg);
  } catch (err) {
    console.error('Erreur envoi email de décision :', err);
  }

  let confirm;
  if (newStatus === 'approved') {
    confirm = `Réservation confirmée pour ${booking.first_name} ${booking.last_name} (${booking.start_date} → ${booking.end_date}). Les dates sont maintenant bloquées sur le site.`;
  } else if (wasApproved) {
    confirm = `Décision modifiée : demande refusée pour ${booking.first_name} ${booking.last_name}. Les dates ${booking.start_date} → ${booking.end_date} sont à nouveau disponibles.`;
  } else {
    confirm = `Demande refusée pour ${booking.first_name} ${booking.last_name}. Les dates redeviennent disponibles.`;
  }
  if (msg) confirm += ` Un message personnalisé a été envoyé à ${booking.email}.`;
  res.send(renderDecisionPage(confirm, true));
});

router.post('/bookings/:id/:action', requireAdmin, async (req, res) => {
  const { id, action } = req.params;
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Action invalide.' });
  const booking = db.getBookingById(id);
  if (!booking) return res.status(404).json({ error: 'Introuvable.' });

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  if (booking.status === newStatus) return res.json({ ok: true, unchanged: true });

  db.updateBookingStatus(id, newStatus, new Date().toISOString());
  try {
    await sendDecisionEmail(booking, newStatus);
  } catch (err) {
    console.error('Erreur envoi email de décision :', err);
  }
  res.json({ ok: true });
});

function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderDecisionForm(booking, action) {
  const isApprove = action === 'approve';
  const token = isApprove ? booking.approve_token : booking.reject_token;
  const label = isApprove ? 'Valider la réservation' : 'Refuser la réservation';
  const color = isApprove ? '#2f6b4f' : '#a33';
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Mas Cambarlaud — Réservation</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Georgia,serif;background:#F6F1E6;color:#2B2723;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:2rem}
  .card{max-width:540px;width:100%;background:#fff;border-radius:12px;padding:2.5rem;box-shadow:0 20px 50px -20px rgb(0 0 0/.25)}
  h1{font-size:1.25rem;margin-top:0;color:${color}}
  .meta{background:#f6f3ec;border-radius:6px;padding:12px 14px;margin:1rem 0 1.6rem;font-size:.9rem;line-height:1.75}
  .lbl{font-size:.82rem;color:#777;margin-bottom:.4rem;display:block}
  .opt{color:#bbb;font-style:italic}
  textarea{width:100%;border:1px solid #ddd;border-radius:6px;padding:10px 12px;font-family:Georgia,serif;font-size:.95rem;resize:vertical;min-height:120px;color:#2B2723}
  textarea:focus{outline:none;border-color:#b8a98a}
  .row{margin-top:1.4rem;display:flex;gap:10px;flex-wrap:wrap}
  .btn{border:none;border-radius:6px;padding:11px 22px;font-family:Georgia,serif;font-size:.9rem;cursor:pointer}
  .btn-main{background:${color};color:#fff}
  .btn-skip{background:none;border:1px solid #ccc;color:#666}
  .btn:hover{opacity:.82}
</style>
</head><body>
<div class="card">
  <h1>${label}</h1>
  <div class="meta">
    <strong>${booking.first_name} ${booking.last_name}</strong><br>
    ${fmtDate(booking.start_date)} → ${fmtDate(booking.end_date)}<br>
    ${booking.guests} personne(s) &middot; <a href="mailto:${booking.email}" style="color:inherit">${booking.email}</a>
  </div>
  <form method="POST" action="/api/admin/decide">
    <input type="hidden" name="token" value="${token}">
    <input type="hidden" name="action" value="${action}">
    <label>
      <span class="lbl">Message à envoyer à ${booking.first_name} <span class="opt">(optionnel)</span></span>
      <textarea name="personalMessage" placeholder="Bonjour ${booking.first_name}, ..."></textarea>
    </label>
    <div class="row">
      <button type="submit" class="btn btn-main">${label} &amp; envoyer</button>
      <button type="submit" name="skipMessage" value="1" class="btn btn-skip">Confirmer sans message</button>
    </div>
  </form>
</div>
</body></html>`;
}

function renderDecisionPage(message, success) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Mas Cambarlaud — Réservation</title>
<style>
  body{ font-family: Georgia, serif; background:#F6F1E6; color:#2B2723; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding: 2rem; }
  .card{ max-width: 480px; background:#fff; border-radius:12px; padding: 2.5rem; box-shadow: 0 20px 50px -20px rgb(0 0 0 / .25); text-align:center; }
  .card h1{ font-size: 1.4rem; margin-top:0; color: ${success ? '#2f6b4f' : '#a33'}; }
</style>
</head><body><div class="card"><h1>${success ? 'C\'est fait' : 'Oups'}</h1><p>${message}</p></div></body></html>`;
}

module.exports = router;
