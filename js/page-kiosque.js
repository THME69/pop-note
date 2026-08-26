const profile = requireProfile();
document.getElementById("profilePill").innerHTML = `<span class="pill-icon">${renderProfileIcon(profile.icone)}</span> ${esc(profile.nom)}`;
document.getElementById("catTitle").innerHTML = `<span class="badge-icon" style="width:1em;height:1em;display:inline-flex;vertical-align:-0.12em;margin-right:8px;">${CATEGORY_ICONS.kiosque}</span>Kiosque`;

let items = [];
let activeFilter = "all";

function categoryBadgeHtml(catId) {
  const meta = categoryMeta(catId) || {};
  const icon = (typeof CATEGORY_ICONS !== "undefined" && CATEGORY_ICONS[catId]) || "";
  return `<div class="card-category-badge" style="--cat-color:${meta.accent || "inherit"}">${icon ? `<span class="badge-icon">${icon}</span>` : ""}<span class="badge-name">${esc(meta.nom || catId)}</span></div>`;
}

function renderFilters() {
  const box = document.getElementById("kioskFilters");
  const catsPresent = Array.from(new Set(items.map((i) => i.categorie)));
  const opts = [{ id: "all", nom: "Tout" }, ...catsPresent.map((c) => categoryMeta(c) || { id: c, nom: c })];
  box.innerHTML = opts.map((c) => `<button type="button" class="kiosk-filter-btn${activeFilter === c.id ? " active" : ""}" data-cat="${esc(c.id)}">${esc(c.nom)}</button>`).join("");
  box.querySelectorAll("[data-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.cat;
      renderFilters();
      renderList();
    });
  });
}

function rowHtml(k) {
  return `
    <div class="kiosk-row">
      ${categoryBadgeHtml(k.categorie)}
      <div class="kiosk-row-main">
        <div class="kiosk-row-titre">${esc(k.titre)}</div>
        ${k.auteur ? `<div class="kiosk-row-auteur">${esc(k.auteur)}</div>` : ""}
      </div>
      <button type="button" class="kiosk-remove" data-id="${esc(k.id)}" aria-label="Retirer du kiosque" title="Retirer du kiosque">&times;</button>
    </div>`;
}

function renderList() {
  const list = document.getElementById("kioskList");
  const filtered = activeFilter === "all" ? items : items.filter((i) => i.categorie === activeFilter);
  if (!filtered.length) {
    list.innerHTML = `<p class="empty-state">${items.length ? "Rien dans cette catégorie." : "Rien pour l'instant. Mets une œuvre de côté depuis l'activité récente ou le top de la semaine."}</p>`;
    return;
  }
  list.innerHTML = filtered.map(rowHtml).join("");
  list.querySelectorAll("[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await Store.removeFromKiosque(profile.id, btn.dataset.id);
      await load();
    });
  });
}

async function load() {
  items = await Store.readKiosque(profile.id);
  if (activeFilter !== "all" && !items.some((i) => i.categorie === activeFilter)) activeFilter = "all";
  renderFilters();
  renderList();
}

load();
