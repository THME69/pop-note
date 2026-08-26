// Déclaration de toutes les catégories "collection". Chaque catégorie ne définit
// que ses différences : le moteur générique (collection.html + page-collection.js)
// se charge du reste.
//
// Types de champ profil possibles : "stars" | "boolean" | "date" | "textarea" | "text"

const CATEGORIES = {
  livres: {
    id: "livres",
    nom: "Livres",
    nomSingulier: "livre",
    icone: "📚",
    accent: "#3f6e5a",
    accentDeep: "#2e5245",
    source: "openlibrary",
    wikiHint: " livre",
    rechercheLabel: "Titre du livre",
    champsCatalogueExtra: [{ key: "auteur", label: "Auteur" }],
    champsProfil: [
      { key: "note", label: "Note", type: "stars" },
      { key: "avis", label: "Mon avis", type: "textarea" },
      { key: "dateLecture", label: "Lu le", type: "date" },
    ],
  },
  bd: {
    id: "bd",
    nom: "BD",
    nomSingulier: "BD",
    icone: "💬",
    accent: "#8a5a2f",
    accentDeep: "#6b4420",
    source: "googlebooks",
    wikiHint: " bande dessinée",
    rechercheLabel: "Titre de la BD",
    champsCatalogueExtra: [{ key: "auteur", label: "Auteur / dessinateur" }],
    champsProfil: [
      { key: "note", label: "Note", type: "stars" },
      { key: "avis", label: "Mon avis", type: "textarea" },
    ],
  },
  films: {
    id: "films",
    nom: "Films",
    nomSingulier: "film",
    icone: "🎬",
    accent: "#8a3c22",
    accentDeep: "#6b2d19",
    source: "tmdb",
    tmdbType: "movie",
    wikiHint: " film",
    rechercheLabel: "Titre du film",
    champsProfil: [
      { key: "note", label: "Note", type: "stars" },
      { key: "avis", label: "Mon avis", type: "textarea" },
    ],
  },
  series: {
    id: "series",
    nom: "Séries",
    nomSingulier: "série",
    icone: "📺",
    accent: "#3a4f66",
    accentDeep: "#293a4d",
    source: "tmdb",
    tmdbType: "tv",
    wikiHint: " série télévisée",
    rechercheLabel: "Titre de la série",
    champsProfil: [
      { key: "note", label: "Note", type: "stars" },
      { key: "avis", label: "Mon avis", type: "textarea" },
    ],
  },
  anime: {
    id: "anime",
    nom: "Animé",
    nomSingulier: "animé",
    icone: "🎏",
    accent: "#a8447a",
    accentDeep: "#7e3260",
    source: "jikan",
    wikiHint: " anime",
    rechercheLabel: "Titre de l'animé",
    champsProfil: [
      { key: "vu", label: "Vu", type: "boolean" },
      { key: "note", label: "Note", type: "stars" },
      { key: "avis", label: "Mon avis", type: "textarea" },
    ],
  },
  jeuxVideo: {
    id: "jeuxVideo",
    nom: "Jeux vidéo",
    nomSingulier: "jeu vidéo",
    icone: "🎮",
    accent: "#5c3a52",
    accentDeep: "#432a3c",
    source: "rawg",
    wikiHint: " jeu vidéo",
    rechercheLabel: "Nom du jeu",
    multiVisuels: true,
    champsProfil: [
      { key: "note", label: "Note", type: "stars" },
    ],
  },
  jeuxSociete: {
    id: "jeuxSociete",
    nom: "Jeux de société",
    nomSingulier: "jeu de société",
    icone: "🎲",
    accent: "#476152",
    accentDeep: "#33473c",
    source: "bgg",
    wikiHint: " jeu de société",
    rechercheLabel: "Nom du jeu",
    champsCatalogueExtra: [
      { key: "typeJeu", label: "Type de jeu" },
      { key: "nbJoueurs", label: "Nombre de joueurs" },
    ],
    champsProfil: [
      { key: "note", label: "Note", type: "stars" },
    ],
  },
};

const CATEGORY_ORDER = ["livres", "bd", "films", "series", "anime", "jeuxVideo", "jeuxSociete"];

// Kiosque et Coup de cœur ne sont pas des catégories de collection (pas de
// catalogue propre, pas de bascule dans la personnalisation) : ce sont des
// vues transverses, toujours accessibles depuis la bande du hub. On les
// déclare quand même ici pour réutiliser categoryMeta() (badges, accents...).
const KIOSQUE_META = { id: "kiosque", nom: "Kiosque", nomSingulier: "kiosque", accent: "#7a6a3f", accentDeep: "#5c5030" };
const FAVORIS_META = { id: "favoris", nom: "Coup de cœur", nomSingulier: "coup de cœur", accent: "#c23b3b", accentDeep: "#9c2e2e" };

function categoryMeta(id) {
  if (id === "kiosque") return KIOSQUE_META;
  if (id === "favoris") return FAVORIS_META;
  return CATEGORIES[id] || null;
}

function allCategoriesMeta() {
  return CATEGORY_ORDER.map(categoryMeta).filter(Boolean);
}

// Les préférences de catégories d'un profil (profile.categories) sont écrites
// une fois puis relues telles quelles : si une catégorie a depuis été retirée
// de l'app (ex. Photo), un profil existant peut encore en garder l'id en
// mémoire. On filtre systématiquement à la lecture pour ne jamais planter sur
// une catégorie qui n'existe plus.
function activeCategoriesOf(profile) {
  const stored = (profile && profile.categories || []).filter((c) => CATEGORY_ORDER.includes(c));
  return stored.length ? stored : CATEGORY_ORDER;
}
