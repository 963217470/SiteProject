# Homepage Quick Links - 2026-10-18

## Changes
- Unified the three homepage shortcuts with the same theme-aware pale red surface, border and dark title.
- Kept the existing destinations, responsive layout, hover lift and arrow movement. Hover and keyboard focus share red title feedback.
- Scoped the override to this component so other card colors remain unchanged.

## Verification
- Frontend: 139 tests passed across 28 files, including two shortcut regression tests.
- VitePress production build passed (existing large-chunk warning only).
- Local browser computed styles confirmed all three cards share background rgb(252, 240, 237), border rgb(236, 222, 218) and title rgb(48, 39, 37).
- Server-local HTTPS route checks and API health passed after deployment. Public external browser connectivity was not reverified.

## Deployment And Rollback
- Release: `/www/wwwroot/rd-studio.club/releases/rd-ui-20261018T024347Z`
- Backup: `/var/backups/rd-studio/frontend-ui-20261018T024347Z`
- Previous frontend: `/www/wwwroot/rd-studio.club/releases/rd-ui-20261018T023705Z`
- Frontend-only change; backend and database unchanged. Roll back by atomically switching the frontend `current` symlink to the previous release.
