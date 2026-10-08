# UI Release: 2026-10-09

This release completes the scoped Phase 3 presentation and interaction changes. It does not implement task/XP, game uploads, graph mode, or AI integrations.

## Changes

- Shared Vue article library replaces old HTML-string rendering on the homepage and article listing.
- Search, tag/visibility filtering, sorting, view selection, pagination, and recoverable loading/empty/error states.
- Homepage entry links, tighter page spacing, stable cover sizes, red/black default covers, and editor Lucide tools.
- Knowledge-base retries and initialization on each page mount, with server-appropriate error messages.
- Responsive knowledge, profile, editor, internal and admin layouts, without duplicate documentation sidebars.
- Reduced-motion support and accessible control names/status announcements. Mobile publishing uses page actions instead of a floating button that overlaps content.

## Verification

- 15 UI, 11 backend and 6 client tests passed; production build passed.
- Browser checks: desktop 1440x900, mobile 390x844, narrow 320x740; article search/grid, dark theme, knowledge branch selection and editor heading insertion.
- Narrow-screen document scroll width equals client width after fixing the inherited body minimum width.
- Homepage and article covers loaded. Fixture data exists only in the local temporary `rd-studio-ui-preview-data` database; no fixture content is deployed.
- Authenticated profile and administrator screens have automated coverage and scoped CSS changes, but were not visually accepted through a real GitHub session in this run.

## Recovery

- Deployed release: `rd-20261009-01`. Server-loopback HTTPS static-page checks, service health, Nginx configuration validation and GitHub-enabled settings passed. Public browser OAuth verification remains separate.
- Pre-release snapshot: `/var/backups/rd-studio/20261008T163736Z-12798`; backup archive checksums passed.
- Keep the prior release `rd-20261008-04` for code rollback. UI changes require no database migration.
- Full data restore discards activity after the snapshot; prefer release-symlink rollback for presentation regressions.
