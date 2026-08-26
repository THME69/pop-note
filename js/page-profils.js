let selectedIcon = "avatar:" + Object.keys(POPCULTURE_AVATARS)[0];
let selectedColor = PROFILE_COLORS[0];

function enterProfile(p) {
  UnlockedProfiles.add(p.id);
  ActiveProfile.set(p);
  location.href = "hub.html";
}

async function renderProfiles() {
  const grid = document.getElementById("profileGrid");
  grid.innerHTML = "";
  const [allProfiles] = await Promise.all([
    Store.readProfiles(),
    typewriter(document.getElementById("appTitle"), "PopNote", 75),
  ]);

  // Les profils déjà ouverts sur cet appareil passent en premier et sont mis
  // en valeur ; les autres gardent leur ordre et affichent un cadenas s'ils
  // sont protégés par un code PIN jamais saisi ici.
  const profiles = allProfiles.slice().sort((a, b) => {
    const ua = UnlockedProfiles.has(a.id) ? 0 : 1;
    const ub = UnlockedProfiles.has(b.id) ? 0 : 1;
    return ua - ub;
  });

  profiles.forEach((p, i) => {
    const unlocked = UnlockedProfiles.has(p.id);
    const locked = !!p.pin && !unlocked;
    const card = document.createElement("div");
    card.className = "profile-card fade-in-up" + (unlocked ? " trusted" : "") + (locked ? " locked" : "");
    card.style.setProperty("--profile-color", p.couleur);
    card.style.animationDelay = `${i * 90}ms`;
    card.innerHTML = `
      <div class="profile-avatar">
        ${renderProfileIcon(p.icone)}
        ${locked ? `<span class="profile-lock-badge" title="Code PIN requis">${ICON_LOCK}</span>` : ""}
      </div>
      <div class="profile-name">${esc(p.nom)}</div>`;
    card.addEventListener("click", () => {
      if (locked) openPinModal(p);
      else enterProfile(p);
    });
    grid.appendChild(card);
  });

  const addCard = document.createElement("div");
  addCard.className = "profile-card add-new fade-in-up";
  addCard.style.animationDelay = `${profiles.length * 90}ms`;
  addCard.innerHTML = `<div class="profile-avatar">+</div><div class="profile-name">Nouveau</div>`;
  addCard.addEventListener("click", openNewProfileModal);
  grid.appendChild(addCard);
}

