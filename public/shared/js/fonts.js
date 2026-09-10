// Shared font library for the visual editor. Fonts are loaded from Google Fonts on demand
// (only when actually selected/applied) so the public site never pays for 50+ font families
// up front — this file just declares what's available and loads them lazily.
window.MC_FONTS = (function () {
  const GOOGLE_FONTS = [
    // ---- Serif ----
    { label: 'Playfair Display', css: '"Playfair Display", serif', google: 'Playfair+Display', group: 'Serif' },
    { label: 'Cormorant Garamond', css: '"Cormorant Garamond", serif', google: 'Cormorant+Garamond', group: 'Serif' },
    { label: 'EB Garamond', css: '"EB Garamond", serif', google: 'EB+Garamond', group: 'Serif' },
    { label: 'Lora', css: '"Lora", serif', google: 'Lora', group: 'Serif' },
    { label: 'Merriweather', css: '"Merriweather", serif', google: 'Merriweather', group: 'Serif' },
    { label: 'Libre Baskerville', css: '"Libre Baskerville", serif', google: 'Libre+Baskerville', group: 'Serif' },
    { label: 'Crimson Text', css: '"Crimson Text", serif', google: 'Crimson+Text', group: 'Serif' },
    { label: 'Cormorant', css: '"Cormorant", serif', google: 'Cormorant', group: 'Serif' },
    { label: 'Spectral', css: '"Spectral", serif', google: 'Spectral', group: 'Serif' },
    { label: 'Source Serif 4', css: '"Source Serif 4", serif', google: 'Source+Serif+4', group: 'Serif' },
    { label: 'PT Serif', css: '"PT Serif", serif', google: 'PT+Serif', group: 'Serif' },
    { label: 'Domine', css: '"Domine", serif', google: 'Domine', group: 'Serif' },
    { label: 'Bitter', css: '"Bitter", serif', google: 'Bitter', group: 'Serif' },
    { label: 'Newsreader', css: '"Newsreader", serif', google: 'Newsreader', group: 'Serif' },
    { label: 'Fraunces', css: '"Fraunces", serif', google: 'Fraunces', group: 'Serif' },
    { label: 'Instrument Serif', css: '"Instrument Serif", serif', google: 'Instrument+Serif', group: 'Serif' },

    // ---- Display & decorative serif ----
    { label: 'Abril Fatface', css: '"Abril Fatface", serif', google: 'Abril+Fatface', group: 'Display' },
    { label: 'Bodoni Moda', css: '"Bodoni Moda", serif', google: 'Bodoni+Moda', group: 'Display' },
    { label: 'DM Serif Display', css: '"DM Serif Display", serif', google: 'DM+Serif+Display', group: 'Display' },
    { label: 'Marcellus', css: '"Marcellus", serif', google: 'Marcellus', group: 'Display' },
    { label: 'Italiana', css: '"Italiana", serif', google: 'Italiana', group: 'Display' },
    { label: 'Cinzel', css: '"Cinzel", serif', google: 'Cinzel', group: 'Display' },
    { label: 'Prata', css: '"Prata", serif', google: 'Prata', group: 'Display' },
    { label: 'Yeseva One', css: '"Yeseva One", serif', google: 'Yeseva+One', group: 'Display' },
    { label: 'Rozha One', css: '"Rozha One", serif', google: 'Rozha+One', group: 'Display' },
    { label: 'Unna', css: '"Unna", serif', google: 'Unna', group: 'Display' },

    // ---- Sans-serif ----
    { label: 'Inter', css: '"Inter", sans-serif', google: 'Inter', group: 'Sans-serif' },
    { label: 'Poppins', css: '"Poppins", sans-serif', google: 'Poppins', group: 'Sans-serif' },
    { label: 'Montserrat', css: '"Montserrat", sans-serif', google: 'Montserrat', group: 'Sans-serif' },
    { label: 'Raleway', css: '"Raleway", sans-serif', google: 'Raleway', group: 'Sans-serif' },
    { label: 'Work Sans', css: '"Work Sans", sans-serif', google: 'Work+Sans', group: 'Sans-serif' },
    { label: 'Manrope', css: '"Manrope", sans-serif', google: 'Manrope', group: 'Sans-serif' },
    { label: 'Karla', css: '"Karla", sans-serif', google: 'Karla', group: 'Sans-serif' },
    { label: 'Jost', css: '"Jost", sans-serif', google: 'Jost', group: 'Sans-serif' },
    { label: 'Nunito Sans', css: '"Nunito Sans", sans-serif', google: 'Nunito+Sans', group: 'Sans-serif' },
    { label: 'Mulish', css: '"Mulish", sans-serif', google: 'Mulish', group: 'Sans-serif' },
    { label: 'Outfit', css: '"Outfit", sans-serif', google: 'Outfit', group: 'Sans-serif' },
    { label: 'Sora', css: '"Sora", sans-serif', google: 'Sora', group: 'Sans-serif' },
    { label: 'Archivo', css: '"Archivo", sans-serif', google: 'Archivo', group: 'Sans-serif' },
    { label: 'Space Grotesk', css: '"Space Grotesk", sans-serif', google: 'Space+Grotesk', group: 'Sans-serif' },
    { label: 'IBM Plex Sans', css: '"IBM Plex Sans", sans-serif', google: 'IBM+Plex+Sans', group: 'Sans-serif' },

    // ---- Bold display sans ----
    { label: 'Anton', css: '"Anton", sans-serif', google: 'Anton', group: 'Display sans' },
    { label: 'Bebas Neue', css: '"Bebas Neue", sans-serif', google: 'Bebas+Neue', group: 'Display sans' },
    { label: 'Oswald', css: '"Oswald", sans-serif', google: 'Oswald', group: 'Display sans' },
    { label: 'Archivo Black', css: '"Archivo Black", sans-serif', google: 'Archivo+Black', group: 'Display sans' },
    { label: 'Big Shoulders Display', css: '"Big Shoulders Display", sans-serif', google: 'Big+Shoulders+Display', group: 'Display sans' },
    { label: 'Syne', css: '"Syne", sans-serif', google: 'Syne', group: 'Display sans' },

    // ---- Script & handwriting ----
    { label: 'Great Vibes', css: '"Great Vibes", cursive', google: 'Great+Vibes', group: 'Script' },
    { label: 'Parisienne', css: '"Parisienne", cursive', google: 'Parisienne', group: 'Script' },
    { label: 'Dancing Script', css: '"Dancing Script", cursive', google: 'Dancing+Script', group: 'Script' },
    { label: 'Sacramento', css: '"Sacramento", cursive', google: 'Sacramento', group: 'Script' },
    { label: 'Allura', css: '"Allura", cursive', google: 'Allura', group: 'Script' },
    { label: 'Petit Formal Script', css: '"Petit Formal Script", cursive', google: 'Petit+Formal+Script', group: 'Script' },

    // ---- Monospace ----
    { label: 'IBM Plex Mono', css: '"IBM Plex Mono", monospace', google: 'IBM+Plex+Mono', group: 'Monospace' },
    { label: 'JetBrains Mono', css: '"JetBrains Mono", monospace', google: 'JetBrains+Mono', group: 'Monospace' },
    { label: 'Space Mono', css: '"Space Mono", monospace', google: 'Space+Mono', group: 'Monospace' },
    { label: 'Courier Prime', css: '"Courier Prime", monospace', google: 'Courier+Prime', group: 'Monospace' },

    // ---- System (no loading needed) ----
    { label: 'Georgia (système)', css: 'Georgia, serif', google: null, group: 'Système' },
    { label: 'Times New Roman (système)', css: '"Times New Roman", serif', google: null, group: 'Système' },
    { label: 'Helvetica / Arial (système)', css: 'Helvetica, Arial, sans-serif', google: null, group: 'Système' },
    { label: 'Courier New (système)', css: '"Courier New", monospace', google: null, group: 'Système' },
  ];

  const loaded = new Set();

  function ensureLoaded(cssFamilyValue) {
    if (!cssFamilyValue) return;
    const entry = GOOGLE_FONTS.find((f) => f.css === cssFamilyValue);
    if (!entry || !entry.google || loaded.has(entry.google)) return;
    loaded.add(entry.google);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${entry.google}:wght@300;400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }

  function preloadAllFontFamiliesInOverrides(overridesByLocale) {
    Object.values(overridesByLocale || {}).forEach((byId) => {
      Object.values(byId || {}).forEach((data) => {
        if (data && data.fontFamily) ensureLoaded(data.fontFamily);
      });
    });
  }

  return { GOOGLE_FONTS, ensureLoaded, preloadAllFontFamiliesInOverrides };
})();
