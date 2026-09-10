// Thin fetch wrapper for the Mas Cambarlaud API (Netlify Functions + static data).
window.MC_API = (function () {
  async function request(path, options = {}) {
    const res = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    let body = null;
    try { body = await res.json(); } catch { /* no body */ }
    if (!res.ok) {
      const message = (body && body.error) || `Erreur ${res.status}`;
      throw new Error(message);
    }
    return body;
  }

  return {
    // Booking
    getAvailability: async (year) => {
      const res = await fetch('/data/blocked-dates.json');
      if (!res.ok) return { ranges: [] };
      const all = await res.json();
      const y = String(year);
      const ranges = all
        .filter((r) => r.start.startsWith(y) || r.end.startsWith(y))
        .map((r) => ({ start_date: r.start, end_date: r.end }));
      return { ranges };
    },
    createBooking: async (payload) => {
      const res = await fetch('/.netlify/functions/booking-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let body = null;
      try { body = await res.json(); } catch {}
      if (!res.ok) throw new Error((body && body.error) || `Erreur ${res.status}`);
      return body;
    },

    // Admin auth
    login: (password) => request('/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
    logout: () => request('/admin/logout', { method: 'POST' }),
    session: () => request('/admin/session'),
    listBookings: () => request('/admin/bookings'),
    decideBooking: (id, action) => request(`/admin/bookings/${id}/${action}`, { method: 'POST' }),

    // Content overrides
    getContent: (theme, locale) => request(`/content/${theme}/${locale}`),
    saveContent: (theme, locale, editId, data) =>
      request(`/content/${theme}/${locale}/${encodeURIComponent(editId)}`, { method: 'PUT', body: JSON.stringify(data) }),
    resetContent: (theme, locale, editId) =>
      request(`/content/${theme}/${locale}/${encodeURIComponent(editId)}`, { method: 'DELETE' }),
    uploadImage: async (file) => {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch('/api/content/upload', { method: 'POST', credentials: 'same-origin', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Échec du téléversement.');
      return body;
    },
  };
})();
