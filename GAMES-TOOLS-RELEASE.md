# Games And Tools Release

Version: `rd-20261010-02`, 2026-10-10.

## Changes

- Global navigation now includes the games/tools catalog at `/games-tools/`.
- Public browsing, game/tool filters, title/summary search, pagination and shareable detail links.
- Signed-in authors can create, save drafts, submit, view their publications and edit their own entries. Edits use revision checks to prevent overwriting concurrent moderation changes.
- Markdown source, live preview, UTF-8 Markdown import, image insertion and uploaded cover selection. Rendering supports headings, lists, tables, fenced code and KaTeX formulas. Raw HTML and unsafe URL protocols are disabled.
- Metadata includes summary, platform, version and license/use scope. Download options include uploaded attachments and HTTPS links such as Baidu Netdisk, with an optional extraction code.
- Ordinary submissions require administrator review. Administrators can approve, reject with reasons and take down published entries. Ordinary author edits return to review; unpublished files are private to owner/admin.
- Files have a 100 MB per-file deployed limit, a 500 MB account catalog quota and 20 attachments per entry. Removing or canceling newly uploaded, unassociated files cleans them up. Previously associated files remain protected from storage deletion while referenced.
- Uploaded packages are served as attachments, never extracted or executed. Broad anonymous uploads, antivirus scanning and in-browser game execution are not enabled.
- Download visit counts include catalog attachment requests and external download-link visits; repeat visits to the same item/target from the same visitor are deduplicated for ten minutes. Counts do not prove successful download completion or installation. Anonymous deduplication uses a keyed hash; raw IP addresses are not stored in the catalog counting table.
- Fixed JSON-type upload streams being consumed by the general API parser, and preserved safe download MIME types after setting attachment filenames.

## Validation

- 62 automated tests passed: 31 backend/migration, 25 Vue UI and six API client tests. All 31 backend tests passed again on the production host.
- Production build passed. Existing bundle-size warning remains; no build failure.
- Local isolated browser checks exercised image upload/Markdown insertion, image/formula/code preview, file upload, submission, administrator approval, actual download and counter update. Downloaded file SHA256 matched its source.
- Desktop light/dark views, 390px catalog and 320px editor checked; no horizontal page overflow and catalog images loaded.
- Production verified HTTPS catalog page 200, public list API, service health, preserved administrator role, SQLite schema 4/integrity/foreign keys and GitHub provider configuration.
- No test entries or preview-authentication helper were deployed. Public OAuth browser acceptance and external cloud-drive availability are separate checks; the application does not fetch external download URLs on the server.

## Backup And Recovery

- Full pre-catalog backup: `/var/backups/rd-studio/20261010T070734Z-28663`; checksums passed.
- Pre-schema-4 snapshot: `/var/backups/rd-studio/migration-rd-20261010-01.sqlite`.
- Final activation snapshot: `/var/backups/rd-studio/migration-rd-20261010-02.sqlite` (already schema 4).
- The final release includes upload-cancellation cleanup after the initial catalog activation `rd-20261010-01`.
- Installer rollback protects database and code links if activation fails. No deliberately failing production activation was performed.
- Do not run the schema-3 task-only backend `rd-20261009-02` against the schema-4 database. Full rollback to that release requires a stopped service and restoration of the pre-catalog database plus matching uploads/configuration. This loses changes since the backup. Frontend-only rollback can keep the current backend.

## Remaining Roadmap Scope

This delivers the requested Markdown-and-download catalog increment of phase 6. Browser game sandbox hosting, malware scanning, richer catalog reviews and project version histories remain separate work; their absence does not prevent browsing, publishing or downloading through the delivered catalog.
