const editions = {
  en: "/data/editions/tanya-kehot-english.json",
  he: "/data/editions/tanya-kehot-hebrew.json"
};

const select = document.querySelector("#section-select");
const search = document.querySelector("#text-search");
const status = document.querySelector("#reader-status");
const content = document.querySelector("#reader-content");
const previousButton = document.querySelector("#previous-section");
const nextButton = document.querySelector("#next-section");
const downloadLink = document.querySelector("#download-edition");
const editionTitle = document.querySelector("#edition-title");
const editionLicense = document.querySelector("#edition-license");
const editionCredit = document.querySelector("#edition-credit");
const sourceLink = document.querySelector("#edition-source");
const compareToggle = document.querySelector("#compare-toggle");
const printButton = document.querySelector("#print-text");

let activeEdition = null;
let activeLanguage = "en";
let activeSection = "";
let compareEdition = null;
let compareMode = false;
const editionCache = {};
const requestedRef = new URLSearchParams(window.location.search).get("ref");

function cleanFragment(markup) {
  const parsed = new DOMParser().parseFromString(`<body>${markup}</body>`, "text/html");
  const allowedTags = new Set(["A", "B", "BR", "EM", "I", "SMALL", "SPAN", "STRONG", "SUB", "SUP"]);

  function copyNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();

    const tag = node.tagName.toUpperCase();
    const children = document.createDocumentFragment();
    for (const child of node.childNodes) children.append(copyNode(child));
    if (!allowedTags.has(tag)) return children;

    const element = document.createElement(tag.toLowerCase());
    if (tag === "A") {
      try {
        const url = new URL(node.getAttribute("href") || "", "https://www.sefaria.org");
        if (url.protocol === "https:" && ["www.sefaria.org", "sefaria.org"].includes(url.hostname)) {
          element.href = url.href;
          element.target = "_blank";
          element.rel = "noopener noreferrer";
        }
      } catch {}
    }
    element.append(children);
    return element;
  }

  const fragment = document.createDocumentFragment();
  for (const child of parsed.body.childNodes) fragment.append(copyNode(child));
  return fragment;
}

function plainText(markup) {
  const parsed = new DOMParser().parseFromString(`<body>${markup}</body>`, "text/html");
  return parsed.body.textContent || "";
}

function sourceHref(reference, language = activeLanguage) {
  return `https://www.sefaria.org/${encodeURIComponent(reference)}?lang=${language}`;
}

function createPassage(segment, language) {
  const article = document.createElement("article");
  article.className = "reader-segment";
  article.dataset.language = language;

  const paragraph = document.createElement("p");
  paragraph.lang = language;
  paragraph.dir = language === "he" ? "rtl" : "ltr";
  paragraph.className = "passage-text";
  paragraph.append(cleanFragment(segment.text));

  const languageLabel = document.createElement("span");
  languageLabel.className = "passage-language-label";
  languageLabel.textContent = language === "he" ? "Hebrew" : "English";

  const citation = document.createElement("a");
  citation.className = "passage-citation";
  citation.href = sourceHref(segment.reference, language);
  citation.target = "_blank";
  citation.rel = "noopener noreferrer";
  citation.dir = "ltr";
  citation.textContent = `Sefaria · ${segment.reference}`;
  citation.setAttribute("aria-label", `Open ${segment.reference} in Sefaria`);

  article.id = segment.id;
  article.dataset.reference = segment.reference;
  const permalink = new URL(window.location.href);
  permalink.search = "";
  permalink.hash = "";
  permalink.searchParams.set("work", "tanya");
  permalink.searchParams.set("lang", language);
  permalink.searchParams.set("ref", segment.reference);
  const links = document.createElement("div");
  links.className = "passage-links";
  const localLink = document.createElement("a");
  localLink.className = "passage-permalink";
  localLink.href = permalink.href;
  localLink.textContent = "Permalink";
  localLink.setAttribute("aria-label", `Permalink to ${segment.reference} in this library`);
  links.append(citation, localLink);

  article.append(languageLabel, paragraph, links);
  return article;
}

