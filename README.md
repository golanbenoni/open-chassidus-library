# Open Chassidus Library

This repository contains the public library site and its source-first corpus tools. A public beta reader is live for Tanya in Hebrew and English. Each edition has a standalone record with its exact version, source metadata, rights basis, coverage, checksums, stable segment IDs, and passage citations. The preview is hosted at `https://open-chassidus-library.pages.dev` while the custom domain is being connected.

## Product rules

- Public reading and downloads will not require an account or payment.
- Each edition identifies its work, source, rights basis, transcription history, coverage, and checksums.
- Text corrections are reviewed and versioned. The library does not publish AI-authored source text.
- Gated-service material is excluded. Source and edition records travel with every download.
- Tanya's source text is available as a beta while independent human collation remains in progress.

## Development

This is a dependency-free static site. Run `node scripts/build.mjs` to copy `src/` into `dist/` for Cloudflare Pages. Run `node scripts/import-tanya.mjs` to retrieve the two exact Tanya editions from Sefaria's Texts v3 API and regenerate their JSON edition records and the public manifest. The import fails closed if a section, edition, license, or expected coverage changes.

The current beta contains 124 sections and 1,623 cited text segments in each edition. The reader supports whole-edition search, Hebrew/English side-by-side reading, section printing, stable local permalinks, and links each paragraph citation back to Sefaria. The catalog, public manifest, and downloadable edition files identify each source separately.

## Current readiness

- The public beta is deployed at `https://open-chassidus-library.pages.dev`.
- Cloudflare has associated `chassid.ai` with the Pages project. The domain is pending because the apex CNAME record is not present; the current Wrangler authorization has Pages write and DNS read access, but not DNS write access.
- Tanya is available in two complete source editions. Independent human collation is still in progress, so the corpus remains labeled beta.
- Remaining for V1: add and collate more Tier A works; publish read-only REST and MCP access; prepare signed bulk releases and a mirror kit; and complete the public stewardship and citation documents.

## Cloudflare deployment

The initial public preview uses a Cloudflare Pages Direct Upload project. The manual `Deploy to Cloudflare Pages` GitHub Actions workflow builds the static output and deploys it to that project. Before dispatching it, configure repository secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` with a token that has Cloudflare Pages edit access. The custom domain `chassid.ai` still needs to be attached to the Pages project.

## Licensing

The platform code license is pending owner selection. Corpus editions carry their own rights records; no blanket text license is implied by this repository. Sefaria's metadata lists the two Tanya editions as CC-BY-NC; attribution and exact edition titles are included in each file. The project owner confirmed source rights for this release on 2026-11-11. The beta label remains until independent text collation is complete.
