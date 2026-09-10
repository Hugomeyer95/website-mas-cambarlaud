// Simple JSON-file-backed store. No native compilation required (unlike better-sqlite3),
// which matters since this project must run on machines without Visual Studio Build Tools.
// Small enough dataset (a handful of bookings + content overrides) that this is plenty robust.
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const filePath = path.join(dataDir, 'store.json');

function load() {
  if (!fs.existsSync(filePath)) return { bookings: [], contentOverrides: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
      contentOverrides: Array.isArray(parsed.contentOverrides) ? parsed.contentOverrides : [],
    };
  } catch (err) {
    console.error('[db] Fichier de données corrompu, démarrage avec un état vide.', err);
    return { bookings: [], contentOverrides: [] };
  }
}

const state = load();

function save() {
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
}

module.exports = {
  // ---------- bookings ----------
  getAllBookings() {
    return state.bookings;
  },
  getBookingByToken(field, token) {
    return state.bookings.find((b) => b[field] === token) || null;
  },
  getBookingById(id) {
    return state.bookings.find((b) => b.id === id) || null;
  },
  insertBooking(booking) {
    state.bookings.push(booking);
    save();
  },
  updateBookingStatus(id, status, decidedAt) {
    const b = state.bookings.find((x) => x.id === id);
    if (b) {
      b.status = status;
      b.decided_at = decidedAt;
      save();
    }
    return b || null;
  },
  getActiveBookings() {
    return state.bookings.filter((b) => b.status === 'approved');
  },
  getActiveBookingsForYear(year) {
    return state.bookings.filter(
      (b) => b.status === 'approved' && b.start_date.slice(0, 4) === year
    );
  },

  // ---------- content overrides ----------
  getOverrides(theme, locale) {
    return state.contentOverrides.filter((o) => o.theme === theme && o.locale === locale);
  },
  upsertOverride(theme, locale, editId, data) {
    const match = (o) => o.theme === theme && o.locale === locale && o.edit_id === editId;
    const existing = state.contentOverrides.find(match);
    const updated_at = new Date().toISOString();
    if (existing) {
      existing.data = data;
      existing.updated_at = updated_at;
    } else {
      state.contentOverrides.push({ theme, locale, edit_id: editId, data, updated_at });
    }
    save();
  },
  deleteOverride(theme, locale, editId) {
    state.contentOverrides = state.contentOverrides.filter(
      (o) => !(o.theme === theme && o.locale === locale && o.edit_id === editId)
    );
    save();
  },
};
