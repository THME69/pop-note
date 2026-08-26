const profile = requireProfile();
let allProfilesCache = [];

function categoryHref(cat) {
  return `collection.html?cat=${cat}`;
}

function categoryBadgeHtml(catId) {
  const meta = categoryMeta(catId) || {};
  const icon = (typeof CATEGORY_ICONS !== "undefined" && CATEGORY_ICONS[catId]) || "";
  return `<div class="card-category-badge" style="--cat-color:${meta.accent || "inherit"}">${icon ? `<span class="badge-icon">${icon}</span>` : ""}<span class="badge-name">${esc(meta.nom || catId)}</span></div>`;
}

// Profils sans liste "following" explicite : on considère qu'ils suivent tout
// le monde par défaut (comportement historique, avant l'ajout du follow).
function getFollowing(p, allProfiles) {
  if (p.following) return p.following;
  return allProfiles.filter((x) => x.id !== p.id).map((x) => x.id);
}

async function renderProfileHeader() {
  allProfilesCache = await Store.readProfiles();
  document.getElementById("hubProfileAvatar").innerHTML = renderProfileIcon(profile.icone);
  document.getElementById("chipCoeurIcon").innerHTML = CATEGORY_ICONS.coeur;
  document.getElementById("chipKiosqueIcon").innerHTML = CATEGORY_ICONS.kiosque;
  document.getElementById("hubTitle").textContent = `Bonjour ${profile.nom}`;
  document.getElementById("followerLine").textContent = "";
  const pill = document.getElementById("profilePill");
  pill.innerHTML = `<span class="pill-icon">${renderProfileIcon(profile.icone)}</span> ${esc(profile.nom)} · personnaliser`;

  const followerCount = allProfilesCache.filter(
    (p) => p.id !== profile.id && getFollowing(p, allProfilesCache).includes(profile.id)
  ).length;
  document.getElementById("dashChips").innerHTML = followerCount > 0
    ? `<div class="dash-chip"><b>${followerCount}</b> ${followerCount > 1 ? "vous suivent" : "vous suit"}</div>`
    : "";

  updateFriendBadge();
}

// ---------- pastille "nouveau profil" sur Trouver des amis ----------
// Un profil pas encore vu (jamais croisé dans "Trouver des amis" depuis sa
// création) déclenche une petite pastille "+" — repartie à zéro dès qu'on
// ouvre la modale, qui marque tous les profils du moment comme vus.
function updateFriendBadge() {
  const seen = profile.friendNotifSeen || [];
  const hasUnseen = allProfilesCache.some((p) => p.id !== profile.id && !seen.includes(p.id));
  document.getElementById("newFriendBadge").style.display = hasUnseen ? "" : "none";
}
async function markAllProfilesSeen() {
  const seenIds = allProfilesCache.filter((p) => p.id !== profile.id).map((p) => p.id);
  const profiles = await Store.readProfiles();
  const me = profiles.find((p) => p.id === profile.id);
  if (me) {
    me.friendNotifSeen = seenIds;
    await Store.writeProfiles(profiles);
  }
  profile.friendNotifSeen = seenIds;
  ActiveProfile.set({ ...profile });
  updateFriendBadge();
}

