// Handles: FR/EN translation + per-locale content overrides (text, style, position, size, image src)
// saved on the backend. Works together with editor.js (which writes overrides) and gallery.js.
window.MC_CONTENT = (function () {
  const theme = document.documentElement.dataset.theme || 'unknown-theme';
  let locale = localStorage.getItem('mc-lang') === 'en' ? 'en' : 'fr';
  const overrides = { fr: {}, en: {} };
  const base = new Map(); // el -> { fr, en, src }
  let editableEls = [];
  const listeners = [];

  function collectBase() {
    editableEls = Array.from(document.querySelectorAll('[data-edit-id]'));
    editableEls.forEach((el) => {
      if (el.tagName === 'IMG') {
        base.set(el, { src: el.getAttribute('src') });
      } else {
        const fr = el.hasAttribute('data-fr') ? el.getAttribute('data-fr') : el.textContent;
        const en = el.hasAttribute('data-en') ? el.getAttribute('data-en') : fr;
        base.set(el, { fr, en });
      }
    });
  }

  async function loadOverrides() {
    try {
      const [fr, en] = await Promise.all([
        MC_API.getContent(theme, 'fr'),
        MC_API.getContent(theme, 'en'),
      ]);
      Object.assign(overrides.fr, fr.overrides || {});
      Object.assign(overrides.en, en.overrides || {});
    } catch (e) {
      console.warn('[content-engine] Backend indisponible — le site fonctionne avec le contenu par défaut.', e);
    }
  }

  function applyStyle(el, ov) {
    if (ov && ov.fontFamily && window.MC_FONTS) window.MC_FONTS.ensureLoaded(ov.fontFamily);
    el.style.fontFamily = (ov && ov.fontFamily) || '';
    el.style.fontSize = (ov && ov.fontSize) || '';
    el.style.fontWeight = (ov && ov.fontWeight) || '';
    el.style.fontStyle = (ov && ov.fontStyle) || '';
    el.style.textDecorationLine = (ov && ov.textDecoration) || '';
    el.style.letterSpacing = (ov && ov.letterSpacing) || '';
    el.style.lineHeight = (ov && ov.lineHeight) || '';
    el.style.color = (ov && ov.color) || '';
    el.style.textAlign = (ov && ov.textAlign) || '';
    el.style.width = (ov && ov.width) || '';
    el.style.height = (ov && ov.height) || '';
    if (ov && (ov.x || ov.y)) {
      el.style.transform = `translate(${ov.x || 0}px, ${ov.y || 0}px)`;
      el.classList.add('mc-positioned');
    } else {
      el.style.transform = '';
      el.classList.remove('mc-positioned');
    }
  }

  function applyElement(el) {
    if (!el) return;
    const id = el.dataset.editId;
    const ov = overrides[locale][id];
    const b = base.get(el);
    if (el.tagName === 'IMG') {
      el.src = (ov && ov.src) || (b && b.src) || el.getAttribute('src');
    } else {
      const text = (ov && typeof ov.text === 'string') ? ov.text : (b ? b[locale] : el.textContent);
      if (el.textContent !== text) el.textContent = text;
    }
    applyStyle(el, ov);
  }

  function applyAll() {
    editableEls.forEach(applyElement);
    document.documentElement.lang = locale;
    document.querySelectorAll('[data-lang-switch] button').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.lang === locale ? 'true' : 'false');
    });
    listeners.forEach((fn) => fn(locale));
  }

  function setLocale(l) {
    if (l !== 'fr' && l !== 'en') return;
    locale = l;
    localStorage.setItem('mc-lang', l);
    applyAll();
  }

  function onLocaleChange(fn) { listeners.push(fn); }

  function setOverridePatch(id, patch) {
    overrides[locale][id] = { ...(overrides[locale][id] || {}), ...patch };
    applyElement(document.querySelector(`[data-edit-id="${CSS.escape(id)}"]`));
  }

  async function persistOverride(id) {
    await MC_API.saveContent(theme, locale, id, overrides[locale][id] || {});
  }

  async function resetOverride(id) {
    delete overrides[locale][id];
    try { await MC_API.resetContent(theme, locale, id); } catch (e) { console.warn(e); }
    applyElement(document.querySelector(`[data-edit-id="${CSS.escape(id)}"]`));
  }

  async function init() {
    collectBase();
    await loadOverrides();
    applyAll();
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lang-switch] button');
      if (btn) setLocale(btn.dataset.lang);
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    getLocale: () => locale,
    getTheme: () => theme,
    setLocale,
    onLocaleChange,
    getOverride: (id) => overrides[locale][id],
    setOverridePatch,
    persistOverride,
    resetOverride,
    applyElement,
    getEditableEls: () => editableEls,
  };
})();
