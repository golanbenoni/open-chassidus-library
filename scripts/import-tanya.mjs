import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(root, "src/data/editions");
const accessedOn = new Date().toISOString().slice(0, 10);
const apiBase = "https://www.sefaria.org/api/v3/texts/";
const firstSection = "Tanya, Part I; Likkutei Amarim, Title Page";
const expectedSectionCount = 124;
const expectedSegmentCount = 1623;

const editions = [
  {
    id: "kehot-hebrew",
    language: "he",
    languageName: "Hebrew",
    versionTitle: "Kehot Publication Society",
    version: "hebrew|Kehot Publication Society",
    direction: "rtl"
  },
  {
    id: "kehot-english",
    language: "en",
    languageName: "English",
    versionTitle: "Kehot Publication Society (English Translation)",
    version: "english|Kehot Publication Society (English Translation)",
    direction: "ltr"
  }
];

const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const slug = (value) => value.toLocaleLowerCase("en")
  .normalize("NFKD")
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, ".")
  .replace(/^\.+|\.+$/g, "");

function flattenText(value, prefix = [], output = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenText(item, [...prefix, index + 1], output));
  } else if (typeof value === "string") {
    output.push({ position: prefix.join("."), text: value });
  } else {
    throw new Error(`Unexpected text value type: ${typeof value}`);
  }
  return output;
}

function sourceUrl(ref, version) {
  const encodedRef = encodeURIComponent(ref).replace(/%2C/gi, ",").replace(/%3B/gi, ";");
  return `${apiBase}${encodedRef}?version=${encodeURIComponent(version)}`;
}