// ---------- trouver des amis / suivre ----------
async function renderFriendResults() {
  const q = document.getElementById("friendSearch").value.trim().toLowerCase();
  const resultsEl = document.getElementById("friendResults");
  const profiles = await Store.readProfiles();
  allProfilesCache = profiles;
  const myFollowing = new Set(getFollowing(profile, profiles));
  const matches = profiles.filter((p) => p.id !== profile.id && (!q || p.nom.toLowerCase().includes(q)));
  if (!matches.length) {
    resultsEl.innerHTML = `<p class="empty-state">${q ? "Aucun profil trouvé." : "Tape un prénom pour chercher."}</p>`;
    return;
  }
  resultsEl.innerHTML = matches.map((p) => `
    <div class="friend-row">
      <div class="friend-avatar">${renderProfileIcon(p.icone)}</div>
      <div class="friend-name">${esc(p.nom)}</div>
      <button type="button" class="btn ${myFollowing.has(p.id) ? "" : "btn-primary"}" data-follow="${esc(p.id)}">${myFollowing.has(p.id) ? "Suivi ✓" : "Suivre"}</button>
    </div>`).join("");
  resultsEl.querySelectorAll("[data-follow]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetId = btn.dataset.follow;
      const profiles2 = await Store.readProfiles();
      const me = profiles2.find((p) => p.id === profile.id);
      const following = new Set(getFollowing(me, profiles2));
      if (following.has(targetId)) following.delete(targetId); else following.add(targetId);
      me.following = Array.from(following);
      await Store.writeProfiles(profiles2);
      profile.following = me.following;
      ActiveProfile.set({ ...profile });
      await renderFriendResults();
      await renderProfileHeader();
      await renderActivite();
    });
  });
}
document.getElementById("friendSearch").addEventListener("input", renderFriendResults);
document.getElementById("findFriendsBtn").addEventListener("click", () => {
  document.getElementById("friendSearch").value = "";
  renderFriendResults();
  showModal("findFriendsBackdrop");
  markAllProfilesSeen();
});
document.getElementById("findFriendsClose").addEventListener("click", () => hideModal("findFriendsBackdrop"));
document.getElementById("findFriendsBackdrop").addEventListener("click", (e) => {
  if (e.target.id === "findFriendsBackdrop") hideModal("findFriendsBackdrop");
});

function renderHubGrid() {
  const grid = document.getElementById("hubGrid");
  const activeCats = activeCategoriesOf(profile);
  grid.innerHTML = "";
  let i = 0;
  function addTile(id, href, meta, icon) {
    const a = document.createElement("a");
    a.className = "dash-tile";
    a.href = href;
    a.style.setProperty("--cat-color", meta.accent);
    a.style.setProperty("--i", i++);
    a.innerHTML = `<div class="icon">${icon}</div><div class="name">${esc(meta.nom)}</div>`;
    grid.appendChild(a);
  }
  activeCats.forEach((catId) => {
    const meta = categoryMeta(catId);
    if (!meta) return;
    addTile(catId, categoryHref(catId), meta, CATEGORY_ICONS[catId] || "");
  });
  // Coup de cœur et Kiosque vivent désormais dans le bandeau (chips en haut à
  // droite, avec les stats) — voir renderProfileHeader — pas ici avec les
  // catégories, ce ne sont pas des catégories de collection.
  if (!activeCats.length) {
    grid.insertAdjacentHTML("afterbegin", `<p class="empty-state">Aucune catégorie activée. <a href="personnalisation.html">Choisis-en au moins une →</a></p>`);
  }
}

// Réactions "texte" plutôt qu'émoji — moins visuelles nativement, donc on les
// affiche en gras, colorées à l'accent, dans la police éditoriale du site pour
// qu'elles fassent quand même de l'effet.
const REACTION_OPTIONS = [":)", ":(", "<3", "lol"];

// Anciennes réactions enregistrées avant ce changement : on les fait
// correspondre à la nouvelle palette au moment de l'affichage, sans avoir à
// toucher aux données déjà stockées chez les gens.
const LEGACY_EMOJI_MAP = {
  "👍": ":)", "😮": ":)", "👏": ":)", "🤔": ":)",
  "❤️": "<3", "🔥": "<3", "💯": "<3",
  "😂": "lol", "🎉": "lol",
  "😢": ":(",
};
function normalizeGlyph(glyph) {
  return LEGACY_EMOJI_MAP[glyph] || glyph;
}

function reactionsCommentsHtml(reactions) {
  const withComment = reactions.filter((r) => r.commentaire);
  if (!withComment.length) return "";
  return `<div class="reactions-comments">${withComment.map((r) => `
    <div class="reaction-comment-line"><span class="reaction-glyph">${esc(normalizeGlyph(r.emoji))}</span> <strong>${esc(r.profilNom)}</strong> : ${esc(r.commentaire)}</div>
  `).join("")}</div>`;
}

