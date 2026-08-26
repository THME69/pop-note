const app = document.getElementById("app");

// ---------- helpers ----------
function esc(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function starString(rating) {
  const r = rating || 0;
  return "★".repeat(r) + "☆".repeat(5 - r);
}

function initials(title) {
  return (title || "?").trim().slice(0, 2).toUpperCase();
}

function authorInitials(name) {
  return (name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function truncate(text, max) {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max).trim() + "…";
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const SPINE_COLORS = ["#8a3c22", "#3f6e5a", "#7a5a24", "#3a4f66", "#6b4a2f", "#5c3a52", "#476152", "#a8552f"];
const SPINE_WIDTH = 44;
const SPINE_GAP = 6;

function spineColor(book) {
  return SPINE_COLORS[hashStr(book.title + book.author) % SPINE_COLORS.length];
}

// La hauteur de la tranche s'adapte à la longueur du texte, pour qu'un
// titre + auteur long ne soit jamais coupé (la variété naturelle de hauteur
// vient du texte lui-même, plutôt que d'une valeur aléatoire fixe).
function spineMetrics(book) {
  const totalLen = book.title.length + book.author.length + 3;
  let fontSize = 0.82;
  if (totalLen > 60) fontSize = 0.6;
  else if (totalLen > 42) fontSize = 0.68;
  else if (totalLen > 28) fontSize = 0.75;

  const charAdvance = fontSize * 16 * 0.62;
  const neededHeight = Math.ceil(totalLen * charAdvance) + 28;
  const randomBase = 148 + (hashStr(book.id) % 58);
  const height = Math.max(randomBase, neededHeight);
  return { height, fontSize };
}

function spineHtml(book) {
  const { height, fontSize } = spineMetrics(book);
  return `
    <button type="button" class="spine" data-id="${book.id}" style="height:${height}px; background:${spineColor(book)};" title="${esc(book.title)} — ${esc(book.author)}">
      <span class="spine-text" style="font-size:${fontSize}rem">
        <span class="spine-title">${esc(book.title)}</span>
        <span class="spine-author">${esc(book.author)}</span>
      </span>
    </button>`;
}

function chunkIntoRows(books, containerWidth) {
  const perRow = Math.max(3, Math.floor((containerWidth || 900) / (SPINE_WIDTH + SPINE_GAP)));
  const rows = [];
  for (let i = 0; i < books.length; i += perRow) rows.push(books.slice(i, i + perRow));
  return rows;
}

function showModal(id) { document.getElementById(id).classList.add("open"); }
function hideModal(id) { document.getElementById(id).classList.remove("open"); }

function setCoverPreview(containerId, url) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  if (!url) return;
  const img = document.createElement("img");
  img.src = url;
  img.alt = "";
  img.addEventListener("error", () => img.remove(), { once: true });
  el.appendChild(img);
}

// ---------- Open Library lookups ----------
async function searchOpenLibraryBook(title, author) {
  try {
    const params = new URLSearchParams({ title, limit: "1" });
    if (author) params.set("author", author);
    const res = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    const doc = data.docs && data.docs[0];
    if (!doc) return null;
    return {
      coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      year: doc.first_publish_year || null,
    };
  } catch (e) {
    console.error(e);
    return null;
  }
}

// Cherche d'abord via un livre connu de l'auteur (bien plus fiable : le nom seul
// confond souvent des homonymes, ex. "Frank Herbert" l'auteur de Dune vs un
// pédagogue anglais du 19e siècle du même nom).
async function searchOpenLibraryAuthor(name, sampleTitle) {
  try {
    let authorKey = null;
    if (sampleTitle) {
      const params = new URLSearchParams({ title: sampleTitle, author: name, limit: "1", fields: "author_key" });
      const res = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const doc = data.docs && data.docs[0];
        if (doc && doc.author_key && doc.author_key.length) authorKey = doc.author_key[0];
      }
    }
    if (!authorKey) {
      const params = new URLSearchParams({ q: name, limit: "1" });
      const res = await fetch(`https://openlibrary.org/search/authors.json?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const doc = data.docs && data.docs[0];
        if (doc && doc.key) authorKey = doc.key;
      }
    }
    if (!authorKey) return null;
    const photoUrl = `https://covers.openlibrary.org/a/olid/${authorKey}-L.jpg`;
    let bio = null;
    try {
      const bioRes = await fetch(`https://openlibrary.org/authors/${authorKey}.json`);
      if (bioRes.ok) {
        const bioData = await bioRes.json();
        if (bioData.bio) bio = typeof bioData.bio === "string" ? bioData.bio : bioData.bio.value || null;
      }
    } catch (e) {
      console.error(e);
    }
    return { photoUrl, bio };
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ---------- data layer (localStorage) ----------
const BOOKS_KEY = "mesLectures.books";
const AUTHORS_KEY = "mesLectures.authors";

function loadBooks() {
  try { return JSON.parse(localStorage.getItem(BOOKS_KEY)) || []; }
  catch { return []; }
}
function persistBooks(books) { localStorage.setItem(BOOKS_KEY, JSON.stringify(books)); }

function loadAuthors() {
  try { return JSON.parse(localStorage.getItem(AUTHORS_KEY)) || {}; }
  catch { return {}; }
}
function persistAuthors(authors) { localStorage.setItem(AUTHORS_KEY, JSON.stringify(authors)); }

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fetchBooks(status) {
  let books = loadBooks();
  if (status) books = books.filter((b) => b.status === status);
  return books.slice().sort((a, b) => new Date(b.date_added) - new Date(a.date_added));
}

function fetchBook(id) {
  return loadBooks().find((b) => b.id === id) || null;
}

function fetchBooksByAuthor(author) {
  return loadBooks()
    .filter((b) => b.author === author && b.status === "read")
    .sort((a, b) => new Date(b.date_added) - new Date(a.date_added));
}

function fetchAuthors() {
  return Object.values(loadAuthors()).sort((a, b) => a.name.localeCompare(b.name));
}

function fetchAuthor(name) {
  return loadAuthors()[name] || null;
}

function ensureAuthor(name) {
  if (!name) return;
  const authors = loadAuthors();
  if (!authors[name]) {
    authors[name] = { name, photo_url: null, bio: null };
    persistAuthors(authors);
  }
}

function saveAuthorInfo(name, photo_url, bio) {
  const authors = loadAuthors();
  authors[name] = { name, photo_url, bio };
  persistAuthors(authors);
}

function saveBook(book) {
  ensureAuthor(book.author);
  const books = loadBooks();
  if (book.id) {
    const idx = books.findIndex((b) => b.id === book.id);
    if (idx !== -1) books[idx] = { ...books[idx], ...book };
  } else {
    books.push({ ...book, id: uid(), date_added: new Date().toISOString() });
  }
  persistBooks(books);
}

function deleteBook(id) {
  persistBooks(loadBooks().filter((b) => b.id !== id));
}

function markAsRead(id) {
  const books = loadBooks();
  const b = books.find((x) => x.id === id);
  if (b) b.status = "read";
  persistBooks(books);
}

// ---------- rendering: book cards ----------
function bookCardHtml(book) {
  const coverHtml = book.cover_url
    ? `<img class="cover" src="${esc(book.cover_url)}" alt="" loading="lazy" data-title="${esc(book.title)}" />`
    : `<div class="cover-placeholder">${esc(book.title)}</div>`;
  const summaryHtml = book.summary ? `<p class="cov-summary">${esc(truncate(book.summary, 160))}</p>` : "";
  const dateReadHtml = book.date_read ? `<div class="cov-date">Lu le ${formatDate(book.date_read)}</div>` : "";
  return `
    <div class="card" data-id="${book.id}">
      <div class="cover-wrap">
        ${coverHtml}
        <div class="cover-overlay">
          ${summaryHtml}
          <div class="cov-meta">
            <span class="stars${book.rating ? "" : " empty"}">${starString(book.rating)}</span>
            ${book.year ? `<span class="cov-year">${book.year}</span>` : ""}
          </div>
          ${dateReadHtml}
        </div>
      </div>
      <div class="card-body">
        <p class="card-title">${esc(book.title)}</p>
        <p class="card-author" data-author="${esc(book.author)}">${esc(book.author)}</p>
      </div>
    </div>`;
}

function bindCoverFallback(container) {
  container.querySelectorAll("img.cover").forEach((img) => {
    img.addEventListener("error", () => {
      const div = document.createElement("div");
      div.className = "cover-placeholder";
      div.textContent = img.dataset.title || "";
      img.replaceWith(div);
    }, { once: true });
  });
}

function bindCardClicks(container) {
  container.querySelectorAll(".card[data-id]").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-author]")) return;
      openBookLightbox(card.dataset.id);
    });
  });
  container.querySelectorAll("[data-author]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      location.hash = `#author/${encodeURIComponent(el.dataset.author)}`;
    });
  });
}