const ICON_LOCK = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-width="2" fill="none"/></svg>`;

// ---------- clavier numérique générique (déverrouillage + création de PIN) ----------
function buildNumericKeypad(container, onDigit, onDelete) {
  container.innerHTML = "";
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
  keys.forEach((k) => {
    const btn = document.createElement("button");
    btn.type = "button";
    if (k === "") {
      btn.className = "pin-key pin-key-empty";
      btn.disabled = true;
    } else if (k === "del") {
      btn.className = "pin-key pin-key-del";
      btn.innerHTML = "&larr;";
      btn.addEventListener("click", onDelete);
    } else {
      btn.className = "pin-key";
      btn.textContent = k;
      btn.addEventListener("click", () => onDigit(k));
    }
    container.appendChild(btn);
  });
}
function renderPinDotsIn(container, length) {
  container.querySelectorAll("span").forEach((dot, i) => dot.classList.toggle("filled", i < length));
}
function shakeModal(modal) {
  modal.classList.remove("pin-shake");
  requestAnimationFrame(() => modal.classList.add("pin-shake"));
}

// ---------- déverrouillage par code PIN ----------
let pinTarget = null;
let pinBuffer = "";

function appendPinDigit(d) {
  if (pinBuffer.length >= 4) return;
  document.getElementById("pinError").textContent = " ";
  pinBuffer += d;
  renderPinDotsIn(document.getElementById("pinDots"), pinBuffer.length);
  if (pinBuffer.length === 4) checkPin();
}

function deletePinDigit() {
  document.getElementById("pinError").textContent = " ";
  pinBuffer = pinBuffer.slice(0, -1);
  renderPinDotsIn(document.getElementById("pinDots"), pinBuffer.length);
}

function checkPin() {
  if (!pinTarget) return;
  if (hashPin(pinBuffer) === pinTarget.pin) {
    hideModal("pinBackdrop");
    enterProfile(pinTarget);
    return;
  }
  document.getElementById("pinError").textContent = "Code incorrect, réessaie.";
  shakeModal(document.querySelector("#pinBackdrop .modal"));
  pinBuffer = "";
  renderPinDotsIn(document.getElementById("pinDots"), 0);
}

function openPinModal(p) {
  pinTarget = p;
  document.getElementById("pinAvatar").style.setProperty("--profile-color", p.couleur);
  document.getElementById("pinAvatar").innerHTML = renderProfileIcon(p.icone);
  document.getElementById("pinProfileName").textContent = p.nom;
  buildNumericKeypad(document.getElementById("pinKeypad"), appendPinDigit, deletePinDigit);
  pinBuffer = "";
  document.getElementById("pinError").textContent = " ";
  renderPinDotsIn(document.getElementById("pinDots"), 0);
  showModal("pinBackdrop");
}

document.getElementById("pinModalClose").addEventListener("click", () => hideModal("pinBackdrop"));
document.getElementById("pinBackdrop").addEventListener("click", (e) => {
  if (e.target.id === "pinBackdrop") hideModal("pinBackdrop");
});
document.addEventListener("keydown", (e) => {
  if (!document.getElementById("pinBackdrop").classList.contains("open")) return;
  if (e.key >= "0" && e.key <= "9") appendPinDigit(e.key);
  else if (e.key === "Backspace") deletePinDigit();
  else if (e.key === "Escape") hideModal("pinBackdrop");
});

// ---------- création de profil : étape 2, choix du code PIN au clavier ----------
// Un code PIN se saisit puis se confirme (retapé), comme un verrou de
// téléphone — jamais via deux champs texte où une faute de frappe passerait
// inaperçue.
let newProfileDraft = null;
let newPinBuffer = "";
let newPinFirstCode = null;
let newPinStage = "enter";

function startPinEntry() {
  newPinStage = "enter";
  newPinFirstCode = null;
  newPinBuffer = "";
  document.getElementById("newPinTitle").textContent = "Choisis un code PIN";
  document.getElementById("newPinSub").textContent = "Il sera redemandé pour ouvrir ce profil sur un nouvel appareil.";
  document.getElementById("newPinError").textContent = " ";
  renderPinDotsIn(document.getElementById("newPinDots"), 0);
}

function appendNewPinDigit(d) {
  if (newPinBuffer.length >= 4) return;
  document.getElementById("newPinError").textContent = " ";
  newPinBuffer += d;
  renderPinDotsIn(document.getElementById("newPinDots"), newPinBuffer.length);
  if (newPinBuffer.length < 4) return;

  if (newPinStage === "enter") {
    newPinFirstCode = newPinBuffer;
    newPinBuffer = "";
    newPinStage = "confirm";
    document.getElementById("newPinTitle").textContent = "Confirme le code";
    document.getElementById("newPinSub").textContent = "Retape le même code.";
    renderPinDotsIn(document.getElementById("newPinDots"), 0);
    return;
  }

  if (newPinBuffer !== newPinFirstCode) {
    document.getElementById("newPinError").textContent = "Les deux codes ne correspondent pas, recommence.";
    shakeModal(document.querySelector("#newProfileBackdrop .modal"));
    // Repart de l'étape "choisis un code", sans passer par startPinEntry()
    // qui effacerait aussitôt le message d'erreur qu'on vient d'afficher.
    newPinStage = "enter";
    newPinFirstCode = null;
    newPinBuffer = "";
    document.getElementById("newPinTitle").textContent = "Choisis un code PIN";
    document.getElementById("newPinSub").textContent = "Il sera redemandé pour ouvrir ce profil sur un nouvel appareil.";
    renderPinDotsIn(document.getElementById("newPinDots"), 0);
    return;
  }
  createProfileWithPin(newPinFirstCode);
}

function deleteNewPinDigit() {
  document.getElementById("newPinError").textContent = " ";
  newPinBuffer = newPinBuffer.slice(0, -1);
  renderPinDotsIn(document.getElementById("newPinDots"), newPinBuffer.length);
}

async function createProfileWithPin(pin) {
  const profiles = await Store.readProfiles();
  const nom = newProfileDraft.nom;
  const id = slugify(nom) + (profiles.some((p) => p.id === slugify(nom)) ? "-" + uid().slice(0, 4) : "");
  // following: [] explicite — sans ça, un profil sans liste de suivi hérite du
  // comportement historique "suit tout le monde" (voir getFollowing dans
  // page-hub.js), ce qui n'a plus de sens pour un nouveau profil : il doit
  // partir de zéro et découvrir les autres via "Trouver des amis".
  const profile = { id, nom, icone: newProfileDraft.icone, couleur: newProfileDraft.couleur, categories: CATEGORY_ORDER.slice(), following: [], pin: hashPin(pin) };
  profiles.push(profile);
  await Store.writeProfiles(profiles);
  hideModal("newProfileBackdrop");
  // Créé sur cet appareil : pas besoin de redemander le code tout de suite.
  UnlockedProfiles.add(id);
  ActiveProfile.set(profile);
  location.href = "personnalisation.html?onboarding=1";
}

function buildPicker(containerId, values, onPick, current) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  values.forEach((v) => {
    const item = document.createElement("div");
    item.className = "search-result";
    if (containerId === "pColorPicker") {
      item.innerHTML = `<div class="ph" style="background:${v};border-color:${v}"></div>`;
    } else {
      item.innerHTML = `<div class="ph" style="font-size:1.3rem;">${v}</div>`;
    }
    item.addEventListener("click", () => {
      onPick(v);
      el.querySelectorAll(".ph").forEach((p) => (p.style.outline = ""));
      item.querySelector(".ph").style.outline = `2px solid var(--ink)`;
    });
    el.appendChild(item);
  });
}

function openNewProfileModal() {
  document.getElementById("newProfileForm").reset();
  document.getElementById("newProfileForm").style.display = "";
  document.getElementById("profilePinStep").style.display = "none";
  selectedIcon = "avatar:" + Object.keys(POPCULTURE_AVATARS)[0];
  selectedColor = PROFILE_COLORS[0];
  buildAvatarPicker(document.getElementById("pIconPicker"), (v) => (selectedIcon = v));
  buildPicker("pColorPicker", PROFILE_COLORS, (v) => (selectedColor = v));
  showModal("newProfileBackdrop");
}

// Étape 1 (identité) validée → étape 2 (code PIN), sur la même modale.
document.getElementById("newProfileForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const nom = document.getElementById("pName").value.trim();
  if (!nom) return;
  newProfileDraft = { nom, icone: selectedIcon, couleur: selectedColor };
  document.getElementById("newProfileForm").style.display = "none";
  document.getElementById("profilePinStep").style.display = "";
  document.getElementById("newPinAvatar").style.setProperty("--profile-color", newProfileDraft.couleur);
  document.getElementById("newPinAvatar").innerHTML = renderProfileIcon(newProfileDraft.icone);
  buildNumericKeypad(document.getElementById("newPinKeypad"), appendNewPinDigit, deleteNewPinDigit);
  startPinEntry();
});

document.getElementById("profileBackBtn").addEventListener("click", () => {
  document.getElementById("profilePinStep").style.display = "none";
  document.getElementById("newProfileForm").style.display = "";
});

document.addEventListener("keydown", (e) => {
  const pinStepOpen = document.getElementById("newProfileBackdrop").classList.contains("open")
    && document.getElementById("profilePinStep").style.display !== "none";
  if (!pinStepOpen) return;
  if (e.key >= "0" && e.key <= "9") appendNewPinDigit(e.key);
  else if (e.key === "Backspace") deleteNewPinDigit();
});

document.getElementById("newProfileClose").addEventListener("click", () => hideModal("newProfileBackdrop"));
document.getElementById("newProfileCancel").addEventListener("click", () => hideModal("newProfileBackdrop"));
document.getElementById("newProfileBackdrop").addEventListener("click", (e) => {
  if (e.target.id === "newProfileBackdrop") hideModal("newProfileBackdrop");
});

ActiveProfile.clear();
renderProfiles();
