// Couche de stockage unique utilisée par toute l'app.
// Deux backends possibles, avec la même interface :
//  - "local"  : tout est gardé dans le localStorage du navigateur (mode démo / test, aucune config requise)
//  - "github" : lecture/écriture des JSON du repo via l'API GitHub (ajout = un commit)
// Le choix se fait dans reglages.html et est mémorisé dans localStorage ("bibliotheque.config").

const CONFIG_KEY = "bibliotheque.config";

// Clés API embarquées avec le site : évite d'avoir à les ressaisir dans
// Réglages sur chaque nouveau navigateur/appareil. Toujours modifiables
// depuis Réglages ensuite (ce qui écrase durablement cette valeur par défaut
// dans le stockage partagé).
const DEFAULT_API_KEYS = { tmdb: "45e14cd21a394ffd65d27824237f882b", rawg: "84c5a87a45f54c5391b40362a56f730b" };

function getConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY)) || { backend: "local", github: {} };
  } catch {
    return { backend: "local", github: {} };
  }
}

function setConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

// Un appareil qui n'a encore jamais rien enregistré dans Réglages retombe
// silencieusement sur "local" (getConfig() ci-dessus) — indiscernable d'un
// choix "local" volontaire. On distingue les deux en testant si une config a
// déjà été écrite au moins une fois, pour forcer un premier passage par
// Réglages avant de proposer/créer un profil (voir index.html) : sinon un
// nouveau profil part sur cet appareil en local sans que ce soit voulu.
function hasConfiguredStorage() {
  return localStorage.getItem(CONFIG_KEY) != null;
}

function isGithubConfigured() {
  const cfg = getConfig();
  return cfg.backend === "github" && cfg.github && cfg.github.owner && cfg.github.repo && cfg.github.token;
}

