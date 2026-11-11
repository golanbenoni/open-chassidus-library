# Open Chassidus Library

This repository contains the public library site and its source-first corpus tools. The project is in a source and rights review phase. The catalog currently lists three pilot candidates; it does not yet publish text editions or downloads. The preview is hosted at `https://open-chassidus-library.pages.dev` while the custom domain is being connected.

## Product rules

- Public reading and downloads will not require an account or payment.
- Each released text will identify its work, edition, source, rights basis, transcription history, and checksum.
- Text corrections are reviewed and versioned. The library does not publish AI-authored source text.
- Only Tier A works with a documented public-domain or license basis may enter the initial corpus. Gated-service material and unverified translations are excluded.

## Development

This is a dependency-free static site. Run `node scripts/build.mjs` to copy `src/` into `dist/` for Cloudflare Pages. The site currently presents the project, release rules, and pilot catalog; a reader and downloads will appear only after an edition passes source and rights review.

## Licensing

The platform code license is pending owner selection. Corpus editions will carry their own rights records; no blanket text license is implied by this repository.
