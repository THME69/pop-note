const profile = requireProfile();
document.getElementById("profilePill").innerHTML = `<span class="pill-icon">${renderProfileIcon(profile.icone)}</span> ${esc(profile.nom)}`;
document.getElementById("catTitle").innerHTML = `<span class="badge-icon" style="width:1em;height:1em;display:inline-flex;vertical-align:-0.12em;margin-right:8px;">${CATEGORY_ICONS.coeur}</span>Coup de cœur`;

function categoryBadgeHtml(catId) {
  const meta = categoryMeta(catId) || {};
  const icon = (typeof CATEGORY_ICONS !== "undefined" && CATEGORY_ICONS[catId]) || "";
  return `<div class="card-category-badge" style="--cat-color:${meta.accent || "inherit"}">${icon ? `<span class="badge-icon">${icon}</span>` : ""}<span class="badge-name">${esc(meta.nom || catId)}</span></div>`;
}

function cardHtml(entry) {
  const coverHtml = entry.image
    ? `<img class="cover" src="${esc(entry.image)}" alt="" loading="lazy" data-title="${esc(entry.titre)}">`
    : `<div class="cover-placeholder">${esc(entry.titre)}</div>`;
  return `
    <a class="card" href="collection.html?cat=${esc(entry.categorie)}&id=${esc(entry.id)}">
      <div class="cover-wrap">
        ${coverHtml}
        <div class="card-heart-badge">${CATEGORY_ICONS.coeur}</div>
      </div>
      <div class="card-body">
        ${categoryBadgeHtml(entry.categorie)}
        <p class="card-title">${esc(entry.titre)}</p>
      </div>
    </a>`;
}

async function load() {
  const list = await Store.readFavoris(profile.id);
  const content = document.getElementById("content");
  if (!list.length) {
    content.innerHTML = `<p class="empty-state">Aucun coup de cœur pour l'instant. Marque une œuvre avec le cœur en l'ajoutant à ta collection.</p>`;
    return;
  }
  content.innerHTML = `<div class="grid">${list.map(cardHtml).join("")}</div>`;
  bindImgFallback(content, "img.cover", "cover-placeholder");
}

load();
