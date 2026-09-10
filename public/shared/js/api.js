// Thin fetch wrapper for the Mas Cambarlaud backend API.
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
    getAvailability: (year) => request(`/availability?year=${encodeURIComponent(year)}`),
    createBooking: (payload) => request('/booking', { method: 'POST', body: JSON.stringify(payload) }),

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