function createSection(section, segments, language, paired = false) {
  const wrapper = document.createElement("section");
  wrapper.className = "reader-text-section";
  wrapper.dataset.section = section.id;

  const heading = document.createElement("div");
  heading.className = "reader-section-heading";
  const title = document.createElement("h2");
  title.dir = "auto";
  title.textContent = section.reference;
  const sectionSource = document.createElement("a");
  sectionSource.href = sourceHref(section.reference, language);
  sectionSource.target = "_blank";
  sectionSource.rel = "noopener noreferrer";
  sectionSource.textContent = "Open section ↗";
  heading.append(title, sectionSource);
  wrapper.append(heading);

  if (paired && compareEdition) {
    const counterpartById = new Map(compareEdition.segments.map((segment) => [segment.id, segment]));
    for (const segment of segments) {
      const counterpart = counterpartById.get(segment.id);
      const englishSegment = language === "en" ? segment : counterpart;
      const hebrewSegment = language === "he" ? segment : counterpart;
      const row = document.createElement("div");
      row.className = "reader-pair-row";
      if (englishSegment) row.append(createPassage(englishSegment, "en"));
      if (hebrewSegment) row.append(createPassage(hebrewSegment, "he"));
      wrapper.append(row);
    }
  } else {
    for (const segment of segments) wrapper.append(createPassage(segment, language));
  }
  return wrapper;
}

function updateControls() {
  const index = activeEdition.sections.findIndex((section) => section.id === activeSection);
  select.value = activeSection;
  previousButton.disabled = index <= 0;
  nextButton.disabled = index < 0 || index >= activeEdition.sections.length - 1;
}

function renderSection() {
  const section = activeEdition.sections.find((item) => item.id === activeSection);
  if (!section) return;
  const segments = activeEdition.segments.filter((segment) => segment.section_id === section.id);
  content.replaceChildren(createSection(section, segments, activeLanguage, compareMode));
  status.textContent = `${section.reference} · ${segments.length} cited passages · ${activeEdition.edition_details.section_count} sections${compareMode ? " · Hebrew and English side by side" : ""}`;
  updateControls();
  if (requestedRef) {
    const passage = [...content.querySelectorAll(".reader-segment")].find((item) => item.dataset.reference === requestedRef);
    passage?.scrollIntoView({ block: "center" });
  }
}

function renderSearchResults(query) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) {
    renderSection();
    return;
  }

  const matches = activeEdition.segments.filter((segment) => plainText(segment.text).toLocaleLowerCase().includes(term));
  const visible = matches.slice(0, 100);
  const sectionMap = new Map(activeEdition.sections.map((section) => [section.id, section]));
  const bySection = new Map();
  for (const segment of visible) {
    if (!bySection.has(segment.section_id)) bySection.set(segment.section_id, []);
    bySection.get(segment.section_id).push(segment);
  }

  const fragment = document.createDocumentFragment();
  for (const [sectionId, segments] of bySection) {
    const section = sectionMap.get(sectionId);
    if (section) fragment.append(createSection(section, segments, activeLanguage, compareMode));
  }
  content.replaceChildren(fragment);
  status.textContent = matches.length
    ? `${matches.length} matching passages${matches.length > visible.length ? ` · showing the first ${visible.length}` : ""}${compareMode ? " · Hebrew and English side by side" : ""}`
    : "No passages match this search.";
}

function fillSectionSelect() {
  select.replaceChildren(...activeEdition.sections.map((section) => {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = section.reference;
    return option;
  }));
  select.disabled = false;
  compareToggle.disabled = false;
  printButton.disabled = false;
  const requestedSegment = requestedRef && activeEdition.segments.find((segment) => segment.reference === requestedRef);
  const requestedSection = requestedSegment && activeEdition.sections.find((section) => section.id === requestedSegment.section_id);
  const firstMainChapter = activeEdition.sections.find((section) => section.reference.endsWith("Likkutei Amarim 1"));
  activeSection = requestedSection?.id || firstMainChapter?.id || activeEdition.sections[0]?.id || "";
  updateControls();
}

