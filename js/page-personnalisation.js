const profile = requireProfile();
const onboarding = new URLSearchParams(location.search).get("onboarding") === "1";

if (onboarding) {
  document.getElementById("pTitle").textContent = `Bienvenue ${profile.nom} !`;
  document.getElementById("pSub").textContent = "Choisis les catégories qui t'intéressent (modifiable à tout moment)";
  document.getElementById("saveCatsBtn").textContent = "C'est parti";
}

let selected = new Set(activeCategoriesOf(profile));
let selectedAvatar = profile.icone || "avatar:" + Object.keys(POPCULTURE_AVATARS)[0];

// Chaque choix (catégorie ou avatar) s'enregistre immédiatement — pas de
// bouton "Valider" à part pour l'onboarding, qui a besoin d'un geste explicite
// pour passer à la suite.
async function persistProfile() {
  const profiles = await Store.readProfiles();
  const p = profiles.find((x) => x.id === profile.id);
  const cats = CATEGORY_ORDER.filter((c) => selected.has(c));
  if (p) {
    p.categories = cats;
    p.icone = selectedAvatar;
  }
  await Store.writeProfiles(profiles);
  ActiveProfile.set({ ...profile, categories: cats, icone: selectedAvatar });
}

buildAvatarPicker(document.getElementById("avatarPicker"), (v) => {
  selectedAvatar = v;
  persistProfile();
}, selectedAvatar);

function renderList() {
  const list = document.getElementById("catList");
  list.innerHTML = "";
  allCategoriesMeta().forEach((meta) => {
    const row = document.createElement("label");
    row.className = "cat-toggle";
    const checked = selected.has(meta.id);
    const icon = (typeof CATEGORY_ICONS !== "undefined" && CATEGORY_ICONS[meta.id]) || "";
    row.innerHTML = `
      <span class="icon">${icon}</span>
      <span class="name">${esc(meta.nom)}</span>
      <span class="switch">
        <input type="checkbox" data-cat="${meta.id}" ${checked ? "checked" : ""}>
        <span class="track"></span>
      </span>`;
    row.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) selected.add(meta.id); else selected.delete(meta.id);
      persistProfile();
    });
    list.appendChild(row);
  });
}

if (onboarding) {
  document.getElementById("saveCatsBtn").addEventListener("click", () => {
    location.href = "hub.html";
  });
} else {
  document.getElementById("saveCatsWrap").remove();
}

renderList();
