# Article List Cover Size - 2026-10-18

- Enlarged list-view article covers to 38% of the inner card width and stretched their frames to match the content height (minimum 260px on desktop).
- Images remain fully visible using `object-fit: contain`; first-image selection and starry fallback are unchanged.
- At 600px and below, the cover sits above the text. Grid view and article detail banners are unchanged.
- Verification: 139 frontend tests passed; production build passed with the existing chunk-size warning. Local browser checked desktop sizing and 390px mobile layout with no horizontal overflow.
- Deployment: `/www/wwwroot/rd-studio.club/releases/rd-ui-20261018T025024Z`.
- Backup: `/var/backups/rd-studio/frontend-ui-20261018T025024Z`.
- Rollback target: `/www/wwwroot/rd-studio.club/releases/rd-ui-20261018T024347Z` (atomically restore frontend `current` symlink).
- Server-local HTTPS route checks and API health passed; no backend or database changes. External public browser connectivity not reverified.