async function loadEdition(language) {
  status.textContent = "Loading edition…";
  content.replaceChildren();
  select.disabled = true;
  for (const button of document.querySelectorAll(".edition-button")) {
    button.setAttribute("aria-pressed", String(button.dataset.language === language));
  }

  try {
    let record = editionCache[language];
    if (!record) {
      const response = await fetch(editions[language]);
      if (!response.ok) throw new Error(`Edition file returned ${response.status}`);
      record = await response.json();
    }
    if (record.work_id !== "tanya" || !Array.isArray(record.sections) || !Array.isArray(record.segments)) {
      throw new Error("Edition record is incomplete");
    }

    editionCache[language] = record;
    activeLanguage = language;
    activeEdition = record;
    compareEdition = editionCache[language === "en" ? "he" : "en"] || null;
    fillSectionSelect();
    downloadLink.href = editions[language];
    downloadLink.download = editions[language].split("/").at(-1);
    editionTitle.textContent = `${record.edition_details.version_title} · ${language === "he" ? "Hebrew" : "English"}`;
    editionLicense.textContent = `Sefaria source metadata: ${record.edition_details.source_license} · rights reviewed ${record.rights.reviewed_on}`;
    editionCredit.textContent = record.attribution.credit;
    sourceLink.href = record.attribution.source_page;
    document.documentElement.lang = language;
    renderSearchResults(search.value);
  } catch (error) {
    status.textContent = "This edition could not be loaded.";
    content.textContent = "Please return to the catalog or try again in a moment.";
    console.error(error);
  }
}

async function loadComparisonEdition() {
  const language = activeLanguage === "en" ? "he" : "en";
  if (editionCache[language]) return editionCache[language];
  const response = await fetch(editions[language]);
  if (!response.ok) throw new Error(`Edition file returned ${response.status}`);
  const record = await response.json();
  if (record.work_id !== "tanya" || !Array.isArray(record.segments)) throw new Error("Comparison edition is incomplete");
  editionCache[language] = record;
  return record;
}

select.addEventListener("change", () => {
  activeSection = select.value;
  search.value = "";
  renderSection();
});

search.addEventListener("input", () => renderSearchResults(search.value));

previousButton.addEventListener("click", () => {
  const index = activeEdition.sections.findIndex((section) => section.id === activeSection);
  if (index > 0) {
    activeSection = activeEdition.sections[index - 1].id;
    search.value = "";
    renderSection();
  }
});

nextButton.addEventListener("click", () => {
  const index = activeEdition.sections.findIndex((section) => section.id === activeSection);
  if (index >= 0 && index < activeEdition.sections.length - 1) {
    activeSection = activeEdition.sections[index + 1].id;
    search.value = "";
    renderSection();
  }
});

for (const button of document.querySelectorAll(".edition-button")) {
  button.addEventListener("click", () => {
    if (button.dataset.language !== activeLanguage) loadEdition(button.dataset.language);
  });
}

compareToggle.addEventListener("click", async () => {
  compareMode = !compareMode;
  compareToggle.setAttribute("aria-pressed", String(compareMode));
  compareToggle.textContent = compareMode ? "Hide comparison" : "Compare Hebrew and English";
  if (compareMode) {
    status.textContent = "Loading the second edition…";
    try {
      compareEdition = await loadComparisonEdition();
      renderSearchResults(search.value);
    } catch (error) {
      compareMode = false;
      compareToggle.setAttribute("aria-pressed", "false");
      compareToggle.textContent = "Compare Hebrew and English";
      status.textContent = "The comparison edition could not be loaded.";
      console.error(error);
    }
  } else {
    renderSearchResults(search.value);
  }
});

printButton.addEventListener("click", () => window.print());

const initialLanguage = new URLSearchParams(window.location.search).get("lang") === "he" ? "he" : "en";
compareToggle.disabled = true;
printButton.disabled = true;
loadEdition(initialLanguage);
