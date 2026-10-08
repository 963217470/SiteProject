# RD STUDIO development roadmap

## Delivery Rules

Continue in order without requiring a new approval message for each phase. Missing external credentials, filing, licenses, or infrastructure only block the dependent feature. Mark it pending and proceed with independent work. Unavailable modules must show an isolated empty/error state and never disable already-working workflows. Do not present future features as working controls.

Keep the current color palette. Implement one phase at a time, with database migrations, focused tests, desktop/mobile UI checks, accessibility checks, a pre-deployment backup, and explicit release notes. Do not treat a UI placeholder as a working feature.

Keep credentials and personal data out of Git. Existing generated files and unrelated working-tree changes are not part of these releases. Do not deploy schema changes without a tested recovery path. Full data recovery can discard activity since the snapshot; distinguish that from code-only rollback.

## Phase 1: GitHub Login

- GitHub OAuth backend is deployed. Credentials are still missing; real sign-in is not verified.
- Callback: `https://rd-studio.club/api/auth/github/callback`.
- Domain access is currently blocked by Aliyun ICP filing. Recheck before sign-in acceptance.
- Acceptance: real login/logout, persistent cookie session, and correct user permissions.

## Phase 2: Backup And Recovery

- Build a protected full snapshot of code, runtime, frontend, data, uploads, service configuration, and TLS files.
- Validate checksums, SQLite integrity, and archive extraction in an isolated directory. Do not overwrite production for a recovery drill.
- Acceptance: recovery drill and a recorded backup location.
- Completed snapshot: `/var/backups/rd-studio/20261008T005856Z-5728` (59 MB). SHA256 checks, isolated extraction, SQLite integrity/foreign keys, upload sizes, required files, and all seven restored backend tests passed. Live service health passed after the snapshot. This verifies recoverable artifacts, not a destructive full production restore or public OAuth login.

## Phase 3: UI And Interaction

- Audit existing layout, typography, spacing, navigation, responsive behavior, and error/loading/empty states; keep the existing palette.
- Introduce reusable controls using the current Vue/VitePress patterns and an icon library.
- Add restrained transitions, reduced-motion support, keyboard focus, and stable layouts. No large visual redesign without reviewing a first representative screen.
- Validate desktop/mobile screenshots and key workflows before expanding changes site-wide.

## Phase 4: Personal Dashboard And Community

- Consolidate existing publications and favorites into a personal dashboard; do not duplicate their storage.
- Add private reading history with last-read time, cumulative effective reading duration, progress, removal, and clear-history controls.
- Track server-validated reading sessions with bounded heartbeat increments, visible-tab/focus checks, and multi-tab deduplication. Client heartbeats are abuse-resistant telemetry, not proof of human attention.
- Improve comments with replies, pagination, edits, deletion, moderation, report queues, and notification state. Escape or sanitize content and enforce authorization on the server.
- Acceptance: users cannot access another user's history; reconnects do not double-count; hidden tabs do not earn reading credit; comment ownership and moderation are tested.

## Phase 5: Tasks, Experience And Identity

- Admin-authored templates: publish X accepted posts, read X distinct posts for 180 effective seconds each, create an accepted knowledge branch, participate in a Game Jam, and custom proof-based tasks.
- Add task lifecycle, eligibility, deadlines, progress, evidence submission, review, rejection/resubmission, and completion history.
- Evidence supports URLs, images, and game builds with access controls and upload limits.
- Use an append-only experience ledger with idempotent reward events, audited reversals, and anti-repeat rules. No direct client writes to XP or task completion.
- Progression titles: trainee, member, senior member, expert, mentor; thresholds remain configurable.
- President/vice-president are appointed offices, not automatically acquired administrator privileges. Keep progression, membership access, moderation permissions, and offices independent.
- Disciplines: art, technical art, design, programming, operations; allow admin-managed additions.
- Acceptance: concurrent completion cannot issue rewards twice; rejected evidence gives no reward; permissions never escalate from XP.

## Phase 6: Games And Tools

