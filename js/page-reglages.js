// ---------- thème de couleur ----------
const THEMES = [
  { id: "chaleureux", nom: "Chaleureux", paper: "#f4efe4", accent: "#b1502f" },
  { id: "nuit", nom: "Nuit", paper: "#1e1a16", accent: "#d3824f" },
  { id: "ocean", nom: "Océan", paper: "#eef3f6", accent: "#2f6f8f" },
  { id: "aubergine", nom: "Aubergine", paper: "#f4eef2", accent: "#8a4a72" },
];

function renderThemePicker() {
  const cfg = getConfig();
  const current = cfg.theme || "chaleureux";
  const el = document.getElementById("themePicker");
  el.innerHTML = THEMES.map((t) => `
    <button type="button" class="theme-swatch${t.id === current ? " active" : ""}" data-theme-id="${t.id}">
      <span class="theme-swatch-preview" style="background:${t.paper};">
        <span class="theme-swatch-dot" style="background:${t.accent};"></span>
      </span>
      <span class="theme-swatch-name">${t.nom}</span>
    </button>`).join("");
  el.querySelectorAll("[data-theme-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.themeId;
      const cfg2 = getConfig();
      cfg2.theme = id;
      setConfig(cfg2);
      document.documentElement.setAttribute("data-theme", id);
      renderThemePicker();
    });
  });
}

function refreshStatus() {
  const pill = document.getElementById("backendStatus");
  if (isGithubConfigured()) {
    pill.textContent = "✓ Connecté à GitHub";
    pill.className = "status-pill ok";
  } else {
    pill.textContent = "Mode local (démo)";
    pill.className = "status-pill off";
  }
}

function toggleGithubFields() {
  const isGithub = document.getElementById("backendSelect").value === "github";
  document.getElementById("githubFields").style.display = isGithub ? "" : "none";
}

const isSetupFlow = new URLSearchParams(location.search).get("setup") === "1";

async function loadForm() {
  document.getElementById("setupNotice").style.display = isSetupFlow ? "flex" : "none";
  const cfg = getConfig();
  document.getElementById("backendSelect").value = cfg.backend || "local";
  document.getElementById("ghOwner").value = (cfg.github && cfg.github.owner) || "";
  document.getElementById("ghRepo").value = (cfg.github && cfg.github.repo) || "";
  document.getElementById("ghBranch").value = (cfg.github && cfg.github.branch) || "main";
  document.getElementById("ghToken").value = (cfg.github && cfg.github.token) || "";
  toggleGithubFields();
  refreshStatus();
  renderThemePicker();

  // Clés API : communes à tous les appareils (stockage partagé, cf. Store),
  // contrairement au reste de cette page qui reste propre à cet appareil.
  const shared = await Store.readSharedConfig();
  document.getElementById("tmdbKey").value = (shared.apiKeys && shared.apiKeys.tmdb) || "";
  document.getElementById("rawgKey").value = (shared.apiKeys && shared.apiKeys.rawg) || "";
}

document.getElementById("backendSelect").addEventListener("change", toggleGithubFields);

document.getElementById("saveSettingsBtn").addEventListener("click", async () => {
  const cfg = {
    // Le thème se choisit et s'enregistre à part (appliqué tout de suite au
    // clic sur une pastille) — on le préserve ici pour ne pas l'écraser.
    theme: getConfig().theme,
    backend: document.getElementById("backendSelect").value,
    github: {
      owner: document.getElementById("ghOwner").value.trim(),
      repo: document.getElementById("ghRepo").value.trim(),
      branch: document.getElementById("ghBranch").value.trim() || "main",
      token: document.getElementById("ghToken").value.trim(),
    },
  };
  setConfig(cfg);
  refreshStatus();
  // Enregistrée après le backend/GitHub ci-dessus, pour que la config
  // partagée s'écrive tout de suite au bon endroit si le backend GitHub
  // vient d'être activé dans cette même sauvegarde.
  await Store.writeSharedConfig({
    apiKeys: {
      tmdb: document.getElementById("tmdbKey").value.trim(),
      rawg: document.getElementById("rawgKey").value.trim(),
    },
  });
  const confirm = document.getElementById("saveConfirm");
  if (isSetupFlow) {
    confirm.textContent = "Enregistré. Retour au choix du profil…";
    setTimeout(() => { location.href = "index.html"; }, 700);
    return;
  }
  confirm.textContent = "Enregistré.";
  setTimeout(() => (confirm.textContent = ""), 2500);
});

loadForm();

