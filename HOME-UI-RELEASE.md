# Homepage UI Adjustment

Date: 2026-10-10. Frontend release: `rd-20261010-03`.

- Desktop navigation uses a consistent 72px height and centered content container; menu text is 17px on screens at least 1200px wide. Brand/search/account typography increased proportionately.
- Homepage account and login text remain white over the background image. Expanded/hover account controls retain a translucent background; dropdown text uses the normal foreground color.
- Hero tagline increased from 16px to 22px and the explore button from 14px/44px to 18px/54px, with a larger arrow. Mobile retains smaller fixed sizes.
- Desktop new-article floating action button increased from 56px to 72px, with a 32px plus icon. Existing mobile hiding and editor-route behavior remain unchanged.
- Narrow desktop search is compact to avoid navigation crowding. Palette and background image unchanged.

## Verification And Recovery

- 25 UI tests passed; production build passed with the existing bundle-size warning.
- Browser checks: anonymous and authenticated desktop homepage, 1920px and default desktop geometry, 960px navigation, 390px mobile geometry, account dropdown and text contrast. No horizontal page overflow in the tested layouts. Authentication checks used the isolated local fixture, not a production bypass.
- Full pre-change backup: `/var/backups/rd-studio/20261010T082206Z-29816`; archive checksums passed.
- Frontend-only atomic deployment; production homepage HTTP 200 and API health passed over locally resolved, verified HTTPS. Backend remains `rd-20261010-02`, SQLite schema 4, with no backend/configuration change or service restart for this UI activation.
- Code-only rollback: restore the web `current` symlink to `/www/wwwroot/rd-studio.club/releases/rd-20261010-02`. No database restoration is needed for this adjustment.
