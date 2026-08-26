const profile = requireProfile();
const catId = new URLSearchParams(location.search).get("cat");
const meta = CATEGORIES[catId];
if (!meta) location.href = "hub.html";

let openIdParam = new URLSearchParams(location.search).get("id");
let entries = [];
let sortMode = "recent";

document.documentElement.style.setProperty("--accent", meta.accent);
document.documentElement.style.setProperty("--accent-deep", meta.accentDeep);
document.body.dataset.cat = catId;
document.getElementById("pageTitle").textContent = `${meta.nom} — PopNote`;
document.getElementById("catTitle").innerHTML = `<span class="badge-icon" style="width:1em;height:1em;display:inline-flex;vertical-align:-0.12em;margin-right:8px;">${(typeof CATEGORY_ICONS !== "undefined" && CATEGORY_ICONS[catId]) || ""}</span>${esc(meta.nom)}`;
document.getElementById("profilePill").innerHTML = `<span class="pill-icon">${renderProfileIcon(profile.icone)}</span> ${esc(profile.nom)}`;

function subtitleLine(item) {
  const parts = [];
  if (item.auteur) parts.push(item.auteur);
  if (item.typeJeu) parts.push(item.typeJeu);
  if (item.nbJoueurs) parts.push(`${item.nbJoueurs} joueurs`);
  if (item.annee) parts.push(item.annee);
  return parts.join(" · ");
}

// ---------- chargement ----------
async function load() {
  const [catalogue, profilData] = await Promise.all([
    Store.readCatalogue(catId),
    Store.readProfilData(profile.id, catId),
  ]);
  window._catalogue = catalogue;
  window._profilData = profilData;
  entries = Object.keys(profilData)
    .map((itemId) => {
      const item = catalogue.find((i) => i.id === itemId);
      return item ? { ...item, profil: profilData[itemId] } : null;
    })
    .filter(Boolean);
  renderList();
  if (openIdParam) {
    openFiche(openIdParam);
    openIdParam = null;
  }
}

// ---------- liste / grille ----------
function cardHtml(entry) {
  const coverHtml = entry.image
    ? `<img class="cover" src="${esc(entry.image)}" alt="" loading="lazy" data-title="${esc(entry.titre)}">`
    : `<div class="cover-placeholder">${esc(entry.titre)}</div>`;
  const hasNote = meta.champsProfil.some((f) => f.key === "note");
  const hasAvis = meta.champsProfil.some((f) => f.key === "avis");
  const vuField = meta.champsProfil.find((f) => f.type === "boolean");
  const overlayBits = [];
  if (hasAvis && entry.profil.avis) overlayBits.push(`<p class="cov-summary">${esc(truncate(entry.profil.avis, 140))}</p>`);
  const metaBits = [];
  if (hasNote) metaBits.push(`<span class="stars${entry.profil.note ? "" : " empty"}">${starString(entry.profil.note)}</span>`);
  if (entry.annee) metaBits.push(`<span>${esc(entry.annee)}</span>`);
  const badge = vuField && entry.profil[vuField.key]
    ? `<span style="position:absolute;top:6px;left:6px;background:var(--accent);color:#fff;font-size:0.65rem;padding:2px 8px;border-radius:10px;">Vu</span>`
    : "";
  const heartActive = !!entry.profil.coeur;
  const heartBtn = `<button type="button" class="card-heart-btn${heartActive ? " active" : ""}" data-heart-id="${esc(entry.id)}" aria-label="Coup de cœur" title="Coup de cœur">${heartActive ? CATEGORY_ICONS.coeur : CATEGORY_ICONS.coeurOutline}</button>`;
  return `
    <div class="card" data-id="${esc(entry.id)}">
      <div class="cover-wrap">
        ${coverHtml}
        ${badge}
        ${heartBtn}
        <div class="cover-overlay">
          ${overlayBits.join("")}
          <div class="cov-meta">${metaBits.join("")}</div>
        </div>
      </div>
      <div class="card-body">
        <p class="card-title">${esc(entry.titre)}</p>
        <p class="card-sub">${esc(subtitleLine(entry))}</p>
        ${hasNote ? `<div class="card-stars${entry.profil.note ? "" : " empty"}">${starString(entry.profil.note)}</div>` : ""}
      </div>
    </div>`;
}