// ---------- book detail lightbox (read-only, visual) ----------
function openBookLightbox(id) {
  const book = fetchBook(id);
  if (!book) return;

  const coverWrap = document.getElementById("blCoverWrap");
  coverWrap.innerHTML = book.cover_url
    ? `<img src="${esc(book.cover_url)}" alt="" data-title="${esc(book.title)}">`
    : `<div class="cover-placeholder">${esc(book.title)}</div>`;
  const img = coverWrap.querySelector("img");
  if (img) {
    img.addEventListener(
      "error",
      () => {
        const div = document.createElement("div");
        div.className = "cover-placeholder";
        div.textContent = book.title;
        img.replaceWith(div);
      },
      { once: true }
    );
  }

  document.getElementById("blTitle").textContent = book.title;
  document.getElementById("blAuthor").textContent = book.author;

  const starsEl = document.getElementById("blStars");
  starsEl.textContent = starString(book.rating);
  starsEl.className = "bl-stars" + (book.rating ? "" : " empty");

  document.getElementById("blYear").textContent = book.year || "";

  const dateEl = document.getElementById("blDateRead");
  dateEl.textContent = book.date_read ? `Lu le ${formatDate(book.date_read)}` : "";
  dateEl.style.display = book.date_read ? "" : "none";

  const summarySection = document.getElementById("blSummarySection");
  summarySection.style.display = book.summary ? "" : "none";
  document.getElementById("blSummary").textContent = book.summary || "";

  const notesSection = document.getElementById("blNotesSection");
  notesSection.style.display = book.notes ? "" : "none";
  document.getElementById("blNotes").textContent = book.notes || "";

  document.getElementById("blEditBtn").dataset.id = id;

  document.getElementById("bookLightbox").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeBookLightbox() {
  document.getElementById("bookLightbox").classList.remove("open");
  document.body.style.overflow = "";
}

// ---------- views ----------
async function renderShelf() {
  app.innerHTML = `
    <h1 class="section-title">Bibliothèque</h1>
    <p class="section-sub" id="shelfCount"></p>
    <div class="shelf-view" id="shelfWrap"><p class="empty-state">Chargement...</p></div>`;
  const books = await fetchBooks("read");
  const wrap = document.getElementById("shelfWrap");

  if (!books.length) {
    wrap.innerHTML = `<p class="empty-state">Aucun livre lu pour l'instant.<br/>Clique sur "+ Ajouter un livre" pour commencer.</p>`;
    document.getElementById("shelfCount").remove();
    return;
  }

  document.getElementById("shelfCount").textContent = `${books.length} livre${books.length > 1 ? "s" : ""} lu${books.length > 1 ? "s" : ""}`;

  function build() {
    if (!document.body.contains(wrap)) {
      window.removeEventListener("resize", debouncedBuild);
      return;
    }
    const rows = chunkIntoRows(books, wrap.clientWidth);
    wrap.innerHTML = rows
      .map(
        (row) => `
      <div class="shelf-row">
        <div class="shelf-books">${row.map(spineHtml).join("")}</div>
        <div class="shelf-ledge"></div>
      </div>`
      )
      .join("");
    wrap.querySelectorAll(".spine").forEach((el) => {
      el.addEventListener("click", () => openBookLightbox(el.dataset.id));
    });
  }

  let resizeTimer;
  function debouncedBuild() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 150);
  }

  build();
  window.addEventListener("resize", debouncedBuild);
}