// Une pastille par option de réaction utilisée (jamais superposées : ça
// s'enchaîne en ligne et ça passe à la ligne suivante s'il en faut plus).
function reactionsStickersHtml(reactions) {
  const emojiOnly = reactions.filter((r) => !r.commentaire);
  if (!emojiOnly.length) return "";
  const groups = {};
  emojiOnly.forEach((r) => {
    const glyph = normalizeGlyph(r.emoji);
    (groups[glyph] = groups[glyph] || []).push(r.profilNom);
  });
  return `<div class="reactions-pills">${Object.entries(groups).map(([glyph, names]) => {
    const count = names.length > 1 ? `<span class="sticker-count">${names.length}</span>` : "";
    return `<span class="reaction-sticker" title="${esc(names.join(", "))}">${esc(glyph)}${count}</span>`;
  }).join("")}</div>`;
}

function reactionFabAndForm(id) {
  return `
    <button type="button" class="reaction-toggle reaction-fab" data-event-id="${esc(id)}" aria-label="Réagir">
      <span class="fab-emoji">:)</span><span class="fab-plus">+</span>
    </button>
    <div class="reaction-form" id="reactForm-${esc(id)}">
      <div class="emoji-picker">${REACTION_OPTIONS.map((e) => `<button type="button" class="emoji-opt" data-emoji="${e}">${e}</button>`).join("")}</div>
      <input type="text" class="reaction-comment" placeholder="Commentaire (optionnel)" maxlength="80">
    </div>`;
}

// ---------- Kiosque : mettre de côté un item vu en activité / top de la semaine ----------
let kiosqueCache = [];
let lastActiviteEvents = [];

async function loadKiosqueCache() {
  kiosqueCache = await Store.readKiosque(profile.id);
}
function kiosqueEntryFor(sourceId) {
  return kiosqueCache.find((k) => k.sourceId === sourceId) || null;
}
// L'auteur n'a de sens que pour les catégories qui le déclarent (livres, BD...) ;
// on va le chercher dans le catalogue plutôt que de le dupliquer dans l'événement.
async function findAuteurFor(categorie, itemId, externalId) {
  const catMeta = CATEGORIES[categorie];
  if (!catMeta || !(catMeta.champsCatalogueExtra || []).some((f) => f.key === "auteur")) return null;
  const catalogue = await Store.readCatalogue(categorie);
  const item = itemId ? catalogue.find((i) => i.id === itemId) : (externalId ? catalogue.find((i) => i.externalId === externalId) : null);
  return (item && item.auteur) || null;
}
function kioskFabHtml(id) {
  const active = !!kiosqueEntryFor(id);
  const label = active ? "Retirer du kiosque" : "Ajouter au kiosque";
  return `<button type="button" class="kiosk-fab${active ? " active" : ""}" data-kiosk-toggle="${esc(id)}" aria-label="${label}" title="${label}">${CATEGORY_ICONS.kiosque}</button>`;
}
// container : élément parent contenant des [data-kiosk-toggle]
// buildKioskItem(id) : construit { sourceId, titre, auteur, categorie, itemId } à ajouter
// onDone() : re-rendu après bascule
function bindKioskToggles(container, buildKioskItem, onDone) {
  container.querySelectorAll("[data-kiosk-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.kioskToggle;
      const existing = kiosqueEntryFor(id);
      if (existing) {
        await Store.removeFromKiosque(profile.id, existing.id);
      } else {
        const item = await buildKioskItem(id);
        if (item) await Store.addToKiosque(profile.id, item);
      }
      await loadKiosqueCache();
      await onDone();
    });
  });
}

// ---------- "Vu" : masquer une carte d'activité récente pour ce profil ----------
const EYE_ICON = `
  <svg viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 16C8 6 16 2 24 2s16 4 22 14c-6 10-14 14-22 14S8 26 2 16Z" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/>
    <circle cx="24" cy="16" r="6" stroke="currentColor" stroke-width="2.6"/>
  </svg>`;