// ---------- stats (nombre, coups de cœur), en cartes façon tableau de bord ----------
function renderStats() {
  const stats = document.getElementById("catStats");
  if (!entries.length) { stats.innerHTML = ""; return; }
  const cards = [`<div class="stat-card accent"><span class="num">${entries.length}</span><span class="lbl">${entries.length > 1 ? meta.nom : meta.nomSingulier}</span></div>`];
  const coeurCount = entries.filter((e) => e.profil.coeur).length;
  if (coeurCount) cards.push(`<div class="stat-card"><span class="num">${coeurCount}</span><span class="lbl">Coup${coeurCount > 1 ? "s" : ""} de cœur</span></div>`);
  stats.innerHTML = cards.join("");
}

// ---------- tri ----------
function sortEntries(list) {
  const sorted = list.slice();
  if (sortMode === "alpha") sorted.sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
  else if (sortMode === "note") sorted.sort((a, b) => (b.profil.note || 0) - (a.profil.note || 0));
  else sorted.reverse(); // "recent" : les entrées sont ajoutées dans l'ordre, la plus récente en dernier
  return sorted;
}
document.querySelectorAll(".cat-sort-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    sortMode = btn.dataset.sort;
    document.querySelectorAll(".cat-sort-btn").forEach((b) => b.classList.toggle("active", b === btn));
    renderList();
  });
});

function renderList() {
  const content = document.getElementById("content");
  const q = document.getElementById("searchBox").value.trim().toLowerCase();
  const list = sortEntries(entries.filter((e) => !q || e.titre.toLowerCase().includes(q)));
  renderStats();
  updateCoverBackfillUI();
  if (!list.length) {
    content.innerHTML = `<p class="empty-state">${entries.length ? "Aucun résultat." : `Rien pour l'instant. Clique sur « + Ajouter » pour commencer.`}</p>`;
    return;
  }
  content.innerHTML = `<div class="grid">${list.map(cardHtml).join("")}</div>`;
  bindImgFallback(content, "img.cover", "cover-placeholder");
  content.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => openFiche(card.dataset.id));
  });
  content.querySelectorAll("[data-heart-id]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.heartId;
      const entry = entries.find((x) => x.id === id);
      if (!entry) return;
      const coeur = !entry.profil.coeur;
      await Store.writeProfilEntry(profile.id, catId, id, { coeur });
      entry.profil.coeur = coeur;
      btn.classList.toggle("active", coeur);
      btn.innerHTML = coeur ? CATEGORY_ICONS.coeur : CATEGORY_ICONS.coeurOutline;
      renderStats();
    });
  });
}
document.getElementById("searchBox").addEventListener("input", renderList);

// ---------- retrouver les couvertures manquantes (items ajoutés sans image,
// ex. avant qu'une clé API TMDB/RAWG soit configurée) ----------
function updateCoverBackfillUI() {
  const btn = document.getElementById("coverBackfillBtn");
  if (btn.dataset.running === "1") return; // ne pas réinitialiser le libellé pendant un run
  delete btn.dataset.mode;
  const missing = entries.filter((e) => !e.image).length;
  if (!missing) { btn.style.display = "none"; return; }
  btn.style.display = "";
  btn.textContent = `Retrouver ${missing} couverture${missing > 1 ? "s" : ""} manquante${missing > 1 ? "s" : ""}`;
}

