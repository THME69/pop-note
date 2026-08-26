# PopNote

Suivi de collection par profil (livres, BD, films, séries, animé, jeux vidéo,
jeux de société), avec hub, activité récente, top de la semaine, kiosque et
coup de cœur.

## Lancer le site en local

```bash
cd pop-note
python3 server.py 8080
```

Puis ouvre http://localhost:8080

Le serveur sert l'ensemble du site (fichiers statiques uniquement). Aucune
dépendance à installer. Les données sont stockées dans le navigateur
(`localStorage`) ou, si configuré dans Réglages, dans un dépôt GitHub via son
API.