function dismissFabHtml(id) {
  return `<button type="button" class="dismiss-fab" data-dismiss-id="${esc(id)}" aria-label="Marquer comme vu" title="Marquer comme vu">${EYE_ICON}</button>`;
}
async function dismissActiviteEvent(id, currentEventIds) {
  const profiles = await Store.readProfiles();
  const me = profiles.find((p) => p.id === profile.id);
  // On ne garde dans la liste que des ids d'événements encore présents dans le
  // fil (celui-ci est lui-même plafonné à 30 entrées) : ça évite de la faire
  // grossir indéfiniment avec des événements depuis longtemps disparus.
  const kept = (me && me.dismissedActivite || []).filter((eid) => currentEventIds.has(eid));
  const next = [...kept, id];
  if (me) {
    me.dismissedActivite = next;
    await Store.writeProfiles(profiles);
  }
  profile.dismissedActivite = next;
  ActiveProfile.set({ ...profile });
}
function bindDismissButtons(container, currentEventIds, onDone) {
  container.querySelectorAll("[data-dismiss-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.dismissId;
      const card = btn.closest(".activite-item");
      card.classList.add("fade-out-up");
      await dismissActiviteEvent(id, currentEventIds);
      setTimeout(onDone, 320);
    });
  });
}

// Petit badge affiché sous la vignette d'un item, dans l'activité récente et
// le Top de la semaine, quand son créateur en a fait un coup de cœur.
function coeurBadgeHtml(profilNom) {
  return `<div class="coeur-badge" title="Coup de cœur de ${esc(profilNom || "")}">${CATEGORY_ICONS.coeur} Coup de cœur</div>`;
}

// Lu en direct dans la collection du profil plutôt que figé au moment de
// l'ajout : un item peut être mis en coup de cœur bien après avoir été
// ajouté (bouton cœur sur la carte de la collection), l'activité récente
// doit refléter l'état actuel, pas celui du jour de l'ajout.
async function findCoeurForEvent(ev) {
  if (!ev.itemId) return false;
  const profilData = await Store.readProfilData(ev.profilId, ev.categorie);
  const entry = profilData[ev.itemId];
  return !!(entry && entry.coeur);
}

// Carte "activité" partagée entre le fil de l'activité récente et la
// diapositive "Dernier avis d'un ami" de Top de la semaine — même geste
// visuel des deux côtés. withDismiss=false pour la diapositive : la
// masquer n'aurait pas de sens hors du fil.
function activiteCardHtml(ev, coeur, withDismiss) {
  const thumb = ev.image
    ? `<img class="thumb" src="${esc(ev.image)}" alt="">`
    : `<div class="thumb-ph"></div>`;
  const href = categoryHref(ev.categorie) + `&id=${encodeURIComponent(ev.itemId || "")}`;
  const reactions = ev.reactions || [];
  return `
    <div class="activite-item proposal-item">
      ${categoryBadgeHtml(ev.categorie)}
      ${withDismiss ? dismissFabHtml(ev.id) : ""}
      <a class="proposal-link" href="${href}">
        <div class="thumb-col">
          ${thumb}
          ${coeur ? coeurBadgeHtml(ev.profilNom) : ""}
        </div>
        <div class="info">
          <div class="titre">${esc(ev.titre)}</div>
          <div class="meta">${esc(ev.profilNom || "")} · ajouté${ev.note ? ` · <span class="meta-stars">${starString(ev.note)}</span>` : ""}</div>
          ${ev.avis ? `<div class="proposal-resume">${esc(truncate(ev.avis, 110))}</div>` : ""}
          ${reactionsCommentsHtml(reactions)}
          ${reactionsStickersHtml(reactions)}
        </div>
      </a>
      ${reactionFabAndForm(ev.id)}
      ${kioskFabHtml(ev.id)}
    </div>`;
}

async function renderActivite() {
  const list = document.getElementById("activiteList");
  const allEvents = await Store.readActivite();
  const myFollowing = getFollowing(profile, allProfilesCache);
  const dismissed = new Set(profile.dismissedActivite || []);
  const events = allEvents
    .filter((ev) => (ev.profilId === profile.id || myFollowing.includes(ev.profilId)) && !dismissed.has(ev.id))
    .slice(0, 8);
  lastActiviteEvents = events;
  if (!events.length) {
    list.innerHTML = `<p class="empty-state">Rien pour l'instant. Les derniers ajouts et notes des profils que tu suis apparaîtront ici.</p>`;
    return;
  }
  list.innerHTML = (await Promise.all(events.map(async (ev) => {
    const coeur = await findCoeurForEvent(ev);
    return activiteCardHtml(ev, coeur, true);
  }))).join("");
  bindDismissButtons(list, new Set(allEvents.map((e) => e.id)), renderActivite);
  bindReactionForms(list, (id, r) => Store.addReaction(id, r), renderActivite);
  bindKioskToggles(list, async (id) => {
    const ev2 = lastActiviteEvents.find((e) => e.id === id);
    if (!ev2) return null;
    const auteur = await findAuteurFor(ev2.categorie, ev2.itemId, null);
    return { sourceId: ev2.id, titre: ev2.titre, auteur, categorie: ev2.categorie, itemId: ev2.itemId || null };
  }, renderActivite);
}