document.getElementById("coverBackfillBtn").addEventListener("click", async () => {
  const btn = document.getElementById("coverBackfillBtn");
  if (btn.dataset.mode === "missing-key") { location.href = "reglages.html"; return; }
  const targets = entries.filter((e) => !e.image);
  if (!targets.length) return;
  // Cause la plus fréquente d'un "0 retrouvée" silencieux : pas de clé API
  // pour cette catégorie. Autant le dire tout de suite (avec un raccourci vers
  // Réglages) plutôt que de lancer des recherches vouées à échouer une par une.
  if (await ApiAdapters.missingKeyFor(catId)) {
    btn.textContent = "Clé API manquante — clique pour aller la configurer";
    btn.dataset.mode = "missing-key";
    return;
  }
  btn.dataset.running = "1";
  btn.disabled = true;
  let found = 0;
  for (let i = 0; i < targets.length; i++) {
    const entry = targets[i];
    btn.textContent = `Recherche… ${i + 1}/${targets.length}`;
    try {
      const results = await ApiAdapters.search(catId, entry.titre);
      const match = results.find((r) => r.image);
      if (match) {
        const patch = { image: match.image, images: match.images || [] };
        if (!entry.externalId) patch.externalId = match.externalId;
        if (!entry.annee) patch.annee = match.annee;
        await Store.updateCatalogueItem(catId, entry.id, patch);
        found++;
      }
    } catch (e) {
      console.error("Couverture non retrouvée :", entry.titre, e);
    }
  }
  delete btn.dataset.running;
  btn.disabled = false;
  await load(); // relit le catalogue depuis le Store : couvre aussi la fiche détail (window._catalogue)
  if (found < targets.length) {
    btn.style.display = "";
    btn.textContent = `${found}/${targets.length} retrouvée${found > 1 ? "s" : ""} — réessayer pour le reste`;
  }
});

// ---------- fiche détail ----------
function openFiche(id) {
  const item = window._catalogue.find((i) => i.id === id);
  if (!item) return;
  const profilEntry = window._profilData[id] || null;

  document.getElementById("ficheCover").innerHTML = item.image
    ? `<img src="${esc(item.image)}" alt="">`
    : `<div class="cover-placeholder">${esc(item.titre)}</div>`;

  const visuelsEl = document.getElementById("ficheVisuels");
  visuelsEl.innerHTML = meta.multiVisuels && item.images && item.images.length
    ? item.images.map((u) => `<img src="${esc(u)}" alt="">`).join("")
    : "";

  document.getElementById("ficheTitre").textContent = item.titre;
  document.getElementById("ficheSub").textContent = subtitleLine(item);

  // Note, date et avis sortent du bloc de champs générique pour s'afficher
  // en évidence dans le "hero" de la fiche, dans cet ordre précis (note,
  // puis la date juste en dessous, puis l'avis) — le reste (vu...) garde le
  // rendu en liste habituel, plus bas.
  const noteField = meta.champsProfil.find((f) => f.type === "stars");
  const avisField = meta.champsProfil.find((f) => f.key === "avis");
  const dateField = meta.champsProfil.find((f) => f.type === "date");
  const restFields = meta.champsProfil.filter((f) => f !== noteField && f !== avisField && f !== dateField);

  const noteVal = (profilEntry && noteField) ? profilEntry[noteField.key] : 0;
  document.getElementById("ficheNote").innerHTML = noteField
    ? `<div class="stars-row ${noteVal ? "" : "empty"}">${starString(noteVal)}</div>`
    : "";

  const dateVal = (profilEntry && dateField) ? profilEntry[dateField.key] : "";
  document.getElementById("ficheDate").textContent = dateVal ? `${dateField.label} ${formatDate(dateVal)}` : "";

  const avisVal = (profilEntry && avisField) ? profilEntry[avisField.key] : "";
  document.getElementById("ficheAvis").textContent = avisVal || "";

  const fieldsEl = document.getElementById("ficheFields");
  if (profilEntry) {
    fieldsEl.innerHTML = restFields.map((f) => {
      const val = profilEntry[f.key];
      if (f.type === "boolean") return `<div class="fiche-field"><div class="label">${esc(f.label)}</div><div class="value">${val ? "Oui" : "Non"}</div></div>`;
      if (!val) return "";
      if (f.type === "date") return `<div class="fiche-field"><div class="label">${esc(f.label)}</div><div class="value">${formatDate(val)}</div></div>`;
      return `<div class="fiche-field"><div class="label">${esc(f.label)}</div><div class="value">${esc(val)}</div></div>`;
    }).join("");
  } else {
    fieldsEl.innerHTML = `<p class="empty-state" style="padding:20px 0;">Pas encore dans ta collection.</p>`;
  }

  const editBtn = document.getElementById("ficheEditBtn");
  editBtn.innerHTML = profilEntry ? CATEGORY_ICONS.edit : CATEGORY_ICONS.plus;
  editBtn.title = profilEntry ? "Éditer" : "Ajouter à ma collection";
  editBtn.setAttribute("aria-label", editBtn.title);
  editBtn.dataset.id = id;

  // Coup de cœur : n'a de sens que si l'item est déjà dans la collection (il
  // faut un profilEntry à modifier) — sinon le bouton reste masqué, il faut
  // d'abord ajouter via le crayon/plus.
  const coeurBtn = document.getElementById("ficheCoeurBtn");
  coeurBtn.style.display = profilEntry ? "" : "none";
  if (profilEntry) {
    const active = !!profilEntry.coeur;
    coeurBtn.classList.toggle("active", active);
    coeurBtn.innerHTML = active ? CATEGORY_ICONS.coeur : CATEGORY_ICONS.coeurOutline;
    coeurBtn.dataset.id = id;
  }

  openFichePanel();
}