- Add shared catalogs with screenshots, versions, platforms, tags, authors, reviews, license, moderation, and file limits.
- Downloads use authorized server routes and bounded event counting. Display download count semantics explicitly; a served download is not proof of completed installation.
- Uploaded builds never execute on the application server. HTML games require a separate origin and sandbox policy before browser play is enabled.
- Validate archive type and path safety if extraction is introduced; malware scanning and quotas are prerequisites for broad public uploads.

## Phase 7: Knowledge Graph

- Preserve the existing folder/tree hierarchy; add graph mode as an additional view, not a destructive replacement.
- Use nodes for articles and branches; use typed edges for parent/child, references, and related knowledge.
- Add search, filters, focus neighborhoods, zoom, fit, drag, accessible list fallback, and mobile controls using a proven graph layout library.
- Separate graph geometry from database relations. Persist meaningful relationships and optional layout, not transient simulation coordinates.
- Enforce article visibility in graph queries, labels, search results, and previews. Test larger datasets and avoid overlapping labels.

## Phase 8: Markdown Notes

- Audit the existing editor and renderer. Reuse markdown-it/KaTeX rather than create a second incompatible parsing system.
- Add Markdown source editing, live preview, import/export, drafts, autosave recovery, and revision conflict handling.
- Verify formulas, fenced code, syntax highlighting, tables, headings, image dimensions, and constrained safe text colors/sizes.
- Sanitize embedded HTML and URLs; disallow scripts and arbitrary inline CSS. Specify supported syntax and migration behavior before changing existing articles.

## Phase 9: AI Knowledge Interfaces

- No paid AI dependency. Provide structured knowledge export, authenticated read-only MCP interfaces, and downloadable skill templates.
- Enforce the same visibility rules as the website, with scoped tokens, revocation, rate limits, and audit logs. Never expose private/internal notes by default.
- Confirm the exact video-to-notes application, its repository or URL, licensing, hosting requirements, and privacy model before embedding it.
- Prefer reviewed links/integration adapters; do not embed an unknown third-party page with unrestricted access.

## Current External Inputs

- GitHub OAuth Client ID/Secret must be configured directly in `/etc/rd-studio.env`.
- Administrator GitHub account/immutable ID must be specified.
- Domain ICP filing or Aliyun filing access must be completed.
- Git push requires an authenticated account with write access to `963217470/SiteProject`.
- Video2MD source is available at `E:/Coding/项目/Video2MD-master`; its desktop/core architecture was inspected. Integration and licensing notes are in `VIDEO2MD-INTEGRATION.md`.

## Progress

- Self-hosted backend and new database: deployed; seven backend tests and four client tests passed in the previous release.
- GitHub OAuth activation: waiting for credentials and public-domain access.
- Snapshot tooling: implemented and installed as `/usr/local/sbin/rd-studio-backup`; snapshot and isolated recovery checks passed. Off-server backup is still pending.
- Phase 3 first increment: account navigation, keyboard/focus access, logout error handling, initialization timing, navigation cleanup, reduced motion, and responsive hero fixes deployed in release `rd-20261008-03`. Five account UI tests, six client tests, and seven backend tests passed; production build and desktop/mobile checks passed. Whole-site UI audit is still in progress.
- Pre-increment backup: `/var/backups/rd-studio/20261008T020555Z-6792`; checksums passed.
- Phase 4 first increment: private account-level reading history, bounded effective reading time, foreground/idle handling, shared multi-tab credit clock, history pagination/removal/clear, and independent unavailable-history state deployed as `rd-20261008-04`. Existing publications and favorites retained. Schema v2 preserves v1 data. Eleven backend/migration tests, nine UI tests, and six client tests passed (26 total). Real OAuth sign-in acceptance is pending; authenticated feature tests use isolated signed test sessions, not a production login bypass.
- Pre-reading/migration snapshot: `/var/backups/rd-studio/20261008T050914Z-8492`; checksums passed.
- Phase 4 comments/replies/moderation and phases 5 through 9 are pending, not claimed complete. Video2MD assessment is complete; importer and worker are not yet implemented.
