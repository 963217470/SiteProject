# Article Author Avatars - 2026-10-18

- Fixed the article list requesting only the author's username. It now requests the avatar too, which the existing card already supports.
- Extended the repository's explicit public author embed to accept `username,avatar_url`; legacy username-only requests remain unchanged. Other profile fields remain rejected. No database migration.
- Retained initial-letter fallback for missing or broken avatar images. Added a local fixture avatar to exercise real browser rendering.
- Verification: 98 backend and 141 frontend tests passed; production build passed with the existing chunk warning. Local browser confirmed six author images loaded. Production API verified both public articles return nonempty avatar fields, and server-local HTTPS routes and health checks passed. External public browser connectivity was not reverified.
- Backend: `/opt/rd-studio/releases/rd-article-avatar-20261018T033009Z`.
- Backend and database backup: `/var/backups/rd-studio/article-avatar-20261018T033009Z`.
- Frontend: `/www/wwwroot/rd-studio.club/releases/rd-ui-20261018T033044Z`.
- Frontend backup: `/var/backups/rd-studio/frontend-ui-20261018T033044Z`.
- Rollback both code symlinks together to backend `/opt/rd-studio/releases/rd-task-schedules-20261018T023608Z` and frontend `/www/wwwroot/rd-studio.club/releases/rd-ui-20261018T030627Z`, then restart `rd-studio`. No database restore is needed for this code-only change.
