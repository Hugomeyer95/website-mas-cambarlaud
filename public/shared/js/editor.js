// Visual "Edit" overlay: click an element to edit its text/font/color, drag to reposition,
// resize via a handle, swap images. Requires admin login (password gate). Persists via MC_API.
(function () {
  let active = false;
  let selectedEl = null;
  let panel, toggleBtn, loginModal;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function buildToggle() {
    toggleBtn = el('button', 'mc-edit-toggle');
    toggleBtn.type = 'button';
    toggleBtn.textContent = 'Edit';
    toggleBtn.title = 'Activer le mode édition';
    document.body.appendChild(toggleBtn);
    toggleBtn.addEventListener('click', onToggleClick);
  }

  function buildLoginModal() {
    loginModal = el('div', 'mc-edit-login', `
      <form class="mc-edit-login-card">
        <h3>Mode édition</h3>
        <p>Entrez le mot de passe administrateur pour modifier ce site.</p>
        <input type="password" name="password" autocomplete="current-password" placeholder="Mot de passe">
        <p class="mc-edit-login-error" hidden></p>
        <div class="mc-edit-login-actions">
          <button type="button" class="mc-btn-ghost" data-cancel>Annuler</button>
          <button type="submit" class="mc-btn-solid">Se connecter</button>
        </div>
      </form>
    `);
    document.body.appendChild(loginModal);
    loginModal.addEventListener('click', (e) => { if (e.target === loginModal) closeLogin(); });
    loginModal.querySelector('[data-cancel]').addEventListener('click', closeLogin);
    loginModal.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = loginModal.querySelector('input[name=password]').value;
      const errorEl = loginModal.querySelector('.mc-edit-login-error');
      try {
        await MC_API.login(pw);
        closeLogin();
        enterEditMode();
      } catch (err) {
        errorEl.textContent = err.message || 'Mot de passe incorrect.';
        errorEl.hidden = false;
      }
    });
  }

  function openLogin() {
    loginModal.classList.add('open');
    loginModal.querySelector('input').value = '';
    loginModal.querySelector('.mc-edit-login-error').hidden = true;
    setTimeout(() => loginModal.querySelector('input').focus(), 50);
  }
  function closeLogin() { loginModal.classList.remove('open'); }

  async function onToggleClick() {
    if (active) { exitEditMode(); return; }
    try {
      const { authenticated } = await MC_API.session();
      if (authenticated) enterEditMode();
      else openLogin();
    } catch {
      openLogin();
    }
  }

  function enterEditMode() {
    active = true;
    document.body.classList.add('mc-edit-active');
    toggleBtn.textContent = 'Terminer';
    toggleBtn.classList.add('is-active');
    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('mouseover', onHover);
    document.addEventListener('mouseout', onUnhover);
  }

  function exitEditMode() {
    active = false;
    selectDeselect();
    document.body.classList.remove('mc-edit-active');
    toggleBtn.textContent = 'Edit';
    toggleBtn.classList.remove('is-active');
    document.removeEventListener('click', onDocumentClick, true);
    document.removeEventListener('mouseover', onHover);
    document.removeEventListener('mouseout', onUnhover);
  }

  function onHover(e) {
    if (!active) return;
    const target = e.target.closest('[data-edit-id]');
    if (target) target.classList.add('mc-edit-hover');
  }
  function onUnhover(e) {
    const target = e.target.closest('[data-edit-id]');
    if (target) target.classList.remove('mc-edit-hover');
  }

  function onDocumentClick(e) {
    if (!active) return;
    if (e.target.closest('.mc-edit-panel') || e.target.closest('.mc-edit-toggle')) return;
    const target = e.target.closest('[data-edit-id]');
    if (!target) { selectDeselect(); return; }
    e.preventDefault();
    e.stopPropagation();
    selectElement(target);
  }

  function selectDeselect() {
    if (selectedEl) selectedEl.classList.remove('mc-edit-selected');
    selectedEl = null;
    if (panel) panel.classList.remove('open');
  }

  function selectElement(elToSelect) {
    if (selectedEl) selectedEl.classList.remove('mc-edit-selected');
    selectedEl = elToSelect;
    selectedEl.classList.add('mc-edit-selected');
    openPanelFor(selectedEl);
    makeDraggableResizable(selectedEl);
  }

  // ---------- Panel ----------
  function buildPanel() {
    panel = el('div', 'mc-edit-panel');
    document.body.appendChild(panel);
  }

  function fieldRow(labelText, inputEl) {
    const row = el('label', 'mc-edit-row');
    row.appendChild(el('span', null, labelText));
    row.appendChild(inputEl);
    return row;
  }

  function openPanelFor(target) {
    const id = target.dataset.editId;
    const isImage = target.tagName === 'IMG';
    const theme = MC_CONTENT.getTheme();
    const locale = MC_CONTENT.getLocale();
    const currentOverride = MC_CONTENT.getOverride(id) || {};

    panel.innerHTML = '';
    panel.appendChild(el('div', 'mc-edit-panel-head', `<strong>${isImage ? 'Image' : 'Texte'}</strong><span class="mc-edit-id">${id}</span>`));

    if (isImage) {
      buildImagePanel(target, id, currentOverride);
    } else {
      buildTextPanel(target, id, currentOverride);
    }

    const actions = el('div', 'mc-edit-panel-actions');
    const resetBtn = el('button', 'mc-btn-ghost', 'Réinitialiser');
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', async () => {
      await MC_CONTENT.resetOverride(id);
      openPanelFor(target);
    });
    const closeBtn = el('button', 'mc-btn-ghost', 'Fermer');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', selectDeselect);
    actions.appendChild(resetBtn);
    actions.appendChild(closeBtn);
    panel.appendChild(actions);

    panel.classList.add('open');
  }

  async function patchAndSave(id, patch) {
    MC_CONTENT.setOverridePatch(id, patch);
    try {
      await MC_CONTENT.persistOverride(id);
    } catch (err) {
      console.error('Échec de la sauvegarde', err);
    }
  }

  function buildTextPanel(target, id, ov) {
    const textArea = el('textarea', 'mc-edit-text');
    textArea.value = target.textContent;
    textArea.rows = 3;
    textArea.addEventListener('input', () => {
      target.textContent = textArea.value;
    });
    textArea.addEventListener('change', () => patchAndSave(id, { text: textArea.value }));
    panel.appendChild(fieldRow('Contenu', textArea));

    // ---- Bold / Italic / Underline / Strikethrough toolbar ----
    const decoParts = (ov.textDecoration || '').split(' ').filter(Boolean);
    const toolbar = el('div', 'mc-edit-toolbar');
    const boldBtn = toolbarToggle('B', 'Gras', ov.fontWeight === '700', (isOn) => {
      const value = isOn ? '700' : '';
      target.style.fontWeight = value;
      patchAndSave(id, { fontWeight: value });
    });
    boldBtn.style.fontWeight = '700';
    const italicBtn = toolbarToggle('I', 'Italique', ov.fontStyle === 'italic', (isOn) => {
      const value = isOn ? 'italic' : '';
      target.style.fontStyle = value;
      patchAndSave(id, { fontStyle: value });
    });
    italicBtn.style.fontStyle = 'italic';
    const underlineBtn = toolbarToggle('U', 'Souligné', decoParts.includes('underline'), (isOn) => {
      const parts = new Set(decoParts);
      isOn ? parts.add('underline') : parts.delete('underline');
      const value = Array.from(parts).join(' ');
      target.style.textDecorationLine = value;
      patchAndSave(id, { textDecoration: value });
      decoParts.length = 0; decoParts.push(...parts);
    });
    underlineBtn.style.textDecoration = 'underline';
    const strikeBtn = toolbarToggle('S', 'Barré', decoParts.includes('line-through'), (isOn) => {
      const parts = new Set(decoParts);
      isOn ? parts.add('line-through') : parts.delete('line-through');
      const value = Array.from(parts).join(' ');
      target.style.textDecorationLine = value;
      patchAndSave(id, { textDecoration: value });
      decoParts.length = 0; decoParts.push(...parts);
    });
    strikeBtn.style.textDecoration = 'line-through';
    [boldBtn, italicBtn, underlineBtn, strikeBtn].forEach((b) => toolbar.appendChild(b));
    panel.appendChild(fieldRow('Style', toolbar));

    // ---- Font family (50+, grouped) ----
    const fontSelect = el('select');
    const noneOpt = el('option', null, 'Police par défaut du site');
    noneOpt.value = '';
    fontSelect.appendChild(noneOpt);
    const fonts = (window.MC_FONTS && window.MC_FONTS.GOOGLE_FONTS) || [];
    const groups = {};
    fonts.forEach((f) => { (groups[f.group] = groups[f.group] || []).push(f); });
    Object.keys(groups).forEach((groupName) => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = groupName;
      groups[groupName].forEach((f) => {
        const opt = el('option', null, f.label);
        opt.value = f.css;
        if (ov.fontFamily === f.css) opt.selected = true;
        optgroup.appendChild(opt);
      });
      fontSelect.appendChild(optgroup);
    });
    fontSelect.addEventListener('change', () => {
      if (window.MC_FONTS) window.MC_FONTS.ensureLoaded(fontSelect.value);
      target.style.fontFamily = fontSelect.value;
      patchAndSave(id, { fontFamily: fontSelect.value });
    });
    panel.appendChild(fieldRow(`Police (${fonts.length}+ disponibles)`, fontSelect));

    // ---- Font size slider ----
    sliderRow(panel, {
      label: 'Taille du texte',
      min: 10, max: 140, step: 1,
      value: parseInt(ov.fontSize, 10) || Math.round(parseFloat(getComputedStyle(target).fontSize)) || 16,
      format: (v) => `${v}px`,
      onChange: (v) => { target.style.fontSize = `${v}px`; },
      onCommit: (v) => patchAndSave(id, { fontSize: `${v}px` }),
    });

    // ---- Letter spacing slider ----
    sliderRow(panel, {
      label: 'Espacement des lettres',
      min: -5, max: 30, step: 1,
      value: ov.letterSpacing ? Math.round(parseFloat(ov.letterSpacing) * 100) : 0,
      format: (v) => `${(v / 100).toFixed(2)}em`,
      onChange: (v) => { target.style.letterSpacing = `${v / 100}em`; },
      onCommit: (v) => patchAndSave(id, { letterSpacing: `${v / 100}em` }),
    });

    // ---- Line height slider ----
    sliderRow(panel, {
      label: 'Interligne',
      min: 0.9, max: 2.4, step: 0.05,
      value: ov.lineHeight ? parseFloat(ov.lineHeight) : (parseFloat(getComputedStyle(target).lineHeight) / parseFloat(getComputedStyle(target).fontSize)) || 1.4,
      format: (v) => v.toFixed(2),
      onChange: (v) => { target.style.lineHeight = String(v); },
      onCommit: (v) => patchAndSave(id, { lineHeight: String(v) }),
    });

    // ---- Colour ----
    const colorInput = el('input');
    colorInput.type = 'color';
    colorInput.value = rgbToHex(ov.color) || '#000000';
    colorInput.addEventListener('input', () => { target.style.color = colorInput.value; });
    colorInput.addEventListener('change', () => patchAndSave(id, { color: colorInput.value }));
    panel.appendChild(fieldRow('Couleur', colorInput));

    // ---- Alignment ----
    const alignGroup = el('div', 'mc-edit-toolbar');
    [['', 'Défaut', 'Auto'], ['left', 'Gauche', 'G'], ['center', 'Centré', 'C'], ['right', 'Droite', 'D'], ['justify', 'Justifié', 'J']].forEach(([v, l, short]) => {
      const btn = el('button', 'mc-toolbar-btn', short);
      btn.type = 'button';
      btn.title = l;
      if ((ov.textAlign || '') === v) btn.classList.add('active');
      btn.addEventListener('click', () => {
        alignGroup.querySelectorAll('.mc-toolbar-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        target.style.textAlign = v;
        patchAndSave(id, { textAlign: v });
      });
      alignGroup.appendChild(btn);
    });
    panel.appendChild(fieldRow('Alignement', alignGroup));

    panel.appendChild(el('p', 'mc-edit-hint', 'Astuce : cliquez-glissez l\'élément sur la page pour le déplacer, ou utilisez la poignée en bas à droite pour le redimensionner.'));
  }

  function toolbarToggle(label, title, isActive, onToggle) {
    const btn = el('button', 'mc-toolbar-btn', label);
    btn.type = 'button';
    btn.title = title;
    if (isActive) btn.classList.add('active');
    btn.addEventListener('click', () => {
      const isOn = !btn.classList.contains('active');
      btn.classList.toggle('active', isOn);
      onToggle(isOn);
    });
    return btn;
  }

  function sliderRow(panel, { label, min, max, step, value, format, onChange, onCommit }) {
    const row = el('div', 'mc-edit-row');
    const head = el('div', 'mc-slider-head');
    const labelSpan = el('span', null, label);
    const valueSpan = el('span', 'mc-slider-value', format(value));
    head.appendChild(labelSpan);
    head.appendChild(valueSpan);
    row.appendChild(head);
    const input = el('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      valueSpan.textContent = format(v);
      onChange(v);
    });
    input.addEventListener('change', () => onCommit(parseFloat(input.value)));
    row.appendChild(input);
    panel.appendChild(row);
    return row;
  }

  function buildImagePanel(target, id, ov) {
    const preview = el('img', 'mc-edit-img-preview');
    preview.src = target.src;
    panel.appendChild(preview);

    const grid = el('div', 'mc-edit-img-grid');
    (window.MC_GALLERY_IMAGES || []).forEach((img) => {
      const thumb = el('button', 'mc-edit-img-thumb');
      thumb.type = 'button';
      thumb.innerHTML = `<img src="${img.src}" alt="">`;
      thumb.addEventListener('click', () => {
        target.src = img.src;
        preview.src = img.src;
        patchAndSave(id, { src: img.src });
      });
      grid.appendChild(thumb);
    });
    panel.appendChild(fieldRow('Choisir dans la galerie', grid));

    const uploadLabel = el('label', 'mc-edit-upload');
    const uploadInput = el('input');
    uploadInput.type = 'file';
    uploadInput.accept = 'image/*';
    uploadLabel.appendChild(el('span', null, 'Téléverser une nouvelle image'));
    uploadLabel.appendChild(uploadInput);
    uploadInput.addEventListener('change', async () => {
      const file = uploadInput.files[0];
      if (!file) return;
      try {
        const { url } = await MC_API.uploadImage(file);
        target.src = url;
        preview.src = url;
        await patchAndSave(id, { src: url });
      } catch (err) {
        alert(err.message || 'Échec du téléversement.');
      }
    });
    panel.appendChild(uploadLabel);

    panel.appendChild(el('p', 'mc-edit-hint', 'Astuce : cliquez-glissez l\'image sur la page pour la déplacer, ou utilisez la poignée en bas à droite pour la redimensionner.'));
  }

  function rgbToHex(v) {
    if (!v) return null;
    if (v.startsWith('#')) return v;
    return null;
  }

  // ---------- Drag & resize ----------
  function makeDraggableResizable(target) {
    if (target.dataset.mcDraggable) return;
    target.dataset.mcDraggable = '1';

    let dragging = false;
    let startX, startY, origX, origY;

    target.addEventListener('mousedown', (e) => {
      if (!active || selectedEl !== target) return;
      if (e.target.closest('.mc-resize-handle')) return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      const ov = MC_CONTENT.getOverride(target.dataset.editId) || {};
      origX = ov.x || 0; origY = ov.y || 0;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      target.style.transform = `translate(${origX + dx}px, ${origY + dy}px)`;
      target.classList.add('mc-positioned');
    });

    document.addEventListener('mouseup', (e) => {
      if (!dragging) return;
      dragging = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const id = target.dataset.editId;
      patchAndSave(id, { x: origX + dx, y: origY + dy });
    });

    if (!target.querySelector(':scope > .mc-resize-handle')) {
      const handle = el('span', 'mc-resize-handle');
      target.style.position = target.style.position || 'relative';
      target.appendChild(handle);
      let resizing = false;
      let startW, startH;
      handle.addEventListener('mousedown', (e) => {
        resizing = true;
        startX = e.clientX; startY = e.clientY;
        const rect = target.getBoundingClientRect();
        startW = rect.width; startH = rect.height;
        e.preventDefault();
        e.stopPropagation();
      });
      document.addEventListener('mousemove', (e) => {
        if (!resizing) return;
        const w = Math.max(40, startW + (e.clientX - startX));
        const h = Math.max(24, startH + (e.clientY - startY));
        target.style.width = w + 'px';
        target.style.height = h + 'px';
      });
      document.addEventListener('mouseup', () => {
        if (!resizing) return;
        resizing = false;
        const id = target.dataset.editId;
        patchAndSave(id, { width: target.style.width, height: target.style.height });
      });
    }
  }

  function init() {
    buildToggle();
    buildLoginModal();
    buildPanel();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