async function renderHome() {
  app.innerHTML = `
    <h1 class="section-title">Bibliothèque</h1>
    <div class="toolbar">
      <input type="text" id="librarySearch" class="search-input" placeholder="Rechercher un titre ou un auteur..." />
      <select id="librarySort" class="sort-select">
        <option value="read_desc">Date de lecture (récent d'abord)</option>
        <option value="date_desc">Date d'ajout (récent d'abord)</option>
        <option value="rating_desc">Note (meilleure d'abord)</option>
        <option value="rating_asc">Note (moins bonne d'abord)</option>
      </select>
    </div>
    <div id="content"><p class="empty-state">Chargement...</p></div>`;
  const books = await fetchBooks("read");
  const content = document.getElementById("content");
  const searchInput = document.getElementById("librarySearch");
  const sortSelect = document.getElementById("librarySort");

  if (!books.length) {
    content.innerHTML = `<p class="empty-state">Aucun livre lu pour l'instant.<br/>Clique sur "+ Ajouter un livre" pour commencer.</p>`;
    searchInput.disabled = true;
    sortSelect.disabled = true;
    return;
  }
  document.querySelector(".section-title").insertAdjacentHTML(
    "afterend",
    `<p class="section-sub">${books.length} livre${books.length > 1 ? "s" : ""} lu${books.length > 1 ? "s" : ""}</p>`
  );

  function renderList() {
    const query = searchInput.value.trim().toLowerCase();
    const sort = sortSelect.value;
    let list = books.filter(
      (b) => !query || b.title.toLowerCase().includes(query) || b.author.toLowerCase().includes(query)
    );
    list = list.slice().sort((a, b) => {
      if (sort === "rating_desc") return (b.rating || 0) - (a.rating || 0) || new Date(b.date_added) - new Date(a.date_added);
      if (sort === "rating_asc") return (a.rating || 0) - (b.rating || 0) || new Date(b.date_added) - new Date(a.date_added);
      if (sort === "read_desc") return new Date(b.date_read || 0) - new Date(a.date_read || 0) || new Date(b.date_added) - new Date(a.date_added);
      return new Date(b.date_added) - new Date(a.date_added);
    });
    if (!list.length) {
      content.innerHTML = `<p class="empty-state">Aucun résultat.</p>`;
      return;
    }
    content.innerHTML = `<div class="grid">${list.map(bookCardHtml).join("")}</div>`;
    bindCoverFallback(content);
    bindCardClicks(content);
  }

  searchInput.addEventListener("input", renderList);
  sortSelect.addEventListener("change", renderList);
  renderList();
}

