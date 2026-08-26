// Recherche externe par catégorie, pour l'auto-complétion des formulaires d'ajout.
// Chaque fonction renvoie un tableau normalisé : [{ externalId, titre, annee, image, images, extra }]
// TMDB et RAWG demandent une clé API perso (gratuite), à renseigner dans reglages.html.
// BGG n'a pas de clé mais son API ne renvoie pas toujours d'en-têtes CORS : en cas
// d'échec, l'ajout manuel reste possible.

// Interroge une source et avale ses erreurs (clé absente, service en panne,
// timeout...) pour ne jamais bloquer les sources suivantes.
async function trySource(fn) {
  try {
    return await fn();
  } catch (e) {
    console.error("Source de recherche indisponible", e);
    return [];
  }
}

// L'API MediaWiki (avec redirects=1) renvoie les pages sous leur titre
// RÉSOLU, pas sous le titre demandé (ex. on demande "Dark Vador", la réponse
// arrive sous "Anakin Skywalker" — les deux articles ayant été fusionnés).
// Sans ça, une bonne partie des personnages/œuvres passant par une redirection
// se retrouveraient à tort sans image. On reconstruit ici l'index par titre
// demandé, en suivant `query.redirects` (et `query.normalized`, pour les
// différences d'espaces/casse).
function indexPagesByRequestedTitle(query, requestedTitles) {
  const resolvedTitleOf = {};
  (query.normalized || []).forEach((n) => { resolvedTitleOf[n.from] = n.to; });
  (query.redirects || []).forEach((r) => { resolvedTitleOf[r.from] = r.to; });
  const pageByResolvedTitle = {};
  Object.values(query.pages || {}).forEach((p) => { pageByResolvedTitle[p.title] = p; });
  const result = {};
  requestedTitles.forEach((t) => {
    const resolved = resolvedTitleOf[t] || t;
    const page = pageByResolvedTitle[resolved];
    if (page) result[t] = page;
  });
  return result;
}

function mergeUnique(base, extra) {
  const seen = new Set(base.map((r) => r.titre.toLowerCase()));
  extra.forEach((r) => {
    if (r.titre && !seen.has(r.titre.toLowerCase())) {
      seen.add(r.titre.toLowerCase());
      base.push(r);
    }
  });
  return base;
}

// Wikipédia recherche dans tout le site, toutes catégories confondues : sans
// filtre, chercher un livre peut très bien remonter le film ou le jeu vidéo du
// même nom. On se sert de la précision entre parenthèses que Wikipédia ajoute
// pour désambiguïser (ex. "Dune (film, 2021)") pour écarter ce qui appartient
// clairement à une AUTRE catégorie, tout en gardant les titres non précisés
// (la plupart des livres/BD n'ont pas de suffixe du tout).
const WIKI_DISAMBIG_MARKERS = {
  livres: ["roman", "livre", "récit", "recueil", "essai", "conte", "nouvelle"],
  bd: ["bande dessinée", "manga", "comics"],
  films: ["film"],
  series: ["série télévisée", "série d'animation", "feuilleton"],
  anime: ["anime", "animation japonaise", "OAV", "OVA"],
  jeuxVideo: ["jeu vidéo"],
  jeuxSociete: ["jeu de société", "jeu de plateau"],
};
// BD et Animé partagent souvent la même œuvre/franchise (le manga source et
// son adaptation animée) : Wikipédia décrit fréquemment l'ensemble sous une
// seule fiche ("série de mangas..."). Les traiter comme mutuellement
// exclusives ferait disparaître Death Note d'une recherche Animé simplement
// parce que sa fiche parle de "manga" — on les laisse donc se chevaucher.
const WIKI_CATEGORY_OVERLAP = { anime: ["bd"], bd: ["anime"] };
function textMatchesCategory(text, cat) {
  const lower = text.toLowerCase();
  const ownMarkers = WIKI_DISAMBIG_MARKERS[cat] || [];
  if (ownMarkers.some((k) => lower.includes(k))) return true;
  const compatible = new Set([cat, ...(WIKI_CATEGORY_OVERLAP[cat] || [])]);
  const otherMarkers = Object.entries(WIKI_DISAMBIG_MARKERS)
    .filter(([c]) => !compatible.has(c))
    .flatMap(([, markers]) => markers);
  return !otherMarkers.some((k) => lower.includes(k));
}
// Précision entre parenthèses à la fin du titre (ex. "(film, 2021)") — filet
// de secours quand l'article n'a pas de description courte exploitable.
function extractDisambig(title) {
  const m = title.match(/\(([^)]+)\)\s*$/);
  return m ? m[1] : null;
}
function wikiTitleMatchesCategory(title, cat) {
  const disambig = extractDisambig(title);
  if (!disambig) return true; // pas de précision : impossible de savoir, on garde
  return textMatchesCategory(disambig, cat);
}


