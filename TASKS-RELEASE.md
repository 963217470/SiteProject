# Task System Release

Release: `rd-20261009-02`, 2026-10-09.

## Delivered

- Member task center at `/tasks/`; administrator tools at `/admin/tasks`.
- Draft, publish, close/reopen, deadlines, enrollment, paginated task filters and server-computed progress.
- Templates: publish accepted posts, read distinct posts for 180 effective seconds each, create accepted knowledge branches, Game Jam participation and custom evidence tasks.
- Only activity after enrollment counts. Previously published posts cannot be republished for extra credit. Reading progress survives personal history deletion.
- Game Jam requires an HTTPS project URL. Administrators can additionally require images and build files. Evidence supports rejection with reasons, versioned resubmission and approval. Self-review is prohibited.
- Private evidence files: five per submission, 100 MB per file under the deployed upload configuration, 500 MB per account. Referenced files are retained for audit. Uploaded builds are downloads, never executed on the application server; no malware-scanning claim is made.
- Append-only experience ledger, transaction-protected single reward, audited reversals and no repeat claims after reversal.
- Default thresholds: 0 trainee, 100 member, 500 senior member, 1500 expert, 4000 mentor. Chinese titles and thresholds are editable by administrators.
- Five disciplines: art, technical art, design, programming and operations. Discipline extension has no management UI yet.
- President/vice-president are appointed offices, independent of experience and permission roles. Profile pages show experience, discipline and office without blocking existing profile sections.
- The verified existing GitHub account `Wind-Celeste` (immutable ID `286876625`) was explicitly authorized and granted administrator role. This does not auto-promote future registrations.

## Verification

- 22 backend/migration tests, 21 Vue UI tests and six API client tests passed; production build passed.
- All 22 backend tests passed again on the deployment host before activation.
- Local isolated browser fixtures verified draft publication, enrollment, disabled premature reward claims, proof submission, approval and XP progression, appointed offices, level configuration UI and profile badge. Light/dark and desktop/mobile layouts were checked, including narrow-screen overflow.
- Binary evidence upload, privacy, quota, CSRF, rejected proofs, duplicate claims and audited reversals are covered by backend tests.
- Production: service active, both task pages HTTP 200 through local verified HTTPS, GitHub provider enabled, SQLite schema 3, integrity OK and no foreign-key errors.
- Production still has the single real user and zero tasks. Fixture accounts, tasks and the local preview authentication helper were excluded from deployment.
- These checks do not substitute for the user's actual public GitHub authorization/callback acceptance. Effective reading time is bounded telemetry, not proof of human attention.

## Backup And Recovery

- Full pre-release backup: `/var/backups/rd-studio/20261008T172806Z-13443`; archive checksums passed.
- Root-only pre-migration SQLite snapshot: `/var/backups/rd-studio/migration-rd-20261009-02.sqlite` (mode 600).
- Installer now restores the database snapshot as well as the previous code and web links if activation fails after the snapshot. SQLite snapshot creation and integrity restoration are tested; a deliberately failed production deployment was not performed.
- Previous release: `rd-20261009-01`. Do not switch its schema-2 backend onto the schema-3 live database. A frontend-only rollback can retain the current backend; a full old-version rollback requires restoring the pre-release database and uploads/configuration from the protected backup while the service is stopped.
- Full restoration loses changes made after the snapshot, including this administrator grant; reapply explicitly authorized permissions afterward. Keep backups off-server as a separate follow-up.

## Scope

This completes roadmap item 5. Shared game/tool catalogs, graph views, Markdown expansion, AI adapters and expanded community moderation are separate phases, not implied by evidence uploads or task progress. No demo tasks were published to production on the administrator's behalf.