async function renderAuthors() {
  app.innerHTML = `<h1 class="section-title">Auteurs</h1><div id="content"><p class="empty-state">Chargement...</p></div>`;
  const books = await fetchBooks("read");
  const content = document.getElementById("content");
  if (!books.length) {
    content.innerHTML = `<p class="empty-state">Pas encore d'auteur. Ajoute un livre lu pour en voir apparaître ici.</p>`;
    return;
  }
  const byAuthor = {};
  books.forEach((b) => {
    (byAuthor[b.author] = byAuthor[b.author] || []).push(b);
  });
  const authorNames = Object.keys(byAuthor).sort((a, b) => a.localeCompare(b));
  const authorsMeta = await fetchAuthors();
  const metaByName = Object.fromEntries(authorsMeta.map((a) => [a.name, a]));

  content.innerHTML = `<div class="author-list">${authorNames
    .map((name) => {
      const meta = metaByName[name] || {};
      const count = byAuthor[name].length;
      const photoHtml = meta.photo_url
        ? `<img class="author-photo" src="${esc(meta.photo_url)}" data-initials="${esc(authorInitials(name))}" alt="" loading="lazy"/>`
        : `<div class="author-photo-placeholder">${esc(authorInitials(name))}</div>`;
      return `
        <div class="author-row" data-author="${esc(name)}">
          ${photoHtml}
          <div class="author-info">
            <p class="author-name">${esc(name)}</p>
            <p class="author-count">${count} livre${count > 1 ? "s" : ""}</p>
          </div>
        </div>`;
    })
    .join("")}</div>`;

  content.querySelectorAll("img.author-photo").forEach((img) => {
    img.addEventListener("error", () => {
      const div = document.createElement("div");
      div.className = "author-photo-placeholder";
      div.textContent = img.dataset.initials || "";
      img.replaceWith(div);
    }, { once: true });
  });

  content.querySelectorAll(".author-row").forEach((card) => {
    card.addEventListener("click", () => {
      location.hash = `#author/${encodeURIComponent(card.dataset.author)}`;
    });
  });
}