async function fetchSection(ref) {
  const encodedRef = encodeURIComponent(ref).replace(/%2C/gi, ",").replace(/%3B/gi, ";");
  const url = new URL(`${apiBase}${encodedRef}`);
  editions.forEach(({ version }) => url.searchParams.append("version", version));
  const response = await fetch(url, {
    headers: { "User-Agent": "OpenChassidusLibrary/0.1 (+https://open-chassidus-library.pages.dev)" },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`Sefaria returned ${response.status} for ${ref}`);
  return response.json();
}

const visited = new Set();
const sectionRecords = [];
const textByEdition = new Map(editions.map(({ id }) => [id, []]));
const metadataByEdition = new Map();
const manifestEditions = [];
let ref = firstSection;

while (ref) {
  if (visited.has(ref)) throw new Error(`Sefaria section cycle detected at ${ref}`);
  visited.add(ref);

  const response = await fetchSection(ref);
  const sectionRef = response.sectionRef || response.ref;
  const versionsByIdentity = new Map(response.versions.map((version) => [
    `${version.language}|${version.versionTitle}`,
    version
  ]));
  const section = { id: slug(sectionRef), reference: sectionRef, order: sectionRecords.length + 1 };
  let segmentCount = 0;

  for (const edition of editions) {
    const identity = `${edition.language}|${edition.versionTitle}`;
    const sourceVersion = versionsByIdentity.get(identity);
    if (!sourceVersion || !Array.isArray(sourceVersion.text)) {
      throw new Error(`Missing exact ${edition.versionTitle} edition for ${sectionRef}`);
    }
    if (sourceVersion.license !== "CC-BY-NC") {
      throw new Error(`Unexpected license for ${edition.versionTitle} at ${sectionRef}: ${sourceVersion.license}`);
    }
    const sourceMetadata = {
      versionTitle: sourceVersion.versionTitle,
      versionSource: sourceVersion.versionSource,
      license: sourceVersion.license,
      status: sourceVersion.status || ""
    };
    const knownMetadata = metadataByEdition.get(edition.id);
    if (knownMetadata && JSON.stringify(knownMetadata) !== JSON.stringify(sourceMetadata)) {
      throw new Error(`Version metadata changed within ${edition.versionTitle}`);
    }
    metadataByEdition.set(edition.id, sourceMetadata);

    const flattened = flattenText(sourceVersion.text);
    if (edition.id === editions[0].id) segmentCount = flattened.length;
    else if (flattened.length !== segmentCount) {
      throw new Error(`Segment count differs between editions at ${sectionRef}`);
    }

    const sourceSegments = textByEdition.get(edition.id);
    for (const item of flattened) {
      const segmentRef = `${sectionRef}:${item.position.replaceAll(".", ":")}`;
      sourceSegments.push({
        id: `${section.id}.${item.position}`,
        section_id: section.id,
        section_reference: sectionRef,
        position: item.position,
        reference: segmentRef,
        text: item.text
      });
    }
  }

  section.segment_count = segmentCount;
  sectionRecords.push(section);
  ref = response.next || null;
}

await mkdir(outputDirectory, { recursive: true });

for (const edition of editions) {
  const segments = textByEdition.get(edition.id);
  if (sectionRecords.length !== expectedSectionCount || segments.length !== expectedSegmentCount) {
    throw new Error(`Coverage changed: ${sectionRecords.length} sections and ${segments.length} segments for ${edition.id}`);
  }

  const sourceMaterial = sectionRecords.map((section) => ({
    ref: section.reference,
    segments: segments.filter((segment) => segment.section_id === section.id).map(({ reference, text }) => ({ reference, text }))
  }));
  const sourceMetadata = metadataByEdition.get(edition.id);
  const editionRecord = {
    schema_version: "1.0",
    work_id: "tanya",
    edition_id: edition.id,
    title: `Tanya — Kehot Publication Society (${edition.languageName})`,
    publication_year: null,
    language: edition.language,
    direction: edition.direction,
    edition_details: {
      provider: "Sefaria",
      version_title: edition.versionTitle,
      version_source: sourceMetadata.versionSource,
      source_license: sourceMetadata.license,
      source_status: sourceMetadata.status,
      accessed_on: accessedOn,
      section_count: sectionRecords.length,
      segment_count: segments.length,
      completeness: "All 124 available bottom-level sections were retrieved with this exact edition; no fallback versions were requested."
    },
    attribution: {
      publisher: "Kehot Publication Society",
      digitization_platform: "Sefaria",
      credit: `Text from ${edition.versionTitle}, sourced through Sefaria. Sefaria records the edition license as CC-BY-NC.`,
      source_page: "https://www.sefaria.org/Tanya"
    },
    source: {
      kind: "licensed_digital_source",
      reference: sourceUrl(firstSection, edition.version),
      accessed_on: accessedOn,
      source_checksum: sha256(JSON.stringify(sourceMaterial)),
      transcription_method: "publisher_text",
      transcriber: "Sefaria API import via scripts/import-tanya.mjs"
    },
    rights: {
      basis: "open_license",
      evidence: "Sefaria's version metadata identifies this exact edition as CC-BY-NC. The project owner confirmed on 2026-11-11 that all source rights are approved for this release; the public reading room is free and attribution is retained.",
      license: sourceMetadata.license,
      reviewed_on: "2026-11-11",
      reviewer: "Project owner (confirmation recorded in this project)"
    },
    content_checksum: sha256(JSON.stringify(segments)),
    sections: sectionRecords,
    segments
  };

  const filename = `tanya-${edition.id}.json`;
  await writeFile(resolve(outputDirectory, filename), `${JSON.stringify(editionRecord)}\n`);
  manifestEditions.push({
    edition_id: edition.id,
    title: editionRecord.title,
    language: edition.language,
    file: `/data/editions/${filename}`,
    version_title: sourceMetadata.versionTitle,
    version_source: sourceMetadata.versionSource,
    source_reference: editionRecord.source.reference,
    publication_year: editionRecord.publication_year,
    accessed_on: editionRecord.source.accessed_on,
    source_license: sourceMetadata.license,
    rights_basis: editionRecord.rights.basis,
    rights_reviewed_on: editionRecord.rights.reviewed_on,
    transcriber: editionRecord.source.transcriber,
    source_checksum: editionRecord.source.source_checksum,
    content_checksum: editionRecord.content_checksum,
    section_count: sectionRecords.length,
    segment_count: segments.length,
    status: "beta"
  });
  console.log(`${filename}: ${sectionRecords.length} sections, ${segments.length} segments, ${editionRecord.content_checksum}`);
}

const manifest = {
  schema_version: "1.0",
  corpus_release: "0.1.0-beta",
  generated_on: accessedOn,
  status: "beta",
  quality_status: "Independent human text collation is in progress.",
  works: [{
    work_id: "tanya",
    title: "Tanya",
    title_he: "תניא",
    author: "Rabbi Shneur Zalman of Liadi",
    editions: manifestEditions
  }]
};
await writeFile(resolve(root, "src/data/manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
