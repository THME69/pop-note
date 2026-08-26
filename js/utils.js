// Petits helpers partagés entre toutes les pages.

function esc(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function starString(rating) {
  const r = rating || 0;
  return "★".repeat(r) + "☆".repeat(5 - r);
}

function truncate(text, max) {
  if (!text) return "";
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max).trim() + "…";
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatDateShort(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Hash très simple d'un code PIN de profil. Ce n'est pas de la vraie
// cryptographie (ce n'est qu'un verrou "famille", pas un coffre-fort) : juste
// de quoi éviter de stocker le code en clair dans data/profiles.json.
function hashPin(pin) {
  return hashStr("pin:" + pin).toString(36);
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function showModal(id) { document.getElementById(id).classList.add("open"); document.body.style.overflow = "hidden"; }
function hideModal(id) { document.getElementById(id).classList.remove("open"); document.body.style.overflow = ""; }

function setImgPreview(containerId, url) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = "";
  if (!url) return;
  const img = document.createElement("img");
  img.src = url;
  img.alt = "";
  img.addEventListener("error", () => img.remove(), { once: true });
  el.appendChild(img);
}

function bindImgFallback(container, selector, placeholderClass) {
  container.querySelectorAll(selector).forEach((img) => {
    img.addEventListener("error", () => {
      const div = document.createElement("div");
      div.className = placeholderClass;
      div.textContent = img.dataset.title || "";
      img.replaceWith(div);
    }, { once: true });
  });
}

// Redirige vers l'écran de sélection de profil si aucun profil actif n'est choisi.
// À appeler en tout début de page sur toute page qui a besoin d'un profil.
// profile.icone est une référence vers un avatar pop culture ("avatar:darkvador")
// — voir js/popculture-avatars.js. Pas d'emoji natif : uniquement nos propres
// silhouettes dessinées.
function renderProfileIcon(icone) {
  if (icone && icone.startsWith("avatar:")) {
    const id = icone.slice(7);
    const avatar = typeof POPCULTURE_AVATARS !== "undefined" && POPCULTURE_AVATARS[id];
    if (avatar) return `<svg viewBox="0 0 40 40" class="avatar-svg">${avatar.g}</svg>`;
  }
  // "img:<url>" : photo de personnage trouvée via la recherche (Wikipédia) —
  // recadrée en cercle par CSS (.avatar-img), au même format que les silhouettes.
  if (icone && icone.startsWith("img:")) {
    return `<img class="avatar-img" src="${esc(icone.slice(4))}" alt="">`;
  }
  return "?";
}

// Effet "machine à écrire" réutilisable : vide l'élément puis tape le texte
// caractère par caractère. Retourne une promesse résolue une fois fini.
function typewriter(el, text, speed) {
  el.textContent = "";
  el.classList.add("typewriter");
  let i = 0;
  return new Promise((resolve) => {
    (function step() {
      el.textContent = text.slice(0, i);
      i++;
      if (i <= text.length) {
        setTimeout(step, speed);
      } else {
        resolve();
      }
    })();
  });
}

// Grille des avatars pop culture, réutilisée à la création du profil et dans
// Personnalisation. container : élément DOM (la grille elle-même, class
// "avatar-picker"). onPick(value) : callback. Une barre de recherche est
// insérée juste avant la grille : elle interroge Wikipédia (ApiAdapters.
// searchAvatar) et ajoute les photos trouvées en tête de grille, recadrées en
// cercle comme les silhouettes dessinées — même geste que choisir un avatar
// tout fait, juste avec un personnage cherché à la volée.
function buildAvatarPicker(container, onPick, currentValue) {
  let searchWrap = container.previousElementSibling;
  if (!searchWrap || !searchWrap.classList.contains("avatar-search-wrap")) {
    searchWrap = document.createElement("div");
    searchWrap.className = "avatar-search-wrap";
    searchWrap.innerHTML = `
      <input type="text" class="avatar-search-input" placeholder="Chercher un personnage (Dark Vador, Sherlock...)" autocomplete="off">
      <p class="avatar-search-hint hint"></p>`;
    container.insertAdjacentElement("beforebegin", searchWrap);
  }
  const searchInput = searchWrap.querySelector(".avatar-search-input");
  const searchHint = searchWrap.querySelector(".avatar-search-hint");

  const curatedItems = Object.entries(POPCULTURE_AVATARS).map(([id, a]) => ({
    value: `avatar:${id}`,
    html: `<svg viewBox="0 0 40 40">${a.g}</svg>`,
    title: a.nom,
  }));

  function renderItems(extraItems) {
    const items = [...(extraItems || []), ...curatedItems];
    // Garde la sélection actuelle visible même si c'est une photo qui ne fait
    // partie ni des résultats affichés ni des avatars tout faits.
    if (currentValue && currentValue.startsWith("img:") && !items.some((i) => i.value === currentValue)) {
      items.unshift({ value: currentValue, html: `<img src="${esc(currentValue.slice(4))}" alt="">`, title: "Personnalisé" });
    }
    container.innerHTML = "";
    items.forEach((item) => {
      const opt = document.createElement("div");
      opt.className = "avatar-option";
      if (item.title) opt.title = item.title;
      opt.innerHTML = item.html;
      if (item.value === currentValue) opt.classList.add("selected");
      opt.addEventListener("click", () => {
        onPick(item.value);
        container.querySelectorAll(".avatar-option").forEach((o) => o.classList.remove("selected"));
        opt.classList.add("selected");
      });
      container.appendChild(opt);
    });
    if (!currentValue && container.firstElementChild) container.firstElementChild.classList.add("selected");
  }

  renderItems();

  let searchToken = 0;
  let debounceTimer = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) { searchHint.textContent = ""; renderItems(); return; }
    debounceTimer = setTimeout(() => runAvatarSearch(q), 400);
  });

  async function runAvatarSearch(q) {
    const myToken = ++searchToken;
    searchHint.textContent = "Recherche…";
    const results = typeof ApiAdapters !== "undefined" ? await ApiAdapters.searchAvatar(q) : [];
    if (myToken !== searchToken || searchInput.value.trim() !== q) return;
    const withImage = results.filter((r) => r.image);
    searchHint.textContent = withImage.length ? "" : "Aucune image trouvée pour cette recherche.";
    renderItems(withImage.map((r) => ({ value: `img:${r.image}`, html: `<img src="${esc(r.image)}" alt="">`, title: r.titre })));
  }
}

function requireProfile() {
  const p = ActiveProfile.get();
  if (!p) {
    location.href = "index.html";
    return null;
  }
  return p;
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