async function renderAuthorDetail(name) {
  app.innerHTML = `<a href="#authors" class="back-link">&larr; Tous les auteurs</a><p class="empty-state">Chargement...</p>`;
  const [meta, books] = await Promise.all([fetchAuthor(name), fetchBooksByAuthor(name)]);
  const bio = meta && meta.bio;
  const photo = meta && meta.photo_url;
  const photoHtml = photo
    ? `<img class="author-photo" src="${esc(photo)}" data-initials="${esc(authorInitials(name))}" alt=""/>`
    : `<div class="author-photo-placeholder">${esc(authorInitials(name))}</div>`;

  app.innerHTML = `
    <a href="#authors" class="back-link">&larr; Tous les auteurs</a>
    <div class="author-header">
      ${photoHtml}
      <div class="author-header-info">
        <h1>${esc(name)}</h1>
        <p class="author-bio${bio ? "" : " empty"}">${bio ? esc(bio) : "Pas encore de présentation."}</p>
        <button class="btn" id="editAuthorBtn" style="margin-top:12px;">Éditer l'auteur</button>
      </div>
    </div>
    <h2 class="section-title">Livres lus (${books.length})</h2>
    <div id="booksContent">${
      books.length
        ? `<div class="grid">${books.map(bookCardHtml).join("")}</div>`
        : `<p class="empty-state">Aucun livre de cet auteur pour l'instant.</p>`
    }</div>
  `;

  const photoImg = app.querySelector("img.author-photo");
  if (photoImg) {
    photoImg.addEventListener("error", () => {
      const div = document.createElement("div");
      div.className = "author-photo-placeholder";
      div.textContent = photoImg.dataset.initials || "";
      photoImg.replaceWith(div);
    }, { once: true });
  }

  bindCoverFallback(app);
  bindCardClicks(app);

  document.getElementById("editAuthorBtn").addEventListener("click", () => openAuthorModal(name, meta));
}

async function renderALire() {
  app.innerHTML = `<h1 class="section-title">À lire</h1><div id="content"><p class="empty-state">Chargement...</p></div>`;
  const books = await fetchBooks("wishlist");
  const content = document.getElementById("content");
  if (!books.length) {
    content.innerHTML = `<p class="empty-state">Ta liste "à lire" est vide. Ajoute un livre en mode "À lire".</p>`;
    return;
  }
  content.innerHTML = `<div class="wish-list">${books
    .map(
      (b) => `
    <div class="wish-item">
      ${
        b.cover_url
          ? `<img class="wish-cover" src="${esc(b.cover_url)}" data-title="${esc(b.title)}" alt=""/>`
          : `<div class="wish-cover-placeholder"></div>`
      }
      <div class="wish-info" data-open="${b.id}">
        <div class="wish-title">${esc(b.title)}</div>
        <div class="wish-author">${esc(b.author)}</div>
      </div>
      <div class="wish-actions">
        <button class="btn btn-primary" data-mark-read="${b.id}">Marquer comme lu</button>
      </div>
    </div>`
    )
    .join("")}</div>`;

  content.querySelectorAll("img.wish-cover").forEach((img) => {
    img.addEventListener("error", () => {
      const div = document.createElement("div");
      div.className = "wish-cover-placeholder";
      img.replaceWith(div);
    }, { once: true });
  });

  content.querySelectorAll("[data-open]").forEach((el) => {
    el.addEventListener("click", () => openBookModal(el.dataset.open));
  });

  content.querySelectorAll("[data-mark-read]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.markRead;
      await markAsRead(id);
      openBookModal(id);
    });
  });
}

// ---------- router ----------
async function router() {
  const hash = location.hash || "#shelf";
  updateActiveNav(hash);
  const [path, param] = hash.slice(1).split("/");
  if (path === "authors") return renderAuthors();
  if (path === "alire") return renderALire();
  if (path === "author") return renderAuthorDetail(decodeURIComponent(param || ""));
  if (path === "home") return renderHome();
  return renderShelf();
}

function updateActiveNav(hash) {
  const top = hash.replace("#", "").split("/")[0] || "home";
  document.querySelectorAll(".nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === top || (top === "author" && a.dataset.nav === "authors"));
  });
}

// ---------- book modal ----------
function buildStarsInput() {
  const container = document.getElementById("fRatingStars");
  container.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const span = document.createElement("span");
    span.textContent = "★";
    span.dataset.val = i;
    container.appendChild(span);
  }
  container.addEventListener("click", (e) => {
    const val = e.target.dataset.val;
    if (!val) return;
    setRatingValue(Number(val));
  });
}

function setRatingValue(val) {
  document.getElementById("fRating").value = val;
  document.querySelectorAll("#fRatingStars span").forEach((s) => {
    s.classList.toggle("on", Number(s.dataset.val) <= val);
  });
}

function setStatus(status) {
  document.getElementById("fStatus").value = status;
  document.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.status === status));
  document.getElementById("readFields").style.display = status === "read" ? "" : "none";
}

let coverManuallyEdited = false;

async function openBookModal(id) {
  const form = document.getElementById("bookForm");
  form.reset();
  document.getElementById("bookId").value = "";
  setRatingValue(0);
  setStatus("read");
  coverManuallyEdited = false;
  setCoverPreview("fCoverPreview", "");
  document.getElementById("fYear").value = "";
  document.getElementById("deleteBookBtn").style.display = "none";
  document.getElementById("modalTitle").textContent = "Ajouter un livre";

  if (id) {
    const book = await fetchBook(id);
    if (!book) return;
    document.getElementById("bookId").value = book.id;
    document.getElementById("fTitle").value = book.title || "";
    document.getElementById("fAuthor").value = book.author || "";
    document.getElementById("fCover").value = book.cover_url || "";
    document.getElementById("fYear").value = book.year || "";
    setCoverPreview("fCoverPreview", book.cover_url || "");
    setStatus(book.status || "read");
    setRatingValue(book.rating || 0);
    document.getElementById("fDateRead").value = book.date_read || "";
    document.getElementById("fSummary").value = book.summary || "";
    document.getElementById("fNotes").value = book.notes || "";
    document.getElementById("modalTitle").textContent = "Éditer le livre";
    document.getElementById("deleteBookBtn").style.display = "";
  }
  showModal("modalBackdrop");
}

async function autoFillBookMeta() {
  const title = document.getElementById("fTitle").value.trim();
  const author = document.getElementById("fAuthor").value.trim();
  if (!title) return;
  const coverEmpty = !coverManuallyEdited && !document.getElementById("fCover").value.trim();
  const yearEmpty = !document.getElementById("fYear").value.trim();
  if (!coverEmpty && !yearEmpty) return;
  const result = await searchOpenLibraryBook(title, author);
  if (!result) return;
  if (coverEmpty && result.coverUrl && !coverManuallyEdited && !document.getElementById("fCover").value.trim()) {
    document.getElementById("fCover").value = result.coverUrl;
    setCoverPreview("fCoverPreview", result.coverUrl);
  }
  if (yearEmpty && result.year && !document.getElementById("fYear").value.trim()) {
    document.getElementById("fYear").value = result.year;
  }
}

async function openAuthorModal(name, meta) {
  document.getElementById("aName").value = name;
  const existingPhoto = (meta && meta.photo_url) || "";
  const existingBio = (meta && meta.bio) || "";
  document.getElementById("aPhoto").value = existingPhoto;
  document.getElementById("aBio").value = existingBio;
  setCoverPreview("aPhotoPreview", existingPhoto);
  showModal("authorModalBackdrop");

  if (!existingPhoto || !existingBio) {
    const sampleBook = fetchBooksByAuthor(name)[0];
    const result = await searchOpenLibraryAuthor(name, sampleBook && sampleBook.title);
    if (result) {
      if (result.photoUrl && !document.getElementById("aPhoto").value.trim()) {
        document.getElementById("aPhoto").value = result.photoUrl;
        setCoverPreview("aPhotoPreview", result.photoUrl);
      }
      if (result.bio && !document.getElementById("aBio").value.trim()) {
        document.getElementById("aBio").value = result.bio;
      }
    }
  }
}

// ---------- static event bindings ----------
function bindStaticEvents() {
  document.querySelector(".brand").addEventListener("click", () => (location.hash = "#shelf"));
  document.getElementById("addBookBtn").addEventListener("click", () => openBookModal(null));

  document.getElementById("bookLightboxClose").addEventListener("click", closeBookLightbox);
  document.getElementById("bookLightbox").addEventListener("click", (e) => {
    if (e.target.id === "bookLightbox") closeBookLightbox();
  });
  document.getElementById("blEditBtn").addEventListener("click", () => {
    const id = document.getElementById("blEditBtn").dataset.id;
    closeBookLightbox();
    openBookModal(id);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("bookLightbox").classList.contains("open")) {
      closeBookLightbox();
    }
  });

  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => setStatus(btn.dataset.status));
  });

  document.getElementById("fTitle").addEventListener("blur", autoFillBookMeta);
  document.getElementById("fAuthor").addEventListener("blur", autoFillBookMeta);
  document.getElementById("fCover").addEventListener("input", (e) => {
    coverManuallyEdited = true;
    setCoverPreview("fCoverPreview", e.target.value.trim());
  });
  document.getElementById("fCoverSearchBtn").addEventListener("click", async () => {
    const title = document.getElementById("fTitle").value.trim();
    const author = document.getElementById("fAuthor").value.trim();
    if (!title) { alert("Renseigne au moins le titre."); return; }
    const btn = document.getElementById("fCoverSearchBtn");
    btn.disabled = true;
    const result = await searchOpenLibraryBook(title, author);
    btn.disabled = false;
    if (result && (result.coverUrl || result.year)) {
      if (result.coverUrl) {
        coverManuallyEdited = false;
        document.getElementById("fCover").value = result.coverUrl;
        setCoverPreview("fCoverPreview", result.coverUrl);
      }
      if (result.year) document.getElementById("fYear").value = result.year;
    } else {
      alert("Aucune couverture trouvée sur Open Library. Tu peux coller une URL manuellement.");
    }
  });

  document.getElementById("aPhoto").addEventListener("input", (e) => {
    setCoverPreview("aPhotoPreview", e.target.value.trim());
  });
  document.getElementById("aPhotoSearchBtn").addEventListener("click", async () => {
    const name = document.getElementById("aName").value.trim();
    if (!name) return;
    const btn = document.getElementById("aPhotoSearchBtn");
    btn.disabled = true;
    const sampleBook = fetchBooksByAuthor(name)[0];
    const result = await searchOpenLibraryAuthor(name, sampleBook && sampleBook.title);
    btn.disabled = false;
    if (result && (result.photoUrl || result.bio)) {
      if (result.photoUrl) {
        document.getElementById("aPhoto").value = result.photoUrl;
        setCoverPreview("aPhotoPreview", result.photoUrl);
      }
      if (result.bio) document.getElementById("aBio").value = result.bio;
    } else {
      alert("Aucune information trouvée sur Open Library. Tu peux compléter manuellement.");
    }
  });

  document.getElementById("bookForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = document.getElementById("fStatus").value;
    const book = {
      id: document.getElementById("bookId").value || null,
      title: document.getElementById("fTitle").value.trim(),
      author: document.getElementById("fAuthor").value.trim(),
      cover_url: document.getElementById("fCover").value.trim() || null,
      year: document.getElementById("fYear").value.trim() ? Number(document.getElementById("fYear").value) : null,
      status,
      rating: status === "read" ? Number(document.getElementById("fRating").value) : 0,
      date_read: status === "read" ? document.getElementById("fDateRead").value || null : null,
      summary: status === "read" ? document.getElementById("fSummary").value.trim() : "",
      notes: status === "read" ? document.getElementById("fNotes").value.trim() : "",
    };
    await saveBook(book);
    hideModal("modalBackdrop");
    router();
  });

  document.getElementById("deleteBookBtn").addEventListener("click", async () => {
    const id = document.getElementById("bookId").value;
    if (!id) return;
    if (!confirm("Supprimer ce livre définitivement ?")) return;
    await deleteBook(id);
    hideModal("modalBackdrop");
    router();
  });

  document.getElementById("cancelBtn").addEventListener("click", () => hideModal("modalBackdrop"));
  document.getElementById("modalClose").addEventListener("click", () => hideModal("modalBackdrop"));
  document.getElementById("modalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "modalBackdrop") hideModal("modalBackdrop");
  });

  document.getElementById("authorForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("aName").value;
    const photo_url = document.getElementById("aPhoto").value.trim() || null;
    const bio = document.getElementById("aBio").value.trim() || null;
    await saveAuthorInfo(name, photo_url, bio);
    hideModal("authorModalBackdrop");
    router();
  });

  document.getElementById("authorCancelBtn").addEventListener("click", () => hideModal("authorModalBackdrop"));
  document.getElementById("authorModalClose").addEventListener("click", () => hideModal("authorModalBackdrop"));
  document.getElementById("authorModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "authorModalBackdrop") hideModal("authorModalBackdrop");
  });
}

// ---------- init ----------
buildStarsInput();
bindStaticEvents();
window.addEventListener("hashchange", router);
router();
