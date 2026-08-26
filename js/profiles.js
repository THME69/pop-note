// Profil actif = celui sélectionné sur l'écran d'accueil, mémorisé sur cet appareil
// (chaque appareil peut avoir un profil actif différent, mais les données du profil
// lui sont propres quel que soit l'appareil puisqu'elles vivent dans le backend).

const ACTIVE_PROFILE_KEY = "bibliotheque.profilActif";

const ActiveProfile = {
  get() {
    try { return JSON.parse(localStorage.getItem(ACTIVE_PROFILE_KEY)); }
    catch { return null; }
  },
  set(profile) {
    localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(profile));
  },
  clear() {
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
  },
};

const PROFILE_COLORS = ["#b1502f", "#3f6e5a", "#3a4f66", "#8a5a2f", "#5c3a52", "#476152"];

// Profils déjà "déverrouillés" sur cet appareil : ceux sans code PIN dès leur
// premier clic, ceux avec code PIN une fois le bon code saisi une première
// fois. Sert à ne plus jamais redemander le code sur cet appareil, et à
// afficher ces profils en premier / mis en valeur sur l'écran de sélection.
const UNLOCKED_KEY = "bibliotheque.profilsDeverrouilles";

const UnlockedProfiles = {
  all() {
    try { return JSON.parse(localStorage.getItem(UNLOCKED_KEY)) || []; }
    catch { return []; }
  },
  has(id) {
    return this.all().includes(id);
  },
  add(id) {
    const list = this.all();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(UNLOCKED_KEY, JSON.stringify(list));
    }
  },
};
