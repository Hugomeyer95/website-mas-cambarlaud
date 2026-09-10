// Full-screen photo gallery + lightbox. Shared markup is injected once; images come from gallery-data.js.
(function () {
  function buildMarkup() {
    const overlay = document.createElement('div');
    overlay.className = 'mc-gallery-overlay';
    overlay.id = 'mc-gallery-overlay';
    overlay.innerHTML = `
      <div class="mc-gallery-head">
        <h2 data-fr="Galerie photos" data-en="Photo gallery">Galerie photos</h2>
        <button type="button" class="mc-gallery-close" id="mc-gallery-close" data-fr="Fermer" data-en="Close">Fermer</button>
      </div>
      <div class="mc-gallery-grid" id="mc-gallery-grid"></div>
    `;
    document.body.appendChild(overlay);

    const lightbox = document.createElement('div');
    lightbox.className = 'mc-lightbox';
    lightbox.id = 'mc-lightbox';
    lightbox.innerHTML = `
      <button type="button" class="lb-close" aria-label="Fermer">&times;</button>
      <button type="button" class="lb-prev" aria-label="Précédent">&lsaquo;</button>
      <img src="" alt="">
      <button type="button" class="lb-next" aria-label="Suivant">&rsaquo;</button>
      <p class="lb-cap"></p>
    `;
    document.body.appendChild(lightbox);
    return { overlay, lightbox };
  }

  function init() {
    const { overlay, lightbox } = buildMarkup();
    const grid = overlay.querySelector('#mc-gallery-grid');
    const images = window.MC_GALLERY_IMAGES || [];
    let currentIndex = 0;

    images.forEach((img, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const im = document.createElement('img');
      im.src = img.src;
      im.loading = 'lazy';
      im.alt = img.fr;
      btn.appendChild(im);
      btn.addEventListener('click', () => openLightbox(i));
      grid.appendChild(btn);
    });

    function locale() { return (window.MC_CONTENT && window.MC_CONTENT.getLocale()) || 'fr'; }

    function renderCaptions() {
      const l = locale();
      grid.querySelectorAll('img').forEach((im, i) => { im.alt = images[i][l]; });
    }

    function openGallery() {
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeGallery() {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }
    function openLightbox(i) {
      currentIndex = i;
      updateLightbox();
      lightbox.classList.add('open');
    }
    function updateLightbox() {
      const item = images[currentIndex];
      lightbox.querySelector('img').src = item.src;
      lightbox.querySelector('.lb-cap').textContent = item[locale()];
    }

    document.querySelectorAll('[data-open-gallery]').forEach((t) => {
      t.addEventListener('click', (e) => { e.preventDefault(); openGallery(); });
    });
    overlay.querySelector('#mc-gallery-close').addEventListener('click', closeGallery);
    lightbox.querySelector('.lb-close').addEventListener('click', () => lightbox.classList.remove('open'));
    lightbox.querySelector('.lb-prev').addEventListener('click', () => { currentIndex = (currentIndex - 1 + images.length) % images.length; updateLightbox(); });
    lightbox.querySelector('.lb-next').addEventListener('click', () => { currentIndex = (currentIndex + 1) % images.length; updateLightbox(); });

    document.addEventListener('keydown', (e) => {
      if (lightbox.classList.contains('open')) {
        if (e.key === 'Escape') lightbox.classList.remove('open');
        if (e.key === 'ArrowLeft') { currentIndex = (currentIndex - 1 + images.length) % images.length; updateLightbox(); }
        if (e.key === 'ArrowRight') { currentIndex = (currentIndex + 1) % images.length; updateLightbox(); }
      } else if (overlay.classList.contains('open') && e.key === 'Escape') {
        closeGallery();
      }
    });

    if (window.MC_CONTENT) window.MC_CONTENT.onLocaleChange(renderCaptions);
    renderCaptions();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
