# Mes Lectures

App perso de reviews de livres (style Letterboxd), à usage local sur ton Mac.

## Utilisation

Double-clique sur `index.html` (ou ouvre-le depuis ton navigateur : `Fichier > Ouvrir` / glisser-déposer dans la fenêtre). Aucune installation, aucun serveur à lancer.

Tes livres et notes sont stockés dans le navigateur (localStorage). Ouvre toujours l'app avec le **même navigateur** pour retrouver tes données — si tu changes de navigateur ou vides ses données, tu repars de zéro.

Les couvertures et photos d'auteur se remplissent automatiquement via Open Library dès que tu quittes le champ Titre/Auteur (nécessite une connexion internet) ; tu peux toujours coller une URL à la main via le bouton 🔍.

## Structure du projet

- `index.html`, `style.css`, `app.js` — l'application
