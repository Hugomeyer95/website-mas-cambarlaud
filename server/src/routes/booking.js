const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { sendOwnerNotification, sendRequesterAck } = require('../email');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isWithinJulyAugust(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.getMonth() + 1; // 1-12
  return month === 7 || month === 8;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

// GET /api/availability?year=2027
router.get('/availability', (req, res) => {
  const year = String(req.query.year || new Date().getFullYear());
  const ranges = db
    .getActiveBookingsForYear(year)
    .map((b) => ({ start_date: b.start_date, end_date: b.end_date, status: b.status }));
  res.json({ year, ranges });
});

// POST /api/booking
router.post('/booking', async (req, res) => {
  const {
    startDate, endDate, firstName, lastName, email, phone, guests, message, locale, theme,
    website, // honeypot field — real users never fill this
  } = req.body || {};

  if (website) {
    // Silently pretend success to the bot, do nothing.
    return res.status(201).json({ ok: true });
  }

  const errors = [];
  if (!DATE_RE.test(startDate || '') || !DATE_RE.test(endDate || '')) errors.push('Dates invalides.');
  else {
    if (startDate > endDate) errors.push("La date de départ doit suivre la date d'arrivée.");
    if (!isWithinJulyAugust(startDate) || !isWithinJulyAugust(endDate)) {
      errors.push('Les réservations ne sont possibles qu\'en juillet et août.');
    }
  }
  if (!firstName || !String(firstName).trim()) errors.push('Prénom requis.');
  if (!lastName || !String(lastName).trim()) errors.push('Nom requis.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email invalide.');
  if (!phone || !String(phone).trim()) errors.push('Téléphone requis.');
  const guestsNum = Number(guests);
  if (!Number.isInteger(guestsNum) || guestsNum < 1 || guestsNum > 12) errors.push('Nombre de personnes invalide (1 à 12).');
  if (!message || !String(message).trim()) errors.push('Un message est requis pour la demande.');

  if (errors.length) {
    return res.status(400).json({ error: errors.join(' ') });
  }

  const existing = db.getActiveBookings();
  const conflict = existing.some((b) => rangesOverlap(startDate, endDate, b.start_date, b.end_date));
  if (conflict) {
    return res.status(409).json({ error: 'Ces dates sont déjà réservées. Merci de choisir une autre période.' });
  }

  const booking = {
    id: crypto.randomUUID(),
    start_date: startDate,
    end_date: endDate,
    first_name: String(firstName).trim(),
    last_name: String(lastName).trim(),
    email: String(email).trim(),
    phone: String(phone).trim(),
    guests: guestsNum,
    message: String(message).trim(),
    locale: locale === 'en' ? 'en' : 'fr',
    theme: theme || null,
    status: 'pending',
    approve_token: crypto.randomBytes(24).toString('hex'),
    reject_token: crypto.randomBytes(24).toString('hex'),
    created_at: new Date().toISOString(),
    decided_at: null,
  };

  db.insertBooking(booking);

  try {
    await Promise.all([sendOwnerNotification(booking), sendRequesterAck(booking)]);
  } catch (err) {
    console.error('Erreur envoi email réservation (la demande est tout de même enregistrée) :', err);
  }

  res.status(201).json({ ok: true, id: booking.id });
});

module.exports = router;
