# Favorites And Reading History - 2026-10-18

- Favorites now request the server-derived first Markdown image instead of the old independent cover field. Missing or broken images fall back to `/images/hero-bg.jpg`; images are displayed without cropping.
- Reading history now uses the same article card layout, including image, title and summary. Existing reading duration, remove/clear controls and pagination are retained.
- The bottom-right timestamp shows the last visit in Asia/Shanghai, formatted `yy/mm/dd/HH:mm`. Remove controls are outside the article link and placed at bottom left.
- History metadata is hydrated through the existing permission-filtered article endpoint; no backend or database change is required. Failure to hydrate keeps the original history entries.
- Verification: 140 frontend tests passed; production build passed with the existing chunk warning. Local browser checked favorites image loading, history cards and a 390px viewport without horizontal overflow. Production server-local HTTPS route and health checks passed; external public browser connectivity was not reverified.
- Release: `/www/wwwroot/rd-studio.club/releases/rd-ui-20261018T030627Z`.
- Backup: `/var/backups/rd-studio/frontend-ui-20261018T030627Z`.
- Rollback: atomically switch frontend `current` to `/www/wwwroot/rd-studio.club/releases/rd-ui-20261018T025024Z`.