// Les clés TMDB/RAWG vivent dans la config partagée (Store, commune à tous les
// appareils en mode GitHub) plutôt que dans getConfig() (propre à cet
// appareil). Un cache mémoire évite de la relire à chaque frappe pendant une
// recherche live ; il ne survit pas au rechargement de page, donc une clé
// tout juste enregistrée dans Réglages est prise en compte dès la page suivante.
let _apiKeysPromise = null;
async function getApiKeys() {
  if (!_apiKeysPromise) _apiKeysPromise = Store.readSharedConfig().then((c) => c.apiKeys || {});
  return _apiKeysPromise;
}

const ApiAdapters = {
  // Clé API absente pour la source dédiée de cette catégorie (TMDB, RAWG) : le
  // recours silencieux à Wikipédia masque ce cas précis, alors qu'il se règle
  // en un instant dans Réglages — les appelants s'en servent pour afficher un
  // message clair plutôt que "aucun résultat".
  async missingKeyFor(cat) {
    const conf = CATEGORIES[cat];
    if (!conf) return false;
    const keys = await getApiKeys();
    if (conf.source === "tmdb") return !keys.tmdb;
    if (conf.source === "rawg") return !keys.rawg;
    return false;
  },
  async search(cat, query) {
    const conf = CATEGORIES[cat];
    if (!conf) return [];

    let results = [];
    if (conf.source === "openlibrary") results = await trySource(() => this._openLibrary(query));
    else if (conf.source === "googlebooks") results = await trySource(() => this._googleBooks(query));
    else if (conf.source === "tmdb") results = await trySource(() => this._tmdb(query, conf.tmdbType));
    else if (conf.source === "rawg") results = await trySource(() => this._rawg(query));
    else if (conf.source === "bgg") results = await trySource(() => this._bgg(query));
    else if (conf.source === "jikan") results = await trySource(() => this._jikan(query));

    // Livres / BD : Open Library et Google Books n'ont pas la même couverture
    // (Google Books est bien meilleur sur les BD francophones). Si la source
    // principale renvoie peu de résultats, on complète avec l'autre.
    if ((conf.source === "openlibrary" || conf.source === "googlebooks") && results.length < 3) {
      const alt = await trySource(() => (conf.source === "openlibrary" ? this._googleBooks(query) : this._openLibrary(query)));
      mergeUnique(results, alt);
    }

    // Quelle que soit la catégorie, si les sources dédiées ne suffisent pas
    // (clé API absente, service en panne, terme rare, œuvre peu référencée
    // dans les bases spécialisées) on complète avec Wikipédia — gratuit, sans
    // clé, très large couverture. Les images qui n'ont pas une allure
    // d'affiche/pochette sont écartées (voir _wikipedia).
    if (results.length < 3) {
      const wiki = await trySource(() => this._wikipedia(query, conf.wikiHint, cat));
      mergeUnique(results, wiki);
    }

    results = results.slice(0, 8);
    // Un résultat peut avoir un titre sans image (poster TMDB manquant,
    // couverture Google Books absente, fiche BGG incomplète...) : on retente
    // une image via Wikipédia, ciblée sur le titre exact de l'item plutôt que
    // sur la requête tapée par l'utilisateur, qui est souvent moins précise.
    await this._fillMissingImages(results, conf.wikiHint, cat);
    return results;
  },

  async _fillMissingImages(items, hint, cat) {
    await Promise.all(items.filter((r) => !r.image && r.titre).map(async (r) => {
      const wiki = await trySource(() => this._wikipedia(r.titre, hint, cat));
      const match = wiki.find((w) => w.image);
      if (match) r.image = match.image;
    }));
  },

  // ---------- Open Library (livres / BD) ----------
  async _openLibrary(query) {
    const params = new URLSearchParams({ q: query, limit: "6" });
    const res = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.docs || []).map((doc) => ({
      externalId: `ol:${doc.key}`,
      titre: doc.title,
      annee: doc.first_publish_year || null,
      image: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      images: [],
      extra: { auteur: (doc.author_name && doc.author_name[0]) || "" },
    }));
  },

  // ---------- Google Books (livres / BD, complète Open Library) ----------
  async _googleBooks(query) {
    const params = new URLSearchParams({ q: query, maxResults: "8" });
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || [])
      .map((it) => {
        const info = it.volumeInfo || {};
        const img = info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail);
        return {
          externalId: `gb:${it.id}`,
          titre: info.title ? info.title + (info.subtitle ? " : " + info.subtitle : "") : "",
          annee: (info.publishedDate || "").slice(0, 4) || null,
          image: img ? img.replace("http://", "https://") : null,
          images: [],
          extra: { auteur: (info.authors && info.authors[0]) || "" },
        };
      })
      .filter((r) => r.titre);
  },

  // ---------- TMDB (films / séries) ----------
  async _tmdb(query, type) {
    const key = (await getApiKeys()).tmdb;
    if (!key) throw new Error("Clé TMDB manquante (réglages)");
    const params = new URLSearchParams({ api_key: key, query, language: "fr-FR" });
    const res = await fetch(`https://api.themoviedb.org/3/search/${type}?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).slice(0, 6).map((r) => ({
      externalId: `tmdb:${type}:${r.id}`,
      titre: r.title || r.name,
      annee: (r.release_date || r.first_air_date || "").slice(0, 4) || null,
      image: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
      images: [],
      extra: {},
    }));
  },

  // ---------- RAWG (jeux vidéo) ----------
  async _rawg(query) {
    const key = (await getApiKeys()).rawg;
    if (!key) throw new Error("Clé RAWG manquante (réglages)");
    const params = new URLSearchParams({ key, search: query, page_size: "6" });
    const res = await fetch(`https://api.rawg.io/api/games?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((g) => ({
      externalId: `rawg:${g.id}`,
      titre: g.name,
      annee: (g.released || "").slice(0, 4) || null,
      image: g.background_image || null,
      images: g.short_screenshots ? g.short_screenshots.slice(0, 2).map((s) => s.image) : [],
      extra: {},
    }));
  },

  // ---------- BoardGameGeek (jeux de société) ----------
  // L'API XML de BGG ne renvoie pas d'en-têtes CORS : on passe par un proxy
  // public pour que le navigateur puisse lire la réponse. Si le proxy est
  // indisponible, la recherche échoue proprement (message "aucun résultat",
  // saisie manuelle toujours possible).
  _bggProxy(url) {
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  },
  async _fetchTimeout(url, ms = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  },
  async _bgg(query) {
    const res = await this._fetchTimeout(this._bggProxy(`https://boardgamegeek.com/xmlapi2/search?type=boardgame&query=${encodeURIComponent(query)}`));
    if (!res.ok) return [];
    const xml = new DOMParser().parseFromString(await res.text(), "text/xml");
    const items = Array.from(xml.querySelectorAll("item")).slice(0, 5);
    const results = await Promise.all(
      items.map(async (item) => {
        const id = item.getAttribute("id");
        const nameEl = item.querySelector("name");
        const yearEl = item.querySelector("yearpublished");
        let image = null, minPlayers = null, maxPlayers = null, typeJeu = "";
        try {
          const detailRes = await this._fetchTimeout(this._bggProxy(`https://boardgamegeek.com/xmlapi2/thing?id=${id}`));
          if (detailRes.ok) {
            const detailXml = new DOMParser().parseFromString(await detailRes.text(), "text/xml");
            image = detailXml.querySelector("image")?.textContent || null;
            minPlayers = detailXml.querySelector("minplayers")?.getAttribute("value") || null;
            maxPlayers = detailXml.querySelector("maxplayers")?.getAttribute("value") || null;
            typeJeu = detailXml.querySelector('link[type="boardgamecategory"]')?.getAttribute("value") || "";
          }
        } catch { /* détail indisponible, on garde le minimum */ }
        return {
          externalId: `bgg:${id}`,
          titre: nameEl ? nameEl.getAttribute("value") : "",
          annee: yearEl ? yearEl.getAttribute("value") : null,
          image,
          images: [],
          extra: {
            typeJeu,
            nbJoueurs: minPlayers && maxPlayers ? (minPlayers === maxPlayers ? minPlayers : `${minPlayers}-${maxPlayers}`) : "",
          },
        };
      })
    );
    return results.filter((r) => r.titre);
  },

  // ---------- Jikan (animés) : API publique adossée à MyAnimeList, gratuite,
  // sans clé, couverture bien meilleure que TMDB sur ce type de contenu ----------
  async _jikan(query) {
    const params = new URLSearchParams({ q: query, limit: "8" });
    const res = await this._fetchTimeout(`https://api.jikan.moe/v4/anime?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || [])
      .map((a) => ({
        externalId: `mal:${a.mal_id}`,
        titre: a.title || a.title_english || "",
        annee: a.year || (a.aired && a.aired.from ? a.aired.from.slice(0, 4) : null),
        image: (a.images && a.images.jpg && (a.images.jpg.large_image_url || a.images.jpg.image_url)) || null,
        images: [],
        extra: {},
      }))
      .filter((r) => r.titre);
  },

  // ---------- Wikipédia (filet de secours, gratuit, sans clé, très large couverture) ----------
  // "opensearch" fait une recherche par préfixe de titre (bien plus précise pour ce
  // qu'on veut ici qu'une recherche plein texte, qui remonte trop de pages sans
  // rapport). On tente d'abord la requête seule, puis on l'élargit avec l'indice de
  // catégorie (ex. "jeu vidéo") pour désambiguïser, sans jamais écraser la 1re passe :
  // le suffixe ne matche que si le titre réel de la page le contient tel quel.
  async _wikiOpensearch(q) {
    const params = new URLSearchParams({ action: "opensearch", search: q, limit: "8", format: "json", origin: "*" });
    const res = await this._fetchTimeout(`https://fr.wikipedia.org/w/api.php?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data[1] || [];
  },
  _usablePortraitThumb(thumb) {
    // on ne garde l'image que si elle a une silhouette "affiche/pochette"
    // (portrait), pour éviter d'afficher une photo d'illustration sans rapport
    return !!(thumb && thumb.height >= thumb.width * 0.9);
  },
  // Beaucoup d'affiches de films/séries/jeux sont des images "non libres" (fair
  // use) : Wikipédia en français ne les héberge jamais (politique éditoriale),
  // donc pageimages n'y renvoie rien pour ces articles-là. Wikipédia en anglais,
  // elle, les héberge couramment. Pour un titre encore sans image côté FR, on
  // cherche son équivalent EN (langlinks) puis sa vignette là-bas.
  async _enTitlesFor(frTitles) {
    if (!frTitles.length) return {};
    const params = new URLSearchParams({
      action: "query", titles: frTitles.join("|"), prop: "langlinks", lllang: "en", format: "json", origin: "*", redirects: "1",
    });
    const res = await this._fetchTimeout(`https://fr.wikipedia.org/w/api.php?${params.toString()}`);
    if (!res.ok) return {};
    const data = await res.json();
    const byRequested = indexPagesByRequestedTitle(data.query || {}, frTitles);
    const map = {};
    frTitles.forEach((t) => {
      const p = byRequested[t];
      if (p && p.langlinks && p.langlinks[0] && p.langlinks[0]["*"]) map[t] = p.langlinks[0]["*"];
    });
    return map;
  },
  async _enThumbnails(enTitles) {
    if (!enTitles.length) return {};
    // pilicense=any : sans ça, l'API exclut par défaut les images "non libres"
    // (posters/pochettes en fair use), qui sont justement le cas le plus
    // fréquent pour ce genre d'articles sur Wikipédia anglophone.
    const params = new URLSearchParams({
      action: "query", titles: enTitles.join("|"), prop: "pageimages", pithumbsize: "400", pilicense: "any", format: "json", origin: "*", redirects: "1",
    });
    const res = await this._fetchTimeout(`https://en.wikipedia.org/w/api.php?${params.toString()}`);
    if (!res.ok) return {};
    const data = await res.json();
    const byRequested = indexPagesByRequestedTitle(data.query || {}, enTitles);
    const map = {};
    enTitles.forEach((t) => { if (byRequested[t] && byRequested[t].thumbnail) map[t] = byRequested[t].thumbnail; });
    return map;
  },
  // ---------- Avatars (personnages de fiction issus de BD/Film/Jeu vidéo/Série/Animé) ----------
  // Une description en langage naturel ("roman", "film"...) est trop peu
  // fiable pour filtrer juste — trop de formulations différentes passent au
  // travers (testé : joueurs de foot homonymes, couvertures de livre, Sherlock
  // Holmes ou Dark Vador rejetés à tort parce que leur fiche ne redit pas le
  // type de leur œuvre d'origine...). On vérifie donc en une seule requête
  // Wikidata, avec de la donnée structurée : (1) l'élément est bien un
  // personnage de fiction (P31/P279* → Q95074 ou Q15632617, jamais un humain
  // réel Q5, même homonyme) ET (2) au moins une des œuvres où il apparaît
  // (P1441 "present in work") est, en remontant ses sous-classes, un film, une
  // série télévisée, un jeu vidéo, une BD ou un animé.
  async _wikidataFilterCharacterOrigin(qids) {
    if (!qids.length) return new Set();
    const values = qids.map((q) => `wd:${q}`).join(" ");
    const sparql = `SELECT DISTINCT ?item WHERE {
      VALUES ?item { ${values} }
      ?item wdt:P31/wdt:P279* ?charClass .
      FILTER(?charClass IN (wd:Q95074, wd:Q15632617))
      ?item wdt:P1441 ?work .
      ?work wdt:P31/wdt:P279* ?workClass .
      FILTER(?workClass IN (wd:Q11424, wd:Q5398426, wd:Q7889, wd:Q2831984, wd:Q14406742, wd:Q63952888, wd:Q20650540))
    }`;
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
    try {
      const res = await this._fetchTimeout(url, 8000);
      if (!res.ok) return new Set(); // service indisponible : on ne peut pas vérifier, donc on n'affiche rien plutôt qu'à tort
      const data = await res.json();
      return new Set((data.results.bindings || []).map((b) => b.item.value.split("/").pop()));
    } catch {
      return new Set();
    }
  },
  async searchAvatar(query) {
    return trySource(async () => {
      // " personnage" en 2e passe : biaise directement la recherche vers les
      // fiches de personnage plutôt que de ne compter que sur le filtre d'après.
      let titles = await this._wikiOpensearch(query);
      const hinted = await this._wikiOpensearch(`${query} personnage`);
      const seen = new Set(titles);
      hinted.forEach((t) => { if (!seen.has(t)) { seen.add(t); titles.push(t); } });
      titles = titles.slice(0, 10);
      if (!titles.length) return [];

      const params = new URLSearchParams({
        action: "query", titles: titles.join("|"), prop: "pageimages|pageprops", pithumbsize: "400", ppprop: "wikibase_item", format: "json", origin: "*", redirects: "1",
      });
      let pagesByTitle = {};
      try {
        const res = await this._fetchTimeout(`https://fr.wikipedia.org/w/api.php?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          pagesByTitle = indexPagesByRequestedTitle(data.query || {}, titles);
        }
      } catch { /* pas grave, on garde les résultats sans image */ }

      const qidByTitle = {};
      titles.forEach((t) => {
        const qid = pagesByTitle[t] && pagesByTitle[t].pageprops && pagesByTitle[t].pageprops.wikibase_item;
        if (qid) qidByTitle[t] = qid;
      });
      // Sans fiche Wikidata reliée, impossible de vérifier ce que c'est : on
      // écarte par prudence plutôt que de risquer une image hors-sujet.
      const validQids = await this._wikidataFilterCharacterOrigin(Object.values(qidByTitle));
      titles = titles.filter((t) => qidByTitle[t] && validQids.has(qidByTitle[t]));
      if (!titles.length) return [];

      const missing = titles.filter((t) => !(pagesByTitle[t] && pagesByTitle[t].thumbnail));
      if (missing.length) {
        try {
          const enTitleByFr = await this._enTitlesFor(missing);
          const enTitles = Object.values(enTitleByFr);
          if (enTitles.length) {
            const enThumbs = await this._enThumbnails(enTitles);
            missing.forEach((frTitle) => {
              const thumb = enThumbs[enTitleByFr[frTitle]];
              if (thumb) pagesByTitle[frTitle] = { ...(pagesByTitle[frTitle] || {}), thumbnail: thumb };
            });
          }
        } catch { /* pas grave, on garde ce qu'on a */ }
      }

      return titles
        .map((title) => {
          const page = pagesByTitle[title];
          const thumb = page && page.thumbnail;
          return {
            externalId: `wiki:${(page && page.pageid) || title}`,
            titre: title,
            annee: null,
            image: thumb ? thumb.source : null,
            images: [],
            extra: {},
          };
        })
        .filter((r) => r.image);
    });
  },

  // requirePortrait : true pour les affiches/pochettes (silhouette portrait
  // attendue) ; false pour des portraits de personnage, où une photo carrée
  // ou un peu plus large que haute reste tout à fait exploitable une fois
  // recadrée en cercle (voir searchAvatar).
  // rejectMarkers : liste de mots à bannir de la description/désambiguïsation
  // (utilisé par searchAvatar pour écarter affiches/pochettes) — indépendant
  // de `cat`, qui sert lui à la recherche d'œuvres par catégorie.
  async _wikipedia(query, hint, cat) {
    let titles = await this._wikiOpensearch(query);
    if (hint) {
      const hinted = await this._wikiOpensearch(query + hint);
      const seen = new Set(titles);
      hinted.forEach((t) => { if (!seen.has(t)) { seen.add(t); titles.push(t); } });
    }
    titles = titles.slice(0, 8);
    if (!titles.length) return [];

    // "description" est la description courte (issue de Wikidata, ex. "roman
    // de Frank Herbert" / "film réalisé par Denis Villeneuve") — bien plus
    // fiable que le suffixe entre parenthèses pour savoir à quelle catégorie
    // appartient réellement l'article. On la récupère dans le même appel que
    // les vignettes, donc sans requête réseau supplémentaire.
    const imgParams = new URLSearchParams({
      action: "query", titles: titles.join("|"), prop: "pageimages|description", pithumbsize: "400", format: "json", origin: "*", redirects: "1",
    });
    let pagesByTitle = {};
    try {
      const imgRes = await this._fetchTimeout(`https://fr.wikipedia.org/w/api.php?${imgParams.toString()}`);
      if (imgRes.ok) {
        const imgData = await imgRes.json();
        pagesByTitle = indexPagesByRequestedTitle(imgData.query || {}, titles);
      }
    } catch { /* pas grave, on garde les résultats sans image */ }

    // Wikipédia cherche dans tout le site : on écarte les titres dont la
    // description (ou, à défaut, le suffixe de désambiguïsation du titre)
    // désigne clairement une AUTRE catégorie — ex. ne pas proposer "Dune,
    // deuxième partie" (un film) en cherchant un livre.
    if (cat) {
      titles = titles.filter((t) => {
        const desc = pagesByTitle[t] && pagesByTitle[t].description;
        return desc ? textMatchesCategory(desc, cat) : wikiTitleMatchesCategory(t, cat);
      });
    }
    if (!titles.length) return [];

    const missing = titles.filter((t) => !this._usablePortraitThumb(pagesByTitle[t] && pagesByTitle[t].thumbnail));
    if (missing.length) {
      try {
        const enTitleByFr = await this._enTitlesFor(missing);
        const enTitles = Object.values(enTitleByFr);
        if (enTitles.length) {
          const enThumbs = await this._enThumbnails(enTitles);
          missing.forEach((frTitle) => {
            const thumb = enThumbs[enTitleByFr[frTitle]];
            if (thumb) pagesByTitle[frTitle] = { ...(pagesByTitle[frTitle] || {}), thumbnail: thumb };
          });
        }
      } catch { /* pas grave, on garde ce qu'on a */ }
    }

    return titles.map((title) => {
      // Wikipédia désambiguïse dans le titre lui-même, ex. "Dune (film, 2021)" —
      // on garde ce suffixe (utile pour distinguer plusieurs œuvres du même nom)
      // mais on en extrait l'année quand elle y figure, pour l'affichage.
      const yearMatch = title.match(/\((?:[^)]*,\s*)?(\d{4})\)/);
      const page = pagesByTitle[title];
      const thumb = page && page.thumbnail;
      const image = this._usablePortraitThumb(thumb) ? thumb.source : null;
      return {
        externalId: `wiki:${(page && page.pageid) || title}`,
        titre: title,
        annee: yearMatch ? yearMatch[1] : null,
        image,
        images: [],
        extra: {},
      };
    });
  },
};