document.getElementById("ficheCoeurBtn").addEventListener("click", async () => {
  const btn = document.getElementById("ficheCoeurBtn");
  const id = btn.dataset.id;
  if (!id) return;
  const profilEntry = window._profilData[id];
  if (!profilEntry) return;
  const coeur = !profilEntry.coeur;
  await Store.writeProfilEntry(profile.id, catId, id, { coeur });
  profilEntry.coeur = coeur;
  btn.classList.toggle("active", coeur);
  btn.innerHTML = coeur ? CATEGORY_ICONS.coeur : CATEGORY_ICONS.coeurOutline;
  const entry = entries.find((x) => x.id === id);
  if (entry) entry.profil.coeur = coeur;
  renderStats();
});

// Ouverture/fermeture animées du panneau (glissement) : on passe par deux
// classes ("open" pour l'affichage, "show" pour l'état transitionné) car un
// élément display:none ne peut pas transitionner directement — le laisser
// se peindre une frame en position fermée d'abord est ce qui rend le
// glissement visible.
// Jeton incrémenté à chaque ouverture/fermeture : une fermeture programmée
// (transitionend ou le filet de sécurité setTimeout) ne retire "open" que si
// aucune ouverture/fermeture plus récente n'a eu lieu entre-temps — sinon une
// fermeture suivie d'une réouverture rapide pouvait laisser le setTimeout
// périmé de l'ancienne fermeture retirer "open" après coup, rendant le
// panneau invisible alors que "show" restait actif.
let fichePanelToken = 0;

function openFichePanel() {
  fichePanelToken++;
  const overlay = document.getElementById("ficheOverlay");
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  overlay.offsetHeight; // force le recalcul de mise en page avant d'ajouter "show", sinon le passage de display:none à block et la transition sont fusionnés et rien ne s'anime
  overlay.classList.add("show");
}
function closeFichePanel() {
  const myToken = ++fichePanelToken;
  const overlay = document.getElementById("ficheOverlay");
  const panel = overlay.querySelector(".fiche-panel");
  overlay.classList.remove("show");
  document.body.style.overflow = "";
  const finish = () => {
    if (myToken !== fichePanelToken) return;
    overlay.classList.remove("open");
  };
  panel.addEventListener("transitionend", finish, { once: true });
  setTimeout(finish, 350); // filet de sécurité (prefers-reduced-motion, etc.)
}

document.getElementById("ficheClose").addEventListener("click", closeFichePanel);
document.getElementById("ficheOverlay").addEventListener("click", (e) => {
  if (e.target.id === "ficheOverlay") closeFichePanel();
});
document.getElementById("ficheEditBtn").addEventListener("click", () => {
  const id = document.getElementById("ficheEditBtn").dataset.id;
  closeFichePanel();
  openAddModal(id);
});

