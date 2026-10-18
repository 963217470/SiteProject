# Task Reward Timing - 2026-10-18

- Confirmed the existing backend grants no task EXP on enrollment, rejects unfinished claims and grants proof-task EXP only after administrator approval. Repeated claims do not duplicate rewards. No backend behavior or stored experience was changed.
- Replaced ambiguous prospective `+EXP` displays with completion/review requirements; only completed/credited tasks show `已到账`. Daily tasks and the advanced-task placeholder follow the same distinction.
- Reward headings wrap on small screens instead of overflowing.
- Added backend assertions for zero task-ledger entries after enrollment, unsuccessful claims and pending proof submission; added UI coverage for prospective, pending-review and credited labels.
- Verification: 142 frontend tests and 35 focused backend task/community tests passed. Production build passed with the existing chunk warning. Local browser verified labels and no horizontal overflow at 390px. Server-local HTTPS routes and health checks passed after deployment; external public browser connectivity was not reverified.
- Frontend release: `/www/wwwroot/rd-studio.club/releases/rd-ui-20261018T035245Z`.
- Backup: `/var/backups/rd-studio/frontend-ui-20261018T035245Z`.
- Rollback frontend `current` atomically to `/www/wwwroot/rd-studio.club/releases/rd-ui-20261018T033044Z`. No backend/database deployment or restore required.
