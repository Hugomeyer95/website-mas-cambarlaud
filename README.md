# Mas Cambarlaud — Site final

Ce dossier contient le site final (contrairement au dossier `../directions` qui reste le
comparatif des propositions créatives). Direction retenue : **Golden Hour**. Il comprend :

- **Traduction FR/EN** sur tout le contenu
- **Galerie photo** plein écran (toutes les photos de `public/assets/images`)
- **Réservation en ligne** : calendrier juillet/août, demande envoyée par email,
  validation admin qui bloque définitivement les dates
- **Mode édition visuelle** (bouton "Edit" à droite) : cliquez sur n'importe quel texte
  ou image pour changer la police, la taille, la couleur, la position, la taille, ou
  l'image elle-même. Protégé par mot de passe, sauvegardé en base de données.

Contrairement au reste du projet (pages HTML statiques), **ce site a besoin d'un petit
serveur Node.js** pour fonctionner : c'est lui qui envoie les emails de réservation,
mémorise durablement le calendrier, et sauvegarde les modifications faites avec le
bouton Edit. Un site 100 % statique ne peut faire ni l'un ni l'autre.

---

## 1. Installer Node.js (une seule fois)

Vérifiez si Node est déjà installé :

```bash
node --version
```

Si la commande n'est pas reconnue, installez Node.js (version 18 ou plus récente) :
téléchargez l'installeur sur **https://nodejs.org** (choisissez la version "LTS"), ou
via winget dans PowerShell :

```powershell
winget install OpenJS.NodeJS.LTS
```

Redémarrez votre terminal après l'installation.

## 2. Configurer le serveur

```bash
cd site-final/server
npm install
cp .env.example .env
```

Ouvrez `.env` et remplissez au minimum :

- `ADMIN_PASSWORD` — le mot de passe pour utiliser le bouton "Edit" et valider les
  réservations depuis le tableau de bord admin. Choisissez quelque chose de solide.
- `SESSION_SECRET` — une longue chaîne aléatoire quelconque (sert à sécuriser la
  connexion admin).
- `RESEND_API_KEY` — pour que les emails de réservation partent réellement. Créez un
  compte gratuit sur **https://resend.com**, vérifiez votre domaine d'envoi (ou utilisez
  temporairement `onboarding@resend.dev`, fourni par Resend pour démarrer sans domaine),
  puis générez une clé API dans leur tableau de bord.
- `OWNER_EMAIL` — la ou les adresses qui reçoivent les demandes de réservation.
  Plusieurs destinataires se déclarent séparés par des virgules, par exemple
  `hugomeyer95@gmail.com,jph@chemint.fr`.

Tant que `RESEND_API_KEY` n'est pas renseigné, le serveur fonctionne quand même : les
emails sont simplement affichés dans le terminal au lieu d'être envoyés (pratique pour
tester sans compte Resend).

## 3. Lancer le site

```powershell
cd site-final\server
npm.cmd start
```

Puis ouvrez **http://localhost:3000** — le site s'affiche directement.

Le mode développement (`npm.cmd run dev`) redémarre automatiquement le serveur quand
vous modifiez un fichier dans `server/src`.

## 4. Arrêter et redémarrer le serveur

**Arrêter** — si le serveur tourne dans le terminal actif, appuyez sur **Ctrl+C**.

Si le terminal est fermé ou que le serveur tourne en arrière-plan, trouvez le processus
qui occupe le port 3000 et tuez-le :

```powershell
netstat -ano | findstr :3000
```

Repérez le PID dans la dernière colonne (ex. `12345`), puis :

```powershell
taskkill /PID 12345 /F
```

**Redémarrer** — une fois arrêté, relancez simplement :

```powershell
cd site-final\server
npm.cmd start
```