// ---------- champs dynamiques du formulaire ----------
function renderCatalogueExtraForm(current) {
  const container = document.getElementById("catalogueExtraFields");
  const fields = meta.champsCatalogueExtra || [];
  container.innerHTML = fields.map((f) => `
    <div class="field"><label>${esc(f.label)}</label>
      <input type="text" id="ce_${f.key}" value="${esc((current && current[f.key]) || "")}"></div>
  `).join("");
}
function collectCatalogueExtraValues() {
  const out = {};
  (meta.champsCatalogueExtra || []).forEach((f) => {
    const el = document.getElementById(`ce_${f.key}`);
    if (el) out[f.key] = el.value.trim();
  });
  return out;
}

function renderProfilFieldsForm(current) {
  const container = document.getElementById("profilFields");
  container.innerHTML = meta.champsProfil.map((f) => {
    const val = (current && current[f.key]) ?? (f.type === "stars" ? 0 : "");
    if (f.type === "stars") {
      return `<div class="field"><label>${esc(f.label)}</label>
        <div class="stars-input" id="pf_${f.key}_stars"></div>
        <input type="hidden" id="pf_${f.key}" value="${val}"></div>`;
    }
    if (f.type === "boolean") {
      return `<div class="field"><label class="chip-toggle"><input type="checkbox" id="pf_${f.key}" ${current && current[f.key] ? "checked" : ""}> ${esc(f.label)}</label></div>`;
    }
    if (f.type === "textarea") {
      return `<div class="field"><label>${esc(f.label)}</label><textarea id="pf_${f.key}">${esc(val)}</textarea></div>`;
    }
    if (f.type === "date") {
      return `<div class="field"><label>${esc(f.label)}</label><input type="date" id="pf_${f.key}" value="${esc(val)}"></div>`;
    }
    return `<div class="field"><label>${esc(f.label)}</label><input type="text" id="pf_${f.key}" value="${esc(val)}"></div>`;
  }).join("");

  meta.champsProfil.filter((f) => f.type === "stars").forEach((f) => {
    const starsEl = document.getElementById(`pf_${f.key}_stars`);
    const hidden = document.getElementById(`pf_${f.key}`);
    function build(val) {
      starsEl.innerHTML = "";
      for (let i = 1; i <= 5; i++) {
        const span = document.createElement("span");
        span.textContent = "★";
        span.dataset.val = i;
        if (i <= val) span.classList.add("on");
        span.addEventListener("click", () => { hidden.value = i; build(i); });
        starsEl.appendChild(span);
      }
    }
    build(Number(hidden.value) || 0);
  });
}
function collectProfilFieldsValues() {
  const entry = {};
  meta.champsProfil.forEach((f) => {
    const el = document.getElementById(`pf_${f.key}`);
    if (!el) return;
    if (f.type === "stars") entry[f.key] = Number(el.value) || 0;
    else if (f.type === "boolean") entry[f.key] = el.checked;
    else entry[f.key] = el.value.trim();
  });
  return entry;
}

// ---------- recherche externe : dropdown live pendant la saisie ----------
let searchDebounceTimer = null;
let searchToken = 0;

function closeDropdown() {
  const dropdown = document.getElementById("searchDropdown");
  dropdown.classList.remove("open");
  dropdown.innerHTML = "";
}

async function runLiveSearch(q) {
  const myToken = ++searchToken;
  const dropdown = document.getElementById("searchDropdown");
  dropdown.classList.add("open");
  dropdown.innerHTML = `<div class="search-dropdown-loading">Recherche…</div>`;
  const results = await ApiAdapters.search(catId, q);
  if (myToken !== searchToken) return; // une saisie plus récente a pris le relais
  if (document.getElementById("fTitle").value.trim() !== q) return;
  if (!results.length) {
    dropdown.innerHTML = (await ApiAdapters.missingKeyFor(catId))
      ? `<div class="search-dropdown-empty">Clé API manquante pour cette catégorie — ajoute-la dans <a href="reglages.html">Réglages</a>, ou remplis les champs à la main.</div>`
      : `<div class="search-dropdown-empty">Aucun résultat automatique. Tu peux remplir les champs à la main.</div>`;
    return;
  }
  dropdown.innerHTML = results.map((r, i) => `
    <div class="search-dropdown-item" data-idx="${i}">
      ${r.image ? `<img src="${esc(r.image)}" alt="">` : `<div class="ph-sm"></div>`}
      <div>
        <div class="t">${esc(r.titre)}</div>
        ${r.annee ? `<div class="y">${esc(String(r.annee))}</div>` : ""}
      </div>
    </div>`).join("");
  dropdown.querySelectorAll(".search-dropdown-item").forEach((el) => {
    el.addEventListener("click", () => {
      pickSearchResult(results[Number(el.dataset.idx)]);
      closeDropdown();
    });
  });
}

