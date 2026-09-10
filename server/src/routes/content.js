const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', '..', 'public', 'assets', 'uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype);
    cb(ok ? null : new Error('Format d\'image non supporté.'), ok);
  },
});

// GET /api/content/:theme/:locale — public, returns saved overrides
router.get('/:theme/:locale', (req, res) => {
  const { theme, locale } = req.params;
  const rows = db.getOverrides(theme, locale);
  const overrides = {};
  for (const row of rows) overrides[row.edit_id] = row.data;
  res.json({ overrides });
});

// PUT /api/content/:theme/:locale/:editId — admin only
router.put('/:theme/:locale/:editId', requireAdmin, (req, res) => {
  const { theme, locale, editId } = req.params;
  db.upsertOverride(theme, locale, editId, req.body || {});
  res.json({ ok: true });
});

// DELETE /api/content/:theme/:locale/:editId — admin only, revert to default
router.delete('/:theme/:locale/:editId', requireAdmin, (req, res) => {
  const { theme, locale, editId } = req.params;
  db.deleteOverride(theme, locale, editId);
  res.json({ ok: true });
});

// POST /api/content/upload — admin only, returns the public URL of the uploaded image
router.post('/upload', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });
  res.json({ url: `/assets/uploads/${req.file.filename}` });
});

module.exports = router;