// ---------- encodage utf8 <-> base64 ----------
function b64EncodeUtf8(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64DecodeUtf8(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
}

// ---------- backend "local" (localStorage) ----------
const LocalBackend = {
  key(path) { return `fs:${path}`; },
  async readFile(path) {
    const raw = localStorage.getItem(this.key(path));
    return raw == null ? null : raw;
  },
  async writeFile(path, content) {
    localStorage.setItem(this.key(path), content);
  },
  async deleteFile(path) {
    localStorage.removeItem(this.key(path));
  },
};

// ---------- backend "github" (API GitHub, contents endpoint) ----------
const GithubBackend = {
  apiUrl(path) {
    const cfg = getConfig();
    return `https://api.github.com/repos/${cfg.github.owner}/${cfg.github.repo}/contents/${path}`;
  },
  headers() {
    const cfg = getConfig();
    const h = { Accept: "application/vnd.github+json" };
    if (cfg.github.token) h.Authorization = `Bearer ${cfg.github.token}`;
    return h;
  },
  branch() {
    const cfg = getConfig();
    return cfg.github.branch || "main";
  },
  async getMeta(path) {
    const res = await fetch(`${this.apiUrl(path)}?ref=${this.branch()}`, { headers: this.headers() });
    if (res.status === 404) return { content: null, sha: null };
    if (!res.ok) throw new Error(`Erreur GitHub (${res.status}) en lisant ${path}`);
    const data = await res.json();
    return { content: b64DecodeUtf8(data.content), sha: data.sha };
  },
  async readFile(path) {
    const { content } = await this.getMeta(path);
    return content;
  },
  async putContent(path, base64Content, message) {
    let sha = null;
    try { ({ sha } = await this.getMeta(path)); } catch { /* fichier inexistant, ok */ }
    const body = { message, content: base64Content, branch: this.branch() };
    if (sha) body.sha = sha;
    const res = await fetch(this.apiUrl(path), {
      method: "PUT",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Échec de l'écriture GitHub (${res.status}) : ${err.message || "erreur inconnue"}`);
    }
    return res.json();
  },
  async writeFile(path, content, message) {
    return this.putContent(path, b64EncodeUtf8(content), message || `Mise à jour de ${path}`);
  },
  async deleteFile(path, message) {
    let sha = null;
    try { ({ sha } = await this.getMeta(path)); } catch { /* déjà inexistant, rien à faire */ }
    if (!sha) return; // pas de fichier à supprimer
    const res = await fetch(this.apiUrl(path), {
      method: "DELETE",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ message: message || `Suppression de ${path}`, sha, branch: this.branch() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Échec de la suppression GitHub (${res.status}) : ${err.message || "erreur inconnue"}`);
    }
  },
};

function backend() {
  return isGithubConfigured() ? GithubBackend : LocalBackend;
}

// ---------- API haut niveau, agnostique du backend ----------
const Store = {
  usingGithub() { return isGithubConfigured(); },

  async _readJSON(path, fallback) {
    const raw = await backend().readFile(path);
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  },
  async _writeJSON(path, data, message) {
    await backend().writeFile(path, JSON.stringify(data, null, 2), message);
  },

  // ---- config partagée (clés API) : passe par le backend actif, contrairement
  // à getConfig()/setConfig() (backend/theme/token GitHub) qui restent propres
  // à cet appareil. En mode GitHub, ça veut dire un seul jeu de clés commis
  // dans le repo et valable depuis n'importe quel appareil ; en mode local,
  // ça reste malgré tout dans ce navigateur faute de stockage partagé.
  async readSharedConfig() {
    const cfg = await this._readJSON("data/config.json", null);
    if (cfg) return cfg;
    // Rien en stockage partagé pour cet appareil : on reprend une éventuelle
    // clé déjà renseignée localement (migration depuis l'ancienne config
    // propre à cet appareil), sinon la clé par défaut embarquée avec le site.
    // Écrit une seule fois pour que ce ne soit plus jamais relu que depuis le
    // stockage partagé ensuite.
    const legacyKeys = getConfig().apiKeys || {};
    const migrated = {
      apiKeys: {
        tmdb: legacyKeys.tmdb || DEFAULT_API_KEYS.tmdb,
        rawg: legacyKeys.rawg || DEFAULT_API_KEYS.rawg,
      },
    };
    await this.writeSharedConfig(migrated);
    return migrated;
  },
  async writeSharedConfig(cfg) {
    await this._writeJSON("data/config.json", cfg, "Config partagée : mise à jour des clés API");
  },

  // ---- profils ----
  async readProfiles() {
    const data = await this._readJSON("data/profiles.json", { profiles: [] });
    return data.profiles || [];
  },
  async writeProfiles(profiles) {
    await this._writeJSON("data/profiles.json", { profiles }, "Profils : mise à jour");
  },

  // ---- catalogue commun (par catégorie) ----
  async readCatalogue(cat) {
    return this._readJSON(`data/catalogue/${cat}.json`, []);
  },
  // ajoute l'item s'il n'existe pas déjà (même externalId), sinon le complète sans écraser
  // les infos déjà présentes. Retourne l'item final (avec son id interne).
  async upsertCatalogueItem(cat, item) {
    const list = await this.readCatalogue(cat);
    let existing = item.externalId ? list.find((i) => i.externalId === item.externalId) : null;
    if (existing) {
      Object.assign(existing, item, { id: existing.id });
      await this._writeJSON(`data/catalogue/${cat}.json`, list, `Catalogue ${cat} : mise à jour "${item.titre}"`);
      return existing;
    }
    const withId = { ...item, id: item.id || uid() };
    list.push(withId);
    await this._writeJSON(`data/catalogue/${cat}.json`, list, `Catalogue ${cat} : ajout "${item.titre}"`);
    return withId;
  },
  // met à jour un item existant du catalogue en le retrouvant par son id interne
  async updateCatalogueItem(cat, id, patch) {
    const list = await this.readCatalogue(cat);
    const idx = list.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch, id };
    await this._writeJSON(`data/catalogue/${cat}.json`, list, `Catalogue ${cat} : mise à jour "${list[idx].titre}"`);
    return list[idx];
  },

  // ---- données propres à un profil, par catégorie (livres, bd, films, series, jeuxVideo, jeuxSociete) ----
  async readProfilData(profileId, cat) {
    return this._readJSON(`data/profils/${profileId}/${cat}.json`, {});
  },
  async writeProfilEntry(profileId, cat, itemId, entry) {
    const data = await this.readProfilData(profileId, cat);
    data[itemId] = { ...data[itemId], ...entry };
    await this._writeJSON(`data/profils/${profileId}/${cat}.json`, data, `${profileId} : note sur ${cat}`);
    return data[itemId];
  },
  async deleteProfilEntry(profileId, cat, itemId) {
    const data = await this.readProfilData(profileId, cat);
    delete data[itemId];
    await this._writeJSON(`data/profils/${profileId}/${cat}.json`, data, `${profileId} : suppression dans ${cat}`);
  },

  // ---- fil d'activité (dernières actions, tous profils confondus) ----
  async readActivite() {
    return this._readJSON("data/activite.json", []);
  },
  async pushActivite(event) {
    const list = await this.readActivite();
    list.unshift({ id: uid(), ...event, date: new Date().toISOString() });
    await this._writeJSON("data/activite.json", list.slice(0, 30), "Activité : nouvel événement");
  },
  // réaction (émoji + petit commentaire) d'un profil sur l'ajout d'un autre —
  // une seule réaction par profil : une nouvelle réaction remplace la précédente
  async addReaction(eventId, reaction) {
    const list = await this.readActivite();
    const ev = list.find((e) => e.id === eventId);
    if (!ev) return;
    ev.reactions = (ev.reactions || []).filter((r) => r.profilId !== reaction.profilId);
    ev.reactions.push({ ...reaction, date: new Date().toISOString() });
    await this._writeJSON("data/activite.json", list, `Réaction de ${reaction.profilNom}`);
  },

  // ---- coup de cœur : calculé à la volée à partir des entrées "coeur:true"
  // de chaque catégorie (pas de fichier dédié, l'info vit avec l'item noté).
  async readFavoris(profileId) {
    const results = [];
    for (const catId of Object.keys(CATEGORIES)) {
      const [catalogue, profilData] = await Promise.all([
        this.readCatalogue(catId),
        this.readProfilData(profileId, catId),
      ]);
      Object.entries(profilData).forEach(([itemId, entry]) => {
        if (!entry.coeur) return;
        const item = catalogue.find((i) => i.id === itemId);
        if (item) results.push({ ...item, categorie: catId, profil: entry });
      });
    }
    return results;
  },

  // ---- kiosque (œuvres mises de côté depuis l'activité récente / le top de
  // la semaine, sans passer par l'ajout complet à la collection) ----
  async readKiosque(profileId) {
    return this._readJSON(`data/profils/${profileId}/kiosque.json`, []);
  },
  // sourceId identifie l'événement/la proposition d'origine : un même ajout
  // ne peut pas se retrouver deux fois au kiosque.
  async addToKiosque(profileId, item) {
    const list = await this.readKiosque(profileId);
    if (list.some((k) => k.sourceId === item.sourceId)) return list;
    list.unshift({ id: uid(), ...item, date: new Date().toISOString() });
    await this._writeJSON(`data/profils/${profileId}/kiosque.json`, list, `${profileId} : ajout au kiosque`);
    return list;
  },
  async removeFromKiosque(profileId, id) {
    const list = await this.readKiosque(profileId);
    const next = list.filter((k) => k.id !== id);
    await this._writeJSON(`data/profils/${profileId}/kiosque.json`, next, `${profileId} : retrait du kiosque`);
    return next;
  },

  // ---- top de la semaine (une proposition par profil et par semaine ISO) ----
  async readTopSemaine() {
    return this._readJSON("data/topSemaine.json", {});
  },
  async addProposal(weekId, proposal) {
    const data = await this.readTopSemaine();
    data[weekId] = data[weekId] || [];
    data[weekId].push({ id: uid(), ...proposal, date: new Date().toISOString(), reactions: [] });
    await this._writeJSON("data/topSemaine.json", data, `Top de la semaine : proposition de ${proposal.profilNom}`);
  },
  async addProposalReaction(weekId, proposalId, reaction) {
    const data = await this.readTopSemaine();
    const list = data[weekId] || [];
    const p = list.find((x) => x.id === proposalId);
    if (!p) return;
    p.reactions = (p.reactions || []).filter((r) => r.profilId !== reaction.profilId);
    p.reactions.push({ ...reaction, date: new Date().toISOString() });
    await this._writeJSON("data/topSemaine.json", data, `Top de la semaine : réaction de ${reaction.profilNom}`);
  },

  // ---- réinitialisation complète (avant lancement) : supprime tous les
  // profils et toutes leurs données (catalogue, notes, kiosque, activité,
  // top de la semaine). Les clés API partagées (data/config.json) et la
  // config de cet appareil (bibliotheque.config) sont préservées.
  async resetAllData() {
    const profiles = await this.readProfiles();
    const deletions = [];
    profiles.forEach((p) => {
      CATEGORY_ORDER.forEach((cat) => deletions.push(backend().deleteFile(`data/profils/${p.id}/${cat}.json`)));
      deletions.push(backend().deleteFile(`data/profils/${p.id}/kiosque.json`));
    });
    CATEGORY_ORDER.forEach((cat) => deletions.push(backend().deleteFile(`data/catalogue/${cat}.json`)));
    deletions.push(backend().deleteFile("data/profiles.json"));
    deletions.push(backend().deleteFile("data/activite.json"));
    deletions.push(backend().deleteFile("data/topSemaine.json"));
    await Promise.all(deletions);
  },
};