function scheduleSearch() {
  clearTimeout(searchDebounceTimer);
  hideDupNotice();
  const q = document.getElementById("fTitle").value.trim();
  if (q.length < 2) { closeDropdown(); return; }
  searchDebounceTimer = setTimeout(() => runLiveSearch(q), 400);
}

document.getElementById("fTitle").addEventListener("input", scheduleSearch);
document.getElementById("fTitle").addEventListener("focus", () => {
  if (document.getElementById("fTitle").value.trim().length >= 2) scheduleSearch();
});
document.addEventListener("click", (e) => {
  if (!e.target.closest("#searchDropdown") && e.target.id !== "fTitle") closeDropdown();
});

function pickSearchResult(r) {
  document.getElementById("fTitle").value = r.titre;
  document.getElementById("fExternalId").value = r.externalId;
  document.getElementById("fImage").value = r.image || "";
  setImgPreview("fImagePreview", r.image);
  document.getElementById("fAnnee").value = r.annee || "";
  (meta.champsCatalogueExtra || []).forEach((f) => {
    const el = document.getElementById(`ce_${f.key}`);
    if (el && r.extra && r.extra[f.key] != null) el.value = r.extra[f.key];
  });
  window._pickedImages = r.images || [];
  checkOtherOwners(r.externalId);
}

// ---------- notice "déjà ajouté par un autre profil" ----------
function hideDupNotice() {
  document.getElementById("dupNotice").classList.remove("open");
  document.getElementById("dupNoticeViewBtn").dataset.itemId = "";
}

async function checkOtherOwners(externalId) {
  hideDupNotice();
  if (!externalId) return;
  const existingItem = window._catalogue.find((i) => i.externalId === externalId);
  if (!existingItem) return; // personne n'a encore ajouté cette œuvre : rien à signaler

  const profiles = await Store.readProfiles();
  const others = profiles.filter((p) => p.id !== profile.id);
  const owners = [];
  for (const p of others) {
    const data = await Store.readProfilData(p.id, catId);
    if (data[existingItem.id]) owners.push(p.nom);
  }
  if (!owners.length) return;

  const names = owners.length === 1 ? owners[0] : owners.slice(0, -1).join(", ") + " et " + owners[owners.length - 1];
  const verbe = owners.length === 1 ? "a" : "ont";
  document.getElementById("dupNoticeText").textContent = `${names} ${verbe} déjà ajouté « ${existingItem.titre} ».`;
  document.getElementById("dupNoticeViewBtn").dataset.itemId = existingItem.id;
  document.getElementById("dupNotice").classList.add("open");
}

document.getElementById("dupNoticeViewBtn").addEventListener("click", () => {
  const itemId = document.getElementById("dupNoticeViewBtn").dataset.itemId;
  if (!itemId) return;
  hideModal("itemBackdrop");
  openFiche(itemId);
});

document.getElementById("fImage").addEventListener("input", (e) => setImgPreview("fImagePreview", e.target.value.trim()));

// ---------- coup de cœur (bouton cœur sur le formulaire) ----------
function setCoeurBtn(active) {
  document.getElementById("fCoeur").value = active ? "1" : "0";
  const btn = document.getElementById("fCoeurBtn");
  btn.classList.toggle("active", active);
  btn.innerHTML = active ? CATEGORY_ICONS.coeur : CATEGORY_ICONS.coeurOutline;
}
document.getElementById("fCoeurBtn").addEventListener("click", () => {
  setCoeurBtn(document.getElementById("fCoeur").value !== "1");
});