// ---------- Top de la semaine : diapositive "dernier avis d'un ami" ----------
// Cherche, parmi les profils suivis, l'événement d'activité le plus récent où
// un avis a réellement été rempli (pas juste une note) — pour la diapositive
// qui alterne avec le Top de la semaine dans le même encart.
async function findLatestFriendAvis() {
  const [allEvents, allProfiles] = await Promise.all([Store.readActivite(), Store.readProfiles()]);
  const myFollowing = new Set(getFollowing(profile, allProfiles));
  return allEvents.find((ev) => ev.profilId !== profile.id && myFollowing.has(ev.profilId) && ev.avis && ev.avis.trim()) || null;
}

async function renderFriendAvisSlide() {
  const container = document.getElementById("friendAvisCard");
  const ev = await findLatestFriendAvis();
  if (!ev) {
    container.innerHTML = `<p class="empty-state">Aucun avis d'ami pour l'instant.</p>`;
    return null;
  }
  container.innerHTML = kickerCardHtml({
    image: ev.image,
    titre: ev.titre,
    meta: ev.profilNom + (ev.note ? ` · ${starString(ev.note)}` : ""),
    avis: ev.avis,
    solo: true,
  });
  return ev;
}

// ---------- Top de la semaine : diapositive "dernier coup de cœur d'un ami" ----------
// Même principe que findLatestFriendAvis, mais le coup de cœur est calculé à
// la volée (findCoeurForEvent) plutôt que stocké sur l'événement — un ami peut
// mettre en coup de cœur bien après l'ajout — donc on parcourt les événements
// du plus récent au plus ancien jusqu'au premier qui est actuellement un coup
// de cœur chez son auteur.
async function findLatestFriendCoeur() {
  const [allEvents, allProfiles] = await Promise.all([Store.readActivite(), Store.readProfiles()]);
  const myFollowing = new Set(getFollowing(profile, allProfiles));
  for (const ev of allEvents) {
    if (ev.profilId === profile.id || !myFollowing.has(ev.profilId)) continue;
    if (await findCoeurForEvent(ev)) return ev;
  }
  return null;
}

async function renderFriendCoeurSlide() {
  const container = document.getElementById("friendCoeurCard");
  const ev = await findLatestFriendCoeur();
  if (!ev) {
    container.innerHTML = `<p class="empty-state">Aucun coup de cœur d'ami pour l'instant.</p>`;
    return null;
  }
  container.innerHTML = kickerCardHtml({
    image: ev.image,
    titre: ev.titre,
    meta: ev.profilNom + (ev.note ? ` · ${starString(ev.note)}` : ""),
    avis: ev.avis,
    solo: true,
  });
  return ev;
}

// ---------- Top de la semaine : navigation manuelle entre les diapositives ----------
// tsSlides ne contient que les diapositives ayant réellement du contenu (le
// Top de la semaine est toujours présent ; avis et coup de cœur d'ami ne
// rejoignent la rotation que s'il y a effectivement quelque chose à montrer).
// Navigation au clic (flèches + puces) uniquement — pas de défilement auto.
let tsSlides = [];
let tsSlideIndex = 0;

function tsGoTo(i) {
  tsSlideIndex = i;
  tsSlides.forEach((el, idx) => el.classList.toggle("active", idx === i));
  document.querySelectorAll(".ts-dot").forEach((el, idx) => el.classList.toggle("active", idx === i));
}
function tsPrev() { tsGoTo((tsSlideIndex - 1 + tsSlides.length) % tsSlides.length); }
function tsNext() { tsGoTo((tsSlideIndex + 1) % tsSlides.length); }