> **Note :** si vous venez de modifier le fichier `.env`, un redémarrage est obligatoire
> pour que les nouvelles valeurs soient prises en compte (ex. changement de mot de passe,
> d'adresse email, ou de clé API).

---

## Comment fonctionne la réservation

Le calendrier n'affiche que deux états : **Disponible** et **Occupé**.

1. Un visiteur choisit des dates (juillet ou août uniquement) et envoie sa demande.
   Les dates restent **affichées comme disponibles** jusqu'à validation — plusieurs
   personnes peuvent demander la même période, c'est l'hôte qui tranche.
2. Un email part automatiquement à `OWNER_EMAIL` avec les coordonnées du voyageur, son
   message, et deux boutons **Valider** / **Refuser**.
3. En cliquant sur **Valider**, les dates passent en **Occupé** sur le calendrier
   (stockées dans la base de données du serveur) et le voyageur reçoit un email de
   confirmation. **Refuser** ne bloque rien — les dates restent disponibles.
4. L'hôte peut **changer de décision à tout moment** : cliquer sur "Valider" après un
   refus rouvre le créneau pour ce voyageur ; cliquer sur "Refuser" après une validation
   libère à nouveau les dates sur le calendrier.
5. Toutes les demandes (passées, en attente, validées) restent consultables via
   l'API admin `/api/admin/bookings` (protégée par mot de passe).

Les mois autres que juillet et août ne sont jamais proposés à la réservation.

## Comment fonctionne le mode édition

1. Cliquez sur le bouton **Edit** à droite de l'écran, entrez le mot de passe admin.
2. Survolez le site : chaque texte et chaque image modifiable s'entoure d'un pointillé.
   Cliquez dessus pour ouvrir le panneau d'édition à droite :
   - **Texte** : modifiez le contenu, la police, la taille, la graisse, la couleur,
     l'alignement.
   - **Image** : remplacez-la par une photo déjà présente dans la galerie, ou
     téléversez une nouvelle image depuis votre ordinateur.
3. Cliquez-glissez un élément sélectionné pour le déplacer ; utilisez la petite
   poignée en bas à droite de l'élément pour le redimensionner.
4. Chaque changement est sauvegardé automatiquement et devient visible pour tous les
   visiteurs. Le bouton "Réinitialiser" dans le panneau annule une modification et
   revient au contenu d'origine.

Les modifications sont enregistrées **par langue** : si vous éditez en français, cela
ne change pas la version anglaise (et inversement) — pratique pour corriger une
traduction sans toucher au texte français.

---

## Déploiement en production

Ce serveur doit tourner en continu (ce n'est pas un site statique) : un hébergeur de
fichiers ne suffit pas. Des options simples et abordables :

- **Render.com** ou **Railway.app** — déploiement direct depuis ce dossier `server/`,
  gratuit ou très peu cher pour ce niveau de trafic, gère le redémarrage automatique.
- Un petit VPS (ex. OVH, Hetzner) avec Node.js installé et `pm2` pour garder le
  serveur actif.

Dans tous les cas :
1. Configurez les mêmes variables d'environnement que dans `.env` (jamais dans le code).
2. Mettez à jour `PUBLIC_URL` dans `.env` avec l'URL réelle du site (utilisée dans les
   liens de validation envoyés par email).
3. Le dossier `server/data/` contient le fichier `store.json` (réservations et
   contenu édité) — pensez à le sauvegarder régulièrement une fois en production.

## Structure du projet

```
site-final/
  server/              backend Node.js (Express + emails)
    src/
      index.js          point d'entrée du serveur
      db.js              stockage des données (fichier JSON, pas de dépendance native)
      email.js           envoi des emails (Resend)
      routes/            booking.js, admin.js, content.js
      middleware/auth.js session admin
    .env.example
  public/              tout ce qui est servi au navigateur
    index.html          le site (direction Golden Hour)
    shared/
      css/shared.css    galerie, réservation, éditeur
      js/               api.js, content-engine.js, gallery.js, booking.js, editor.js
    assets/images/      photos (dossier "assets" du projet + nouvelles photos fournies)
    assets/uploads/     images téléversées depuis le mode édition
```

## Photo de la piscine à remplacer

La section piscine utilise toujours `pool-main.jpg` (aucune nouvelle photo de piscine
n'a été fournie dans `MC_Images`). Dès que vous avez la nouvelle photo, remplacez-la
simplement via le mode édition (cliquez sur la photo piscine → téléverser), ou déposez
le fichier dans `public/assets/images/` et mettez à jour la référence.