// ---------- modale ajout / édition ----------
function openAddModal(id) {
  document.getElementById("itemForm").reset();
  closeDropdown();
  hideDupNotice();
  document.getElementById("fImagePreview").innerHTML = "";
  window._pickedImages = [];
  document.getElementById("fTitleLabel").textContent = meta.rechercheLabel;
  document.getElementById("deleteItemBtn").style.display = "none";

  if (id) {
    const item = window._catalogue.find((i) => i.id === id);
    const profilEntry = window._profilData[id] || null;
    setCoeurBtn(!!(profilEntry && profilEntry.coeur));
    document.getElementById("fCatalogueId").value = id;
    document.getElementById("fExternalId").value = item.externalId || "";
    document.getElementById("fTitle").value = item.titre;
    document.getElementById("fImage").value = item.image || "";
    setImgPreview("fImagePreview", item.image);
    document.getElementById("fAnnee").value = item.annee || "";
    window._pickedImages = item.images || [];
    renderCatalogueExtraForm(item);
    renderProfilFieldsForm(profilEntry);
    document.getElementById("itemModalTitle").textContent = `Éditer « ${item.titre} »`;
    if (profilEntry) document.getElementById("deleteItemBtn").style.display = "";
  } else {
    document.getElementById("fCatalogueId").value = "";
    document.getElementById("fExternalId").value = "";
    setCoeurBtn(false);
    renderCatalogueExtraForm(null);
    renderProfilFieldsForm(null);
    document.getElementById("itemModalTitle").textContent = `Ajouter — ${meta.nom}`;
  }
  showModal("itemBackdrop");
}
document.getElementById("addBtn").addEventListener("click", () => openAddModal(null));
document.getElementById("itemModalClose").addEventListener("click", () => hideModal("itemBackdrop"));
document.getElementById("itemCancelBtn").addEventListener("click", () => hideModal("itemBackdrop"));
document.getElementById("itemBackdrop").addEventListener("click", (e) => {
  if (e.target.id === "itemBackdrop") hideModal("itemBackdrop");
});

document.getElementById("itemForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const titre = document.getElementById("fTitle").value.trim();
  const image = document.getElementById("fImage").value.trim() || null;
  const annee = document.getElementById("fAnnee").value.trim() || null;
  const externalId = document.getElementById("fExternalId").value || null;
  const existingCatalogueId = document.getElementById("fCatalogueId").value || null;

  const catalogueFields = {
    titre, image, annee, externalId,
    images: window._pickedImages || [],
    ...collectCatalogueExtraValues(),
  };

  const saved = existingCatalogueId
    ? await Store.updateCatalogueItem(catId, existingCatalogueId, catalogueFields)
    : await Store.upsertCatalogueItem(catId, catalogueFields);

  const isNewForProfile = !window._profilData[saved.id];
  const profilEntry = { ...collectProfilFieldsValues(), coeur: document.getElementById("fCoeur").value === "1" };
  await Store.writeProfilEntry(profile.id, catId, saved.id, profilEntry);

  if (isNewForProfile) {
    await Store.pushActivite({
      profilId: profile.id,
      profilNom: profile.nom,
      categorie: catId,
      itemId: saved.id,
      titre: saved.titre,
      image: saved.image,
      note: profilEntry.note || null,
      avis: profilEntry.avis || null,
      type: "ajout",
    });
  }

  hideModal("itemBackdrop");
  await load();
  openFiche(saved.id);
});

document.getElementById("deleteItemBtn").addEventListener("click", async () => {
  const id = document.getElementById("fCatalogueId").value;
  if (!id || !confirm("Retirer cet item de ta collection ?")) return;
  await Store.deleteProfilEntry(profile.id, catId, id);
  hideModal("itemBackdrop");
  await load();
});

load().then(() => {
  if (new URLSearchParams(location.search).get("add") === "1") openAddModal(null);
});