async function initTopSemaineCarousel() {
  const slide0 = document.querySelector('.ts-slide[data-slide="0"]');
  const slide1 = document.querySelector('.ts-slide[data-slide="1"]');
  const slide2 = document.querySelector('.ts-slide[data-slide="2"]');

  const [avisEv, coeurEv] = await Promise.all([renderFriendAvisSlide(), renderFriendCoeurSlide()]);

  tsSlides = [slide0];
  if (avisEv) tsSlides.push(slide1);
  if (coeurEv) tsSlides.push(slide2);

  const navRow = document.getElementById("tsNavRow");
  if (tsSlides.length > 1) {
    navRow.innerHTML = `
      <button type="button" class="ts-nav-btn" id="tsPrevBtn" aria-label="Diapositive précédente">&larr;</button>
      <div class="ts-dots">${tsSlides.map((_, i) => `<button type="button" class="ts-dot" data-i="${i}" aria-label="Diapositive ${i + 1}"></button>`).join("")}</div>
      <button type="button" class="ts-nav-btn" id="tsNextBtn" aria-label="Diapositive suivante">&rarr;</button>`;
    document.getElementById("tsPrevBtn").addEventListener("click", tsPrev);
    document.getElementById("tsNextBtn").addEventListener("click", tsNext);
    navRow.querySelectorAll(".ts-dot").forEach((el) => el.addEventListener("click", () => tsGoTo(Number(el.dataset.i))));
  } else {
    navRow.innerHTML = "";
  }
  document.querySelectorAll(".ts-slide").forEach((el) => el.classList.remove("active"));
  tsGoTo(0);
}

// container : élément parent contenant des .reaction-toggle / .reaction-form
// addReactionFn(id, reaction) : où envoyer la réaction (activité ou top de la semaine)
// onDone() : re-rendu après envoi
function bindReactionForms(container, addReactionFn, onDone) {
  container.querySelectorAll(".reaction-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById(`reactForm-${btn.dataset.eventId}`).classList.toggle("open");
    });
  });
  // Cliquer un émoji envoie la réaction directement — pas de bouton "valider"
  // à part : le commentaire, s'il y en a un de tapé, part avec.
  container.querySelectorAll(".reaction-form").forEach((form) => {
    form.querySelectorAll(".emoji-opt").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = form.id.replace("reactForm-", "");
        const commentaire = form.querySelector(".reaction-comment").value.trim();
        await addReactionFn(id, { profilId: profile.id, profilNom: profile.nom, emoji: btn.dataset.emoji, commentaire });
        await onDone();
      });
    });
  });
}

// ---------- Top de la semaine ----------
function isoWeekId(d) {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}
function nextMondayMidnight(from) {
  const d = new Date(from.getTime());
  d.setHours(0, 0, 0, 0);
  let diff = (8 - d.getDay()) % 7;
  if (diff === 0) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}
function updateTopTimer() {
  const now = new Date();
  const diffMs = nextMondayMidnight(now) - now;
  const el = document.getElementById("topTimer");
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  if (days > 0) el.textContent = `Prochain tour dans ${days}j ${hours}h`;
  else if (hours > 0) el.textContent = `Prochain tour dans ${hours}h ${minutes}min`;
  else el.textContent = `Prochain tour dans ${minutes}min`;
}

// Mini-carte sobre partagée par le gagnant de la semaine précédente et les
// deux vignettes "dernier avis / coup de cœur d'un ami" : pas de fond voyant,
// pas de phrase à rallonge, pas de réactions (trop de place) — juste le
// visuel et le titre de l'œuvre, alignés en haut plutôt que centrés. Le
// repère ("kicker") est optionnel : les diapositives avec leur propre titre
// en haut de carte n'en ont plus besoin.
function kickerCardHtml({ kicker, image, titre, meta, avis, solo }) {
  const thumb = image ? `<img class="thumb-sm" src="${esc(image)}" alt="">` : `<div class="thumb-sm-ph"></div>`;
  return `
    <div class="kicker-card${solo ? " kicker-card--solo" : ""}">
      ${thumb}
      <div class="kicker-card-info">
        ${kicker ? `<p class="kicker-label">${esc(kicker)}</p>` : ""}
        <p class="kicker-title">${esc(titre)}</p>
        ${meta ? `<p class="kicker-meta">${esc(meta)}</p>` : ""}
        ${avis ? `<p class="kicker-avis">${esc(truncate(avis, 110))}</p>` : ""}
      </div>
    </div>`;
}

