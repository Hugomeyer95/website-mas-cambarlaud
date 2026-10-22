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

  const NIGHT_PRICE = 640;

  function parseIso(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
  function addDays(key, n) { const dt = parseIso(key); dt.setDate(dt.getDate() + n); return iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()); }
  function isSaturday(key) { return parseIso(key).getDay() === 6; }
  function nightsBetween(a, b) { return Math.round((parseIso(b) - parseIso(a)) / 86400000); }
  function euro(amount, locale) {
    const text = new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
    // Intl sépare les milliers par une espace fine insécable (U+202F), absente de
    // certaines polices : on la remplace par l'espace insécable classique.
    return text.replace(/ /g, ' ');
  }

  // Une réservation occupe les nuits [arrivée, départ[ : le samedi d'arrivée est pris
  // à partir de l'après-midi, le samedi de départ se libère le matin. Un même samedi
  // peut donc clore un séjour et en ouvrir un autre. Statut de chaque jour (juillet
  // et août) :
  //   available : nuit libre, veille libre
  //   out       : nuit libre, veille occupée (un séjour se termine ce matin)
  //   in        : nuit occupée, veille libre (un séjour commence cet après-midi)
  //   blocked   : nuit et veille occupées (y compris un samedi qui enchaîne deux séjours)
  //   past      : jour passé
  //   closed    : nuit libre mais hors d'une semaine complète du calendrier (avant le
  //               premier samedi ou à partir du dernier), donc non réservable
  // Le séjour qui commence le dernier samedi d'août se termine le samedi suivant, début
  // septembre : la saison s'étend donc jusqu'à ce samedi de départ.
  function seasonEnd(year) {
    const aug31 = iso(year, 8, 31);
    const lastAugSaturday = addDays(aug31, -((parseIso(aug31).getDay() + 1) % 7));
    return addDays(lastAugSaturday, 7);
  }

  function buildStatusMap(year, ranges) {
    const occupied = new Set();
    ranges.forEach((r) => {
      for (let k = r.start_date; k < r.end_date; k = addDays(k, 1)) occupied.add(k);
    });
    const today = todayIso();
    const map = new Map();
    const end = seasonEnd(year);
    for (let key = iso(year, 7, 1); key <= end; key = addDays(key, 1)) {
      const night = occupied.has(key);
      const eve = occupied.has(addDays(key, -1));
      let status = 'available';
      if (night && eve) status = 'blocked';
      else if (night) status = 'in';
      else if (eve) status = 'out';
      if (key < today && status !== 'blocked') status = 'past';
      map.set(key, status);
    }
    // Un séjour va d'un samedi à un autre samedi du calendrier : les nuits en dehors
    // de [premier samedi, dernier samedi[ ne peuvent appartenir à aucun séjour.
    const saturdays = [...map.keys()].filter(isSaturday);
    const first = saturdays[0];
    const last = saturdays[saturdays.length - 1];
    map.forEach((status, key) => {
      if ((key < first || key >= last) && nightFree(status)) map.set(key, 'closed');
    });
    return map;
  }

  function nightFree(status) { return status === 'available' || status === 'out'; }

  // On arrive un samedi dont la nuit est libre.
  function canArrive(map, key) { return isSaturday(key) && nightFree(map.get(key)); }

  // On repart un samedi postérieur à l'arrivée, à condition que toutes les nuits
  // entre les deux soient libres. La nuit du samedi de départ, elle, peut être prise.
  function canDepart(map, start, key) {
    if (!map.has(key) || !isSaturday(key) || key <= start) return false;
    for (let k = start; k < key; k = addDays(k, 1)) {
      if (!nightFree(map.get(k))) return false;
    }
    return true;
  }

  // Le samedi d'arrivée d'un séjour confirmé s'affiche comme disponible : il reste
  // cliquable même quand il ne peut pas servir, et le clic explique alors son usage.
  function isClickable(map, selection, key) {
    if (map.get(key) === 'in') return true;
    const picking = selection.start && !selection.end;
    if (picking && (key === selection.start || canDepart(map, selection.start, key))) return true;
    return canArrive(map, key);
  }

  function dayAriaLabel(day, monthLabel, status, locale) {
    const en = locale === 'en';
    const date = `${day} ${monthLabel}`;
    if (status === 'blocked') return `${date}, ${en ? 'occupied' : 'occupé'}`;
    if (status === 'in') return `${date}, ${en ? 'available as a departure Saturday' : 'disponible comme samedi de départ'}`;
    if (status === 'available' || status === 'out') return `${date}, ${euro(NIGHT_PRICE, locale)}`;
    return date;
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
          <p class="mc-cal-selection" data-empty-fr="Réservez du samedi au samedi : choisissez votre samedi d'arrivée, puis votre samedi de départ." data-empty-en="Book from Saturday to Saturday: pick your arrival Saturday, then your departure Saturday."></p>
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
            <select name="guests" required>
              <option value="" selected disabled hidden>0</option>
              ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
            </select>
          </label>
          <label>
            <span data-fr="Votre message" data-en="Your message">Votre message</span>
            <textarea name="message" rows="4" placeholder="" data-ph-fr="Optionnel : vous pouvez utiliser ce champ pour compléter votre demande." data-ph-en="Optional: you can use this field to add details to your request."></textarea>
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

  // content-engine ne traduit que les éléments [data-edit-id] ; le widget est
  // injecté après son initialisation, ses libellés data-fr/data-en resteraient
  // donc en français. Ce helper les applique sur le sous-arbre du widget.
  function applyI18n(root, locale) {
    root.querySelectorAll('[data-fr][data-en]').forEach((el) => {
      const txt = locale === 'en' ? el.dataset.en : el.dataset.fr;
      if (txt && el.textContent !== txt) el.textContent = txt;
    });
    root.querySelectorAll('[data-ph-fr][data-ph-en]').forEach((el) => {
      el.placeholder = locale === 'en' ? el.dataset.phEn : el.dataset.phFr;
    });
  }

  function successModalHtml() {
    return `
      <div class="mc-modal" role="dialog" aria-modal="true" aria-labelledby="mc-modal-title" hidden>
        <div class="mc-modal-backdrop" data-mc-close></div>
        <div class="mc-modal-card" role="document">
          <button type="button" class="mc-modal-close" data-mc-close aria-label="Fermer">&times;</button>
          <div class="mc-modal-art" aria-hidden="true">${oliveSceneSvg()}</div>
          <div class="mc-modal-body">
            <h3 id="mc-modal-title" data-fr="Demande envoyée !" data-en="Request sent!">Demande envoyée !</h3>
            <p data-fr="Merci — nous revenons vers vous très vite par email pour confirmer vos dates."
               data-en="Thank you — we'll get back to you by email very soon to confirm your dates.">Merci — nous revenons vers vous très vite par email pour confirmer vos dates.</p>
            <button type="button" class="mc-modal-btn" data-mc-close data-fr="Fermer" data-en="Close">Fermer</button>
          </div>
        </div>
      </div>
    `;
  }

  // Olivier dans la garrigue — feuillage et herbes animés par CSS.
  function oliveSceneSvg() {
    return `
      <svg viewBox="0 0 320 180" role="img" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="mcSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#FBF3E7"/><stop offset="100%" stop-color="#F7E0C4"/>
          </linearGradient>
          <radialGradient id="mcSun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#F8DCAC" stop-opacity=".95"/>
            <stop offset="100%" stop-color="#F2C894" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="mcGround" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#DDCDAA"/><stop offset="100%" stop-color="#CBB78F"/>
          </linearGradient>
        </defs>

        <rect width="320" height="180" fill="url(#mcSky)"/>
        <circle class="mc-sun" cx="252" cy="46" r="40" fill="url(#mcSun)"/>
        <circle cx="252" cy="46" r="11" fill="#F6D9A8" opacity=".75"/>

        <path d="M0 118 C46 100 84 112 126 106 C170 100 212 86 260 96 C286 101 305 108 320 112 L320 180 L0 180 Z" fill="#C3C8B4" opacity=".85"/>
        <path d="M0 132 C54 118 96 130 148 124 C204 118 250 108 320 122 L320 180 L0 180 Z" fill="#ADB79C"/>
        <path d="M0 141 C60 133 120 146 186 140 C244 135 282 140 320 137 L320 180 L0 180 Z" fill="url(#mcGround)"/>

        <ellipse cx="44" cy="146" rx="19" ry="7" fill="#E2D8C6"/>
        <ellipse cx="52" cy="143" rx="10" ry="5" fill="#D0C4AE"/>
        <ellipse cx="272" cy="152" rx="24" ry="8" fill="#E2D8C6"/>
        <ellipse cx="262" cy="149" rx="12" ry="5" fill="#D0C4AE"/>

        <g class="mc-scrub"><ellipse cx="36" cy="138" rx="15" ry="9" fill="#8FA37F"/><ellipse cx="27" cy="141" rx="10" ry="6" fill="#7E9270"/></g>
        <g class="mc-scrub mc-d2"><ellipse cx="292" cy="144" rx="17" ry="10" fill="#8FA37F"/><ellipse cx="303" cy="147" rx="11" ry="6" fill="#7E9270"/></g>
        <g class="mc-scrub mc-d3"><ellipse cx="222" cy="152" rx="10" ry="7" fill="#96A986"/></g>

        <g class="mc-lav"><path d="M74 152 L72 134" stroke="#8E9B7E" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="72" cy="131" rx="3" ry="6" fill="#A292B5"/></g>
        <g class="mc-lav mc-d2"><path d="M82 153 L83 137" stroke="#8E9B7E" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="83" cy="134" rx="2.6" ry="5.4" fill="#B0A0C1"/></g>
        <g class="mc-lav mc-d3"><path d="M240 154 L242 139" stroke="#8E9B7E" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="242" cy="136" rx="2.8" ry="5.6" fill="#A292B5"/></g>

        <g class="mc-tree">
          <path d="M146 150 C148 141 152 133 151 124 C150 115 147 108 151 101 L163 100 C161 107 160 114 163 122 C166 131 171 141 174 150 Z" fill="#7C6B54"/>
          <path d="M151 124 C146 117 139 112 132 109 M162 122 C168 114 176 110 184 108 M157 118 C157 110 157 104 158 98" stroke="#6A5A46" stroke-width="3.2" stroke-linecap="round" fill="none"/>
          <g class="mc-canopy">
            <ellipse class="mc-leaf" cx="128" cy="99" rx="22" ry="15" fill="#7A8F6C"/>
            <ellipse class="mc-leaf mc-d2" cx="188" cy="97" rx="23" ry="15" fill="#7A8F6C"/>
            <ellipse class="mc-leaf mc-d3" cx="158" cy="84" rx="27" ry="18" fill="#8CA07E"/>
            <ellipse class="mc-leaf mc-d2" cx="137" cy="87" rx="19" ry="13" fill="#9FB292"/>
            <ellipse class="mc-leaf mc-d4" cx="180" cy="86" rx="18" ry="12" fill="#9FB292"/>
            <ellipse class="mc-leaf mc-d3" cx="158" cy="99" rx="21" ry="13" fill="#6E8461"/>
            <circle cx="142" cy="93" r="2.1" fill="#5C4A63"/>
            <circle cx="176" cy="91" r="1.9" fill="#5C4A63"/>
            <circle cx="160" cy="78" r="2" fill="#5C4A63"/>
          </g>
        </g>

        <g>
          <path d="M117 144 L135 144 L132 157 L120 157 Z" fill="#BE9260"/>
          <path d="M118.4 148 H133.6 M119.4 152 H132.6" stroke="#9D7647" stroke-width=".9" fill="none"/>
          <ellipse cx="126" cy="144" rx="9" ry="2.8" fill="#D2A874"/>
          <ellipse cx="122" cy="143.4" rx="2.1" ry="1.7" fill="#4A3A52"/>
          <ellipse cx="126.5" cy="143.8" rx="2.1" ry="1.7" fill="#5C4A63"/>
          <ellipse cx="130.6" cy="143.3" rx="1.9" ry="1.6" fill="#4A3A52"/>
        </g>
        <g>
          <path d="M185 146 L203 146 L200 159 L188 159 Z" fill="#BE9260"/>
          <path d="M186.4 150 H201.6 M187.4 154 H200.6" stroke="#9D7647" stroke-width=".9" fill="none"/>
          <ellipse cx="194" cy="146" rx="9" ry="2.8" fill="#D2A874"/>
          <ellipse cx="190.2" cy="145.4" rx="2.1" ry="1.7" fill="#5C4A63"/>
          <ellipse cx="194.8" cy="145.8" rx="2.1" ry="1.7" fill="#4A3A52"/>
          <ellipse cx="198.4" cy="145.3" rx="1.9" ry="1.6" fill="#5C4A63"/>
        </g>

        <g class="mc-olives">
          <ellipse class="mc-olive" style="--x:6px;--y:46px;--d:0s"     cx="120" cy="98"  rx="2.2" ry="2.8" fill="#4A3A52"/>
          <ellipse class="mc-olive" style="--x:5px;--y:47px;--d:1.4s"   cx="189" cy="99"  rx="2.2" ry="2.8" fill="#5C4A63"/>
          <ellipse class="mc-olive" style="--x:-6px;--y:44px;--d:2.8s"  cx="132" cy="100" rx="2.1" ry="2.7" fill="#5C4A63"/>
          <ellipse class="mc-olive" style="--x:-4px;--y:45px;--d:4.2s"  cx="198" cy="101" rx="2.2" ry="2.8" fill="#4A3A52"/>
          <ellipse class="mc-olive" style="--x:0px;--y:51px;--d:5.6s"   cx="126" cy="93"  rx="2" ry="2.6" fill="#5C4A63"/>
          <ellipse class="mc-olive" style="--x:3px;--y:52px;--d:7s"     cx="191" cy="94"  rx="2.1" ry="2.7" fill="#4A3A52"/>
          <ellipse class="mc-olive" style="--x:-11px;--y:48px;--d:8.4s" cx="137" cy="96"  rx="2.2" ry="2.8" fill="#4A3A52"/>
          <ellipse class="mc-olive" style="--x:-8px;--y:49px;--d:9.8s"  cx="202" cy="97"  rx="2" ry="2.6" fill="#5C4A63"/>
          <ellipse class="mc-olive" style="--x:4px;--y:41px;--d:11.2s"  cx="122" cy="103" rx="2.1" ry="2.7" fill="#5C4A63"/>
          <ellipse class="mc-olive" style="--x:8px;--y:44px;--d:12.6s"  cx="186" cy="102" rx="2.2" ry="2.8" fill="#4A3A52"/>
        </g>

        <g class="mc-grass"><path d="M100 158 C99 150 97 146 94 142 M104 158 C105 151 106 147 109 143 M102 158 L102 147" stroke="#9AAA88" stroke-width="1.5" stroke-linecap="round" fill="none"/></g>
        <g class="mc-grass mc-d2"><path d="M196 160 C195 152 193 148 190 144 M200 160 C201 153 203 149 206 145" stroke="#9AAA88" stroke-width="1.5" stroke-linecap="round" fill="none"/></g>
        <g class="mc-grass mc-d3"><path d="M58 162 C57 155 55 151 52 148 M62 162 C63 156 65 152 68 149" stroke="#A5B394" stroke-width="1.5" stroke-linecap="round" fill="none"/></g>
      </svg>
    `;
  }

  // nextMonthLabel : si fourni, les jours du mois suivant présents dans la saison
  // (début septembre) sont ajoutés à la suite de la grille.
  function renderMonth(year, month, monthLabel, statusMap, selection, locale, nextMonthLabel) {
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

    function dayButton(key, day, label, isNext) {
      const status = statusMap.get(key) || 'unavailable';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `mc-cal-day s-${status} ${isSaturday(key) ? 'is-sat' : 'not-sat'}${isNext ? ' is-next' : ''}`;
      const num = document.createElement('span');
      num.textContent = String(day);
      btn.appendChild(num);
      if (nightFree(status)) {
        const price = document.createElement('span');
        price.className = 'p';
        price.textContent = `${NIGHT_PRICE}€`;
        btn.appendChild(price);
      }
      btn.setAttribute('aria-label', dayAriaLabel(day, label, status, locale));
      btn.title = `${day} ${label}`;
      btn.dataset.date = key;
      if (selection.start === key || selection.end === key) btn.classList.add('selected');
      if (selection.start && selection.end && key > selection.start && key < selection.end) btn.classList.add('in-range');
      btn.disabled = !isClickable(statusMap, selection, key);
      return btn;
    }

    const n = daysInMonth(year, month);
    for (let d = 1; d <= n; d++) grid.appendChild(dayButton(iso(year, month, d), d, monthLabel, false));
    if (nextMonthLabel) {
      for (let d = 1; statusMap.has(iso(year, month + 1, d)); d++) {
        grid.appendChild(dayButton(iso(year, month + 1, d), d, nextMonthLabel, true));
      }
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
    let hint = false;

    const monthsEl = mount.querySelector('.mc-cal-months');
    const yearEl = mount.querySelector('.mc-cal-year');
    const selectionEl = mount.querySelector('.mc-cal-selection');
    const form = mount.querySelector('.mc-booking-form');
    const errorEl = mount.querySelector('.mc-form-error');
    const successEl = mount.querySelector('.mc-booking-success');

    function locale() { return (window.MC_CONTENT && window.MC_CONTENT.getLocale()) || 'fr'; }

    // Modal de confirmation, monté sur <body> pour échapper au contexte du panneau.
    const modalHost = document.createElement('div');
    modalHost.innerHTML = successModalHtml();
    const modal = modalHost.firstElementChild;
    document.body.appendChild(modal);
    function openModal() {
      applyI18n(modal, locale());
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      modal.querySelector('.mc-modal-btn').focus();
    }

    // Le modal ne s'ouvre qu'après un envoi réussi. À la fermeture on recharge
    // donc la page : les coordonnées saisies disparaissent et la demande ne peut
    // pas être renvoyée par inadvertance.
    function closeModal() {
      modal.hidden = true;
      document.body.style.overflow = '';
      // Vidé explicitement : certains navigateurs restaurent les champs saisis
      // au rechargement, ce qui réafficherait les coordonnées du voyageur.
      form.reset();
      window.location.reload();
    }

    modal.addEventListener('click', (e) => { if (e.target.closest('[data-mc-close]')) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

    function renderSelectionText() {
      const l = locale();
      if (hint) {
        selectionEl.textContent = l === 'en'
          ? 'This Saturday is only available as a departure day: pick your arrival Saturday first.'
          : "Ce samedi n'est disponible qu'en jour de départ : choisissez d'abord votre samedi d'arrivée.";
        return;
      }
      if (!selection.start) {
        selectionEl.textContent = selectionEl.dataset[l === 'en' ? 'emptyEn' : 'emptyFr'];
        return;
      }
      const fmt = (iso_) => {
        const [y, m, d] = iso_.split('-').map(Number);
        const names = l === 'en' ? MONTH_NAMES_EN : MONTH_NAMES_FR;
        return `${d} ${names[m - 1]} ${y}`;
      };
      if (!selection.end) {
        selectionEl.textContent = l === 'en'
          ? `Arrival on Saturday ${fmt(selection.start)}. Now pick your departure Saturday.`
          : `Arrivée le samedi ${fmt(selection.start)}. Choisissez maintenant votre samedi de départ.`;
        return;
      }
      const nights = nightsBetween(selection.start, selection.end);
      const nightsLabel = l === 'en' ? (nights > 1 ? 'nights' : 'night') : (nights > 1 ? 'nuits' : 'nuit');
      const total = document.createElement('strong');
      total.className = 'mc-cal-total';
      total.textContent = `${nights} ${nightsLabel} × ${euro(NIGHT_PRICE, l)} = ${euro(nights * NIGHT_PRICE, l)}`;
      selectionEl.textContent = `${fmt(selection.start)} → ${fmt(selection.end)}`;
      selectionEl.append(document.createElement('br'), total);
    }

    function render() {
      const l = locale();
      applyI18n(mount, l);
      applyI18n(modal, l);
      const tpl = yearEl.dataset[l === 'en' ? 'enTpl' : 'frTpl'];
      yearEl.textContent = tpl.replace('{y}', year);
      monthsEl.innerHTML = '';
      const names = l === 'en' ? MONTH_NAMES_EN : MONTH_NAMES_FR;
      monthsEl.appendChild(renderMonth(year, 7, `${names[6]} ${year}`, statusMap, selection, l));
      monthsEl.appendChild(renderMonth(year, 8, `${names[7]} ${year}`, statusMap, selection, l, `${names[8]} ${year}`));
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
      // Une sélection faite avant le rafraîchissement peut être devenue indisponible.
      if (selection.start && !canArrive(statusMap, selection.start)) {
        selection.start = null; selection.end = null;
      } else if (selection.end && !canDepart(statusMap, selection.start, selection.end)) {
        selection.end = null;
      }
      render();
    }

    mount.querySelectorAll('.mc-cal-nav').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = Number(btn.dataset.dir);
        const next = year + dir;
        if (next < minYear || next > maxYear) return;
        year = next;
        selection.start = null; selection.end = null; hint = false;
        refreshAvailability();
      });
    });

    monthsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.mc-cal-day');
      if (!btn || btn.disabled) return;
      const key = btn.dataset.date;
      const picking = selection.start && !selection.end;
      hint = false;
      if (picking && key === selection.start) {
        selection.start = null;
      } else if (picking && canDepart(statusMap, selection.start, key)) {
        selection.end = key;
      } else if (canArrive(statusMap, key)) {
        selection.start = key;
        selection.end = null;
      } else if (statusMap.get(key) === 'in') {
        hint = true;
      }
      render();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      const l = locale();
      if (!selection.start || !selection.end) {
        errorEl.textContent = l === 'en' ? 'Please select an arrival Saturday and a departure Saturday.' : 'Merci de sélectionner un samedi d\'arrivée et un samedi de départ.';
        errorEl.hidden = false;
        return;
      }
      const fd = new FormData(form);
      // Un <option> désactivé n'est pas envoyé : tant que rien n'est choisi, la valeur est absente.
      const guests = Number(fd.get('guests')) || 0;
      if (guests < 1) {
        errorEl.textContent = l === 'en' ? 'Please select the number of guests.' : 'Merci d\'indiquer le nombre de personnes.';
        errorEl.hidden = false;
        return;
      }
      const payload = {
        startDate: selection.start,
        endDate: selection.end,
        firstName: fd.get('firstName'),
        lastName: fd.get('lastName'),
        email: fd.get('email'),
        phone: fd.get('phone'),
        guests,
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
        openModal();
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

    // Le propriétaire approuve souvent depuis un autre onglet : en revenant sur
    // celui du site, on recharge les disponibilités sans rafraîchissement manuel.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshAvailability();
    });

    refreshAvailability();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
