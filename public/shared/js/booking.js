// Booking widget: July/August-only calendar + request form. Injected into <div id="mc-booking"></div>.
(function () {
  const MONTH_NAMES_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DOW_FR = ['L','M','M','J','V','S','D'];
  const DOW_EN = ['M','T','W','T','F','S','S'];

  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }
  function todayIso() { const t = new Date(); return iso(t.getFullYear(), t.getMonth() + 1, t.getDate()); }

  function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }

  function buildStatusMap(year, ranges) {
    // status per ISO date string, only for July (7) and August (8)
    const map = new Map();
    [7, 8].forEach((month) => {
      const n = daysInMonth(year, month);
      for (let d = 1; d <= n; d++) map.set(iso(year, month, d), 'available');
    });
    ranges.forEach((r) => {
      let cur = new Date(r.start_date + 'T00:00:00');
      const end = new Date(r.end_date + 'T00:00:00');
      while (cur <= end) {
        const key = iso(cur.getFullYear(), cur.getMonth() + 1, cur.getDate());
        if (map.has(key)) map.set(key, 'blocked');
        cur.setDate(cur.getDate() + 1);
      }
    });
    const today = todayIso();
    map.forEach((v, k) => { if (k < today && v === 'available') map.set(k, 'past'); });
    return map;
  }

  function rangeHasBlocker(statusMap, startIso, endIso) {
    let cur = new Date(startIso + 'T00:00:00');
    const end = new Date(endIso + 'T00:00:00');
    while (cur <= end) {
      const key = iso(cur.getFullYear(), cur.getMonth() + 1, cur.getDate());
      const s = statusMap.get(key);
      if (s === 'blocked' || s === 'past' || s === undefined) return true;
      cur.setDate(cur.getDate() + 1);
    }
    return false;
  }

  function widgetHtml() {
    return `
      <div class="mc-booking">
        <div class="mc-booking-cal">
          <div class="mc-cal-head">
            <button type="button" class="mc-cal-nav" data-dir="-1" aria-label="Année précédente">&lsaquo;</button>
            <span class="mc-cal-year" data-fr-tpl="Été {y}" data-en-tpl="Summer {y}"></span>
            <button type="button" class="mc-cal-nav" data-dir="1" aria-label="Année suivante">&rsaquo;</button>
          </div>
          <div class="mc-cal-months"></div>
          <div class="mc-cal-legend">
            <span><i class="dot available"></i><span data-fr="Disponible" data-en="Available">Disponible</span></span>
            <span><i class="dot blocked"></i><span data-fr="Occupé" data-en="Occupied">Occupé</span></span>
          </div>
          <p class="mc-cal-selection" data-empty-fr="Choisissez une date d'arrivée, puis une date de départ." data-empty-en="Pick an arrival date, then a departure date."></p>
        </div>
        <form class="mc-booking-form" novalidate>
          <input type="text" name="website" class="mc-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
          <div class="mc-field-row">
            <label>
              <span data-fr="Prénom" data-en="First name">Prénom</span>
              <input type="text" name="firstName" required autocomplete="given-name">
            </label>
            <label>
              <span data-fr="Nom" data-en="Last name">Nom</span>
              <input type="text" name="lastName" required autocomplete="family-name">
            </label>
          </div>
          <div class="mc-field-row">
            <label>
              <span data-fr="Email" data-en="Email">Email</span>
              <input type="email" name="email" required autocomplete="email">
            </label>
            <label>
              <span data-fr="Téléphone" data-en="Phone">Téléphone</span>
              <input type="tel" name="phone" required autocomplete="tel">
            </label>
          </div>
          <label class="mc-field-guests">
            <span data-fr="Nombre de personnes" data-en="Number of guests">Nombre de personnes</span>
            <input type="number" name="guests" min="1" max="12" value="2" required>
          </label>
          <label>
            <span data-fr="Votre message" data-en="Your message">Votre message</span>
            <textarea name="message" rows="4" required placeholder="" data-ph-fr="Parlez-nous de votre séjour, de vos dates idéales..." data-ph-en="Tell us about your stay, your ideal dates..."></textarea>
          </label>
          <p class="mc-form-note" data-fr="Vos dates ne sont pas bloquées immédiatement : nous vous confirmons par email sous peu." data-en="Your dates aren't blocked immediately — we'll confirm by email shortly.">Vos dates ne sont pas bloquées immédiatement : nous vous confirmons par email sous peu.</p>
          <p class="mc-form-error" hidden></p>
          <button type="submit" class="mc-submit" data-fr="Envoyer la demande" data-en="Send request">Envoyer la demande</button>
        </form>
        <div class="mc-booking-success" hidden>
          <h3 data-fr="Demande envoyée !" data-en="Request sent!">Demande envoyée !</h3>
          <p data-fr="Merci — nous revenons vers vous très vite par email pour confirmer vos dates." data-en="Thank you — we'll get back to you by email very soon to confirm your dates.">Merci — nous revenons vers vous très vite par email pour confirmer vos dates.</p>
        </div>
      </div>
    `;
  }

  function renderMonth(year, month, monthLabel, statusMap, selection, locale) {
    const wrap = document.createElement('div');
    wrap.className = 'mc-cal-month';
    const dow = locale === 'en' ? DOW_EN : DOW_FR;
    const title = document.createElement('div');
    title.className = 'mc-cal-month-title';
    title.textContent = monthLabel;
    wrap.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'mc-cal-grid';
    dow.forEach((d) => {
      const el = document.createElement('span');
      el.className = 'mc-cal-dow';
      el.textContent = d;
      grid.appendChild(el);
    });

    const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Monday = 0
    for (let i = 0; i < firstDow; i++) grid.appendChild(document.createElement('span'));

    const n = daysInMonth(year, month);
    for (let d = 1; d <= n; d++) {
      const key = iso(year, month, d);
      const status = statusMap.get(key) || 'unavailable';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `mc-cal-day s-${status}`;
      btn.textContent = String(d);
      btn.dataset.date = key;
      if (selection.start === key || selection.end === key) btn.classList.add('selected');
      if (selection.start && selection.end && key > selection.start && key < selection.end) btn.classList.add('in-range');
      if (status !== 'available') btn.disabled = true;
      grid.appendChild(btn);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  function init() {
    const mount = document.getElementById('mc-booking');
    if (!mount) return;
    mount.innerHTML = widgetHtml();

    let year = new Date().getFullYear();
    const nowMonth = new Date().getMonth() + 1;
    if (nowMonth > 8) year += 1; // past this year's summer season already: default to next year
    const minYear = new Date().getFullYear();
    const maxYear = minYear + 2;

    let ranges = [];
    let statusMap = new Map();
    const selection = { start: null, end: null };

    const monthsEl = mount.querySelector('.mc-cal-months');
    const yearEl = mount.querySelector('.mc-cal-year');
    const selectionEl = mount.querySelector('.mc-cal-selection');
    const form = mount.querySelector('.mc-booking-form');
    const errorEl = mount.querySelector('.mc-form-error');
    const successEl = mount.querySelector('.mc-booking-success');

    function locale() { return (window.MC_CONTENT && window.MC_CONTENT.getLocale()) || 'fr'; }

    function renderSelectionText() {
      const l = locale();
      if (!selection.start) {
        selectionEl.textContent = selectionEl.dataset[l === 'en' ? 'emptyEn' : 'emptyFr'];
        return;
      }
      const fmt = (iso_) => {
        const [y, m, d] = iso_.split('-').map(Number);
        const names = l === 'en' ? MONTH_NAMES_EN : MONTH_NAMES_FR;
        return `${d} ${names[m - 1]} ${y}`;
      };
      if (selection.start && !selection.end) {
        selectionEl.textContent = l === 'en'
          ? `Arrival: ${fmt(selection.start)} — now pick a departure date.`
          : `Arrivée : ${fmt(selection.start)} — choisissez maintenant la date de départ.`;
      } else {
        selectionEl.textContent = l === 'en'
          ? `${fmt(selection.start)} → ${fmt(selection.end)}`
          : `${fmt(selection.start)} → ${fmt(selection.end)}`;
      }
    }

    function render() {
      const l = locale();
      const tpl = yearEl.dataset[l === 'en' ? 'enTpl' : 'frTpl'];
      yearEl.textContent = tpl.replace('{y}', year);
      monthsEl.innerHTML = '';
      const names = l === 'en' ? MONTH_NAMES_EN : MONTH_NAMES_FR;
      monthsEl.appendChild(renderMonth(year, 7, `${names[6]} ${year}`, statusMap, selection, l));
      monthsEl.appendChild(renderMonth(year, 8, `${names[7]} ${year}`, statusMap, selection, l));
      renderSelectionText();
    }

    async function refreshAvailability() {
      try {
        const data = await MC_API.getAvailability(year);
        ranges = data.ranges || [];
      } catch (e) {
        ranges = [];
        console.warn('[booking] Impossible de charger les disponibilités.', e);
      }
      statusMap = buildStatusMap(year, ranges);
      render();
    }

    mount.querySelectorAll('.mc-cal-nav').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = Number(btn.dataset.dir);
        const next = year + dir;
        if (next < minYear || next > maxYear) return;
        year = next;
        selection.start = null; selection.end = null;
        refreshAvailability();
      });
    });

    monthsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.mc-cal-day');
      if (!btn || btn.disabled) return;
      const key = btn.dataset.date;
      if (!selection.start || (selection.start && selection.end)) {
        selection.start = key;
        selection.end = null;
      } else if (key < selection.start) {
        selection.start = key;
        selection.end = null;
      } else if (key === selection.start) {
        selection.start = null;
        selection.end = null;
      } else {
        if (rangeHasBlocker(statusMap, selection.start, key)) {
          selection.start = key;
          selection.end = null;
        } else {
          selection.end = key;
        }
      }
      render();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      const l = locale();
      if (!selection.start || !selection.end) {
        errorEl.textContent = l === 'en' ? 'Please select an arrival and a departure date.' : 'Merci de sélectionner une date d\'arrivée et de départ.';
        errorEl.hidden = false;
        return;
      }
      const fd = new FormData(form);
      const payload = {
        startDate: selection.start,
        endDate: selection.end,
        firstName: fd.get('firstName'),
        lastName: fd.get('lastName'),
        email: fd.get('email'),
        phone: fd.get('phone'),
        guests: Number(fd.get('guests')),
        message: fd.get('message'),
        website: fd.get('website'),
        locale: l,
        theme: (window.MC_CONTENT && window.MC_CONTENT.getTheme()) || null,
      };
      const submitBtn = form.querySelector('.mc-submit');
      submitBtn.disabled = true;
      try {
        await MC_API.createBooking(payload);
        form.hidden = true;
        successEl.hidden = false;
        selection.start = null; selection.end = null;
        await refreshAvailability();
      } catch (err) {
        errorEl.textContent = err.message || (l === 'en' ? 'Something went wrong.' : 'Une erreur est survenue.');
        errorEl.hidden = false;
      } finally {
        submitBtn.disabled = false;
      }
    });

    if (window.MC_CONTENT) window.MC_CONTENT.onLocaleChange(render);
    refreshAvailability();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