async function renderTopSemaine() {
  const winnerBanner = document.getElementById("topWinnerBanner");
  const catIcon = document.getElementById("topSemaineCatIcon");
  const data = await Store.readTopSemaine();
  const now = new Date();
  const weekId = isoWeekId(now);
  const prevWeekId = isoWeekId(new Date(now.getTime() - 7 * 86400000));
  const proposals = data[weekId] || [];
  const prevProposals = data[prevWeekId] || [];

  if (prevProposals.length) {
    const winner = prevProposals.slice().sort((a, b) => (b.reactions || []).length - (a.reactions || []).length)[0];
    winnerBanner.innerHTML = kickerCardHtml({
      kicker: "Gagnant de la semaine précédente",
      image: winner.image,
      titre: winner.titre,
      meta: winner.profilNom,
      solo: true,
    });
    catIcon.innerHTML = CATEGORY_ICONS[winner.categorie] || "";
  } else {
    winnerBanner.innerHTML = "";
    catIcon.innerHTML = "";
  }

  // Déjà proposé cette semaine ? Le bandeau discret disparaît (une seule
  // proposition par profil et par semaine).
  document.getElementById("proposeBtn").style.display = proposals.some((p) => p.profilId === profile.id) ? "none" : "";
}

// ---------- bandeau discret "Proposer le tien" (modale) ----------
function populateProposeCatSelect() {
  document.getElementById("propCat").innerHTML = Object.values(CATEGORIES)
    .map((c) => `<option value="${c.id}">${esc(c.nom)}</option>`)
    .join("");
}

let proposeDebounce = null;
function proposeScheduleSearch() {
  clearTimeout(proposeDebounce);
  const q = document.getElementById("propTitle").value.trim();
  const box = document.getElementById("propSuggestions");
  if (q.length < 2) { box.innerHTML = ""; return; }
  proposeDebounce = setTimeout(() => runProposeSearch(q), 400);
}
async function runProposeSearch(q) {
  const cat = document.getElementById("propCat").value;
  const box = document.getElementById("propSuggestions");
  box.innerHTML = `<p class="hint">Recherche…</p>`;
  const results = await ApiAdapters.search(cat, q);
  if (document.getElementById("propTitle").value.trim() !== q) return;
  if (!results.length) {
    box.innerHTML = (await ApiAdapters.missingKeyFor(cat))
      ? `<p class="hint">Clé API manquante pour cette catégorie — ajoute-la dans <a href="reglages.html">Réglages</a>, ou valide avec le titre tapé.</p>`
      : `<p class="hint">Aucun résultat automatique. Tu peux valider avec le titre tapé.</p>`;
    return;
  }
  box.innerHTML = results.map((r, i) => `
    <div class="propose-suggestion-item" data-idx="${i}">
      ${r.image ? `<img src="${esc(r.image)}" alt="">` : `<div class="ph-sm"></div>`}
      <div><div class="t">${esc(r.titre)}</div>${r.annee ? `<div class="y">${esc(String(r.annee))}</div>` : ""}</div>
    </div>`).join("");
  box.querySelectorAll(".propose-suggestion-item").forEach((el) => {
    el.addEventListener("click", () => {
      const r = results[Number(el.dataset.idx)];
      document.getElementById("propTitle").value = r.titre;
      document.getElementById("propImage").value = r.image || "";
      document.getElementById("propAnnee").value = r.annee || "";
      document.getElementById("propExternalId").value = r.externalId || "";
      setImgPreview("propImagePreview", r.image);
      box.innerHTML = "";
    });
  });
}
document.getElementById("propTitle").addEventListener("input", proposeScheduleSearch);
document.getElementById("propCat").addEventListener("change", () => {
  document.getElementById("propTitle").value = "";
  document.getElementById("propImage").value = "";
  document.getElementById("propAnnee").value = "";
  document.getElementById("propExternalId").value = "";
  document.getElementById("propImagePreview").innerHTML = "";
  document.getElementById("propSuggestions").innerHTML = "";
});

