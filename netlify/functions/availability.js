// Sert les dates bloquées en lisant le fichier directement sur GitHub.
// Le fichier statique /data/blocked-dates.json n'est publié qu'après un rebuild
// Netlify (~1-2 min) : passer par l'API donne au calendrier l'état réel dès
// qu'une réservation est approuvée, sans attendre le déploiement.

const GITHUB_REPO = process.env.GITHUB_REPO || 'Hugomeyer95/website-mas-cambarlaud';
const BLOCKED_DATES_PATH = 'public/data/blocked-dates.json';

exports.handler = async () => {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, must-revalidate',
  };

  if (!process.env.GITHUB_TOKEN) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'GITHUB_TOKEN manquant.' }) };
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${BLOCKED_DATES_PATH}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          // .raw renvoie le contenu du fichier tel quel plutôt qu'encodé en base64
          Accept: 'application/vnd.github.raw+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Cache-Control': 'no-cache',
        },
      }
    );
    if (!res.ok) throw new Error(`GitHub a répondu ${res.status}`);

    const ranges = JSON.parse(await res.text());
    if (!Array.isArray(ranges)) throw new Error('Format inattendu : tableau attendu.');

    return { statusCode: 200, headers, body: JSON.stringify(ranges) };
  } catch (err) {
    console.error('availability:', err);
    return { statusCode: 502, headers, body: JSON.stringify({ error: err.message }) };
  }
};