// ---------- exemples de démonstration ----------
const DEMO_ITEMS = {
  livres: [
    { titre: "1984", note: 5, avis: "Glaçant et toujours d'actualité.", dateLecture: "2025-03-12" },
    { titre: "Le Petit Prince", note: 4, avis: "Un classique qu'on relit avec plaisir.", dateLecture: "2025-05-02" },
    { titre: "Sapiens", note: 4, avis: "Une fresque passionnante sur notre espèce.", dateLecture: "2024-11-20" },
    { titre: "Fondation", note: 5, avis: "La SF dans ce qu'elle a de plus ambitieux.", dateLecture: "2025-01-08" },
    { titre: "L'Étranger", note: 4, avis: "Court, sec, marquant.", dateLecture: "2024-09-14" },
  ],
  bd: [
    { titre: "Watchmen", note: 5, avis: "Redéfinit ce qu'une BD de super-héros peut être." },
    { titre: "Astérix le Gaulois", note: 4, avis: "Toujours aussi drôle." },
    { titre: "Le Chat du Rabbin", note: 4, avis: "Fin, drôle, plein de sagesse." },
    { titre: "Blacksad", note: 5, avis: "Ambiance polar irréprochable." },
    { titre: "Persepolis", note: 5, avis: "Un témoignage bouleversant." },
  ],
  films: [
    { titre: "Blade Runner 2049", note: 5, avis: "Visuellement superbe, très contemplatif." },
    { titre: "Interstellar", note: 4, avis: "Ambitieux, émouvant, un peu long." },
    { titre: "Parasite", note: 5, avis: "Maîtrise totale du scénario." },
    { titre: "The Grand Budapest Hotel", note: 4, avis: "Esthétique et rythme parfaits." },
    { titre: "Spirited Away", note: 5, avis: "Un pur enchantement." },
  ],
  series: [
    { titre: "Breaking Bad", vu: true, note: 5 },
    { titre: "The Wire", vu: true, note: 5 },
    { titre: "Fleabag", vu: true, note: 4 },
    { titre: "Chernobyl", vu: true, note: 5 },
    { titre: "Twin Peaks", vu: false, note: 0 },
  ],
  anime: [
    { titre: "Fullmetal Alchemist: Brotherhood", vu: true, note: 5 },
    { titre: "Death Note", vu: true, note: 5 },
    { titre: "Spy x Family", vu: true, note: 4 },
    { titre: "Vinland Saga", vu: true, note: 5 },
    { titre: "One Piece", vu: false, note: 0 },
  ],
  jeuxVideo: [
    { titre: "The Legend of Zelda: Breath of the Wild", note: 5 },
    { titre: "Hades", note: 5 },
    { titre: "Disco Elysium", note: 5 },
    { titre: "Celeste", note: 4 },
    { titre: "Portal 2", note: 5 },
  ],
  jeuxSociete: [
    { titre: "Catan", note: 4 },
    { titre: "Carcassonne", note: 4 },
    { titre: "Azul", note: 5 },
    { titre: "Wingspan", note: 4 },
    { titre: "Codenames", note: 5 },
  ],
};

function refreshDemoSection() {
  const profile = ActiveProfile.get();
  const btn = document.getElementById("seedBtn");
  const desc = document.getElementById("demoDesc");
  if (!profile) {
    btn.disabled = true;
    desc.innerHTML = `Ajoute 5 exemples dans chaque catégorie. <a href="index.html">Choisis d'abord un profil →</a>`;
  } else {
    btn.disabled = false;
    desc.textContent = `Ajoute 5 exemples dans chaque catégorie du profil « ${profile.nom} », pour voir l'appli remplie.`;
  }
}

async function seedExamples() {
  const profile = ActiveProfile.get();
  if (!profile) return;
  const btn = document.getElementById("seedBtn");
  const status = document.getElementById("seedStatus");
  btn.disabled = true;
  const total = Object.values(DEMO_ITEMS).reduce((s, l) => s + l.length, 0);
  let done = 0;

  for (const cat of Object.keys(DEMO_ITEMS)) {
    const catMeta = CATEGORIES[cat];
    const existingProfilData = await Store.readProfilData(profile.id, cat);
    for (const ex of DEMO_ITEMS[cat]) {
      done++;
      status.textContent = `Ajout ${done}/${total} — ${ex.titre}…`;
      try {
        const results = await ApiAdapters.search(cat, ex.titre);
        const found = results[0];
        const catalogueFields = found
          ? { titre: found.titre, image: found.image, annee: found.annee, externalId: found.externalId, images: found.images || [], ...(found.extra || {}) }
          : { titre: ex.titre, image: null, annee: null, externalId: null, images: [] };
        const saved = await Store.upsertCatalogueItem(cat, catalogueFields);

        const profilEntry = {};
        catMeta.champsProfil.forEach((f) => {
          if (f.key in ex) profilEntry[f.key] = ex[f.key];
          else if (f.type === "stars") profilEntry[f.key] = 0;
          else if (f.type === "boolean") profilEntry[f.key] = false;
          else profilEntry[f.key] = "";
        });

        const isNewForProfile = !existingProfilData[saved.id];
        await Store.writeProfilEntry(profile.id, cat, saved.id, profilEntry);
        existingProfilData[saved.id] = profilEntry;

        if (isNewForProfile) {
          await Store.pushActivite({
            profilId: profile.id,
            profilNom: profile.nom,
            categorie: cat,
            itemId: saved.id,
            titre: saved.titre,
            image: saved.image,
            note: profilEntry.note || null,
            avis: profilEntry.avis || null,
            type: "ajout",
          });
        }
      } catch (e) {
        console.error("Exemple non ajouté :", ex.titre, e);
      }
    }
  }

  status.textContent = `Terminé : ${total} exemples ajoutés à ${profile.nom}.`;
  btn.disabled = false;
}

document.getElementById("seedBtn").addEventListener("click", seedExamples);
refreshDemoSection();

// ---------- zone dangereuse : tout réinitialiser ----------
document.getElementById("resetAllBtn").addEventListener("click", async () => {
  const first = confirm("Supprimer tous les profils et toutes leurs données (collections, notes, activité, top de la semaine) ? Les clés API sont conservées. Cette action est irréversible.");
  if (!first) return;
  const second = confirm("Vraiment sûr ? Il n'y a pas de retour en arrière possible.");
  if (!second) return;
  const btn = document.getElementById("resetAllBtn");
  const status = document.getElementById("resetStatus");
  btn.disabled = true;
  status.textContent = "Réinitialisation…";
  try {
    await Store.resetAllData();
    ActiveProfile.clear();
    status.textContent = "Terminé. Redirection…";
    location.href = "index.html";
  } catch (e) {
    console.error("Échec de la réinitialisation", e);
    status.textContent = `Échec : ${e.message || e}`;
    btn.disabled = false;
  }
});
