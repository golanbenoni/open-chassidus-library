const grid = document.querySelector("#work-grid");
const search = document.querySelector("#catalog-search");
const count = document.querySelector("#catalog-count");
const empty = document.querySelector("#empty-state");
const clearButton = document.querySelector("#clear-search");
const candidateCount = document.querySelector("#candidate-count");
const editionCount = document.querySelector("#edition-count");
const releasedCount = document.querySelector("#released-count");

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);

function render(works, query = "") {
  const term = query.trim().toLocaleLowerCase();
  const matches = works.filter((work) => [work.title, work.title_he, work.author, ...work.alternate_titles]
    .join(" ").toLocaleLowerCase().includes(term));

  grid.innerHTML = matches.map((work) => {
    const isAvailable = ["beta", "released"].includes(work.status);
    const actions = isAvailable ? `
      <div class="work-actions">
        <a class="work-read-link" href="${escapeHtml(work.reader)}">Read ${escapeHtml(work.title)} <span aria-hidden="true">→</span></a>
        <div class="work-downloads">${work.editions.map((edition) => `
          <a href="${escapeHtml(edition.file)}" download>Download ${escapeHtml(edition.language)} JSON</a>`).join("")}
        </div>
      </div>` : "";

    return `
    <article class="work-card">
      <div class="work-meta">
        <span class="work-status ${isAvailable ? "is-available" : ""}">${isAvailable ? "Public beta" : "Source review"}</span>
        <span class="work-id">catalog/${escapeHtml(work.id)}</span>
      </div>
      <div class="work-title-row">
        <h3 class="work-title">${escapeHtml(work.title)}</h3>
        <span class="work-hebrew" lang="he" dir="rtl">${escapeHtml(work.title_he)}</span>
      </div>
      <p class="work-author">${escapeHtml(work.author)} · ${escapeHtml(work.composition_period)}</p>
      <p class="work-note">${escapeHtml(work.note)}</p>
      ${actions}
    </article>`;
  }).join("");

  count.textContent = `${matches.length} of ${works.length} pilot works`;
  empty.hidden = matches.length !== 0;
  grid.hidden = matches.length === 0;
}

async function start() {
  try {
    const response = await fetch("/data/catalog.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Catalog could not be loaded");
    const catalog = await response.json();
    candidateCount.textContent = catalog.works.length;
    editionCount.textContent = catalog.works.reduce((total, work) => total + (work.editions?.length || 0), 0);
    releasedCount.textContent = catalog.works.filter((work) => ["beta", "released"].includes(work.status)).length;
    render(catalog.works);
    search.addEventListener("input", () => render(catalog.works, search.value));
    clearButton.addEventListener("click", () => {
      search.value = "";
      render(catalog.works);
      search.focus();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
        event.preventDefault();
        search.focus();
      }
      if (event.key === "Escape" && document.activeElement === search) {
        search.value = "";
        render(catalog.works);
        search.blur();
      }
    });
  } catch (error) {
    count.textContent = "Catalog unavailable";
    grid.innerHTML = `<div class="catalog-notice"><span class="notice-icon" aria-hidden="true">!</span><p>The pilot catalog could not load. Please refresh this page.</p></div>`;
  }
}

start();