function openProposeModal() {
  document.getElementById("propTitle").value = "";
  document.getElementById("propImage").value = "";
  document.getElementById("propAnnee").value = "";
  document.getElementById("propExternalId").value = "";
  document.getElementById("propImagePreview").innerHTML = "";
  document.getElementById("propSuggestions").innerHTML = "";
  populateProposeCatSelect();
  showModal("proposeBackdrop");
}
document.getElementById("proposeBtn").addEventListener("click", openProposeModal);
document.getElementById("proposeModalClose").addEventListener("click", () => hideModal("proposeBackdrop"));
document.getElementById("proposeCancelBtn").addEventListener("click", () => hideModal("proposeBackdrop"));
document.getElementById("proposeBackdrop").addEventListener("click", (e) => {
  if (e.target.id === "proposeBackdrop") hideModal("proposeBackdrop");
});

document.getElementById("proposeSubmitBtn").addEventListener("click", async () => {
  const titre = document.getElementById("propTitle").value.trim();
  if (!titre) { alert("Ajoute au moins un titre."); return; }
  const weekId = isoWeekId(new Date());
  await Store.addProposal(weekId, {
    profilId: profile.id,
    profilNom: profile.nom,
    categorie: document.getElementById("propCat").value,
    titre,
    image: document.getElementById("propImage").value || null,
    annee: document.getElementById("propAnnee").value || null,
    externalId: document.getElementById("propExternalId").value || null,
  });
  hideModal("proposeBackdrop");
  await renderTopSemaine();
});

// ---------- bouton "Ajouter" du bandeau ----------
function renderAddWorkGrid() {
  const grid = document.getElementById("addWorkGrid");
  const activeCats = activeCategoriesOf(profile);
  grid.innerHTML = activeCats.map((catId) => {
    const catMeta = categoryMeta(catId);
    const icon = CATEGORY_ICONS[catId] || "";
    return `<a class="dash-tile" href="collection.html?cat=${catId}&add=1" style="--cat-color:${catMeta.accent}"><div class="icon">${icon}</div><div class="name">${esc(catMeta.nom)}</div></a>`;
  }).join("");
}
document.getElementById("hubAddBtn").addEventListener("click", () => {
  renderAddWorkGrid();
  showModal("addWorkBackdrop");
});
document.getElementById("addWorkClose").addEventListener("click", () => hideModal("addWorkBackdrop"));
document.getElementById("addWorkBackdrop").addEventListener("click", (e) => {
  if (e.target.id === "addWorkBackdrop") hideModal("addWorkBackdrop");
});

// Aligne la hauteur de l'encart "Top de la semaine" sur celle, plus courte,
// de l'encart catégories : le contenu qui dépasse défile dans .top-proposals
// plutôt que d'agrandir la carte. Seulement sur le layout deux colonnes (au
// même seuil que .dash-row) — en dessous, les cartes s'empilent et chacune
// garde sa hauteur naturelle.
function syncTopSemaineHeight() {
  const top = document.querySelector(".hub-top-semaine");
  const bento = document.getElementById("hubGrid");
  if (!top || !bento) return;
  if (window.innerWidth <= 760) { top.style.height = ""; return; }
  top.style.height = `${bento.getBoundingClientRect().height}px`;
}
window.addEventListener("resize", syncTopSemaineHeight);

renderHubGrid();
syncTopSemaineHeight();
loadKiosqueCache().then(() => {
  renderProfileHeader().then(() => {
    renderActivite();
    initTopSemaineCarousel();
  });
  renderTopSemaine().then(syncTopSemaineHeight);
});
typewriter(document.getElementById("topSemaineTitle"), "Top de la semaine", 45);
typewriter(document.getElementById("friendAvisTitle"), "Dernier avis d'un ami", 45);
typewriter(document.getElementById("friendCoeurTitle"), "Dernier coup de cœur d'un ami", 45);
updateTopTimer();
setInterval(updateTopTimer, 60000);
