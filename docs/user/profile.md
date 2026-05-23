---
title: Profile
layout: page
---

<div id="profile-page"></div>

<style>
#profile-page {
  width: min(1180px, calc(100vw - 32px));
  margin: 0 auto;
}

.state-panel {
  padding: 4rem 1.5rem;
  text-align: center;
  color: var(--vp-c-text-2);
}

.state-panel a {
  color: var(--vp-c-brand-1);
}

.profile-layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 1.5rem;
  padding: 1.75rem 0 3rem;
}

.profile-sidebar {
  display: grid;
  gap: 1rem;
  align-content: start;
  position: sticky;
  top: 86px;
}

.profile-card,
.stats-card,
.panel {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
}

.profile-card {
  display: grid;
  justify-items: center;
  padding: 1.5rem;
  text-align: center;
}

.avatar-frame {
  display: grid;
  place-items: center;
  width: 124px;
  height: 124px;
  margin-bottom: 1rem;
  border-radius: 999px;
}

.member-frame {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.16), rgba(20, 184, 166, 0.14));
}

.admin-frame {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.24), rgba(239, 68, 68, 0.12));
}

.user-avatar {
  width: 108px;
  height: 108px;
  border: 4px solid var(--vp-c-bg);
  border-radius: 999px;
  object-fit: cover;
}

.profile-card h1 {
  margin: 0;
  font-size: 1.25rem;
}

.email {
  margin: 0.35rem 0 1rem;
  color: var(--vp-c-text-2);
  font-size: 0.82rem;
  word-break: break-all;
}

.role-block {
  display: grid;
  gap: 0.25rem;
  width: 100%;
  padding: 0.8rem;
  border-radius: 8px;
  font-size: 0.82rem;
}

.admin-role {
  background: rgba(245, 158, 11, 0.12);
  color: #92400e;
}

.member-role {
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
}

.bio {
  width: 100%;
  margin: 1rem 0 0;
  color: var(--vp-c-text-2);
  font-size: 0.88rem;
  line-height: 1.7;
}

.stats-card {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  overflow: hidden;
}

.stats-card div {
  display: grid;
  gap: 0.25rem;
  padding: 1rem;
  border-right: 1px solid var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
}

.stats-card div:nth-child(2n) {
  border-right: 0;
}

.stats-card div:nth-last-child(-n + 2) {
  border-bottom: 0;
}

.stats-card strong {
  color: var(--vp-c-text-1);
  font-size: 1.25rem;
}

.stats-card span {
  color: var(--vp-c-text-2);
  font-size: 0.78rem;
}

.profile-main {
  min-width: 0;
}

.profile-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  overflow-x: auto;
}

.profile-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 38px;
  padding: 0 0.85rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  cursor: pointer;
  white-space: nowrap;
}

.profile-tabs button.active {
  border-color: var(--vp-c-brand-1);
  background: rgba(20, 184, 166, 0.1);
  color: var(--vp-c-brand-1);
}

.panel {
  padding: 1.25rem;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.panel-head h2 {
  margin: 0;
  font-size: 1.18rem;
}

.panel-head p {
  margin: 0.25rem 0 0;
  color: var(--vp-c-text-2);
  font-size: 0.86rem;
}

.primary-link {
  padding: 0.55rem 0.9rem;
  border-radius: 8px;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 0.86rem;
  text-decoration: none;
  white-space: nowrap;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.status-grid div {
  display: grid;
  gap: 0.25rem;
  padding: 0.85rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.status-grid strong {
  font-size: 1.15rem;
}

.status-grid span,
.article-row span,
.article-card span {
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}

.article-table {
  display: grid;
  gap: 0.65rem;
}

.article-row {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) 74px 92px 78px 78px 78px auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.85rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

.article-title {
  overflow: hidden;
  color: var(--vp-c-text-1);
  font-weight: 650;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-pill {
  display: inline-grid;
  place-items: center;
  min-height: 24px;
  padding: 0 0.5rem;
  border-radius: 999px;
  background: var(--vp-c-bg-soft);
}

.status-published {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.status-pending {
  background: rgba(245, 158, 11, 0.14);
  color: #92400e;
}

.status-rejected {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

.row-actions {
  display: flex;
  gap: 0.4rem;
  justify-content: flex-end;
}

.row-actions a {
  padding: 0.35rem 0.55rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  color: var(--vp-c-text-1);
  font-size: 0.78rem;
  text-decoration: none;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.article-card {
  display: grid;
  grid-template-columns: 116px minmax(0, 1fr);
  gap: 0.85rem;
  padding: 0.85rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
}

.article-card img {
  width: 116px;
  height: 82px;
  border-radius: 6px;
  object-fit: cover;
}

.article-card h3 {
  margin: 0;
  font-size: 0.98rem;
}

.article-card p {
  display: -webkit-box;
  margin: 0.35rem 0;
  overflow: hidden;
  color: var(--vp-c-text-2);
  font-size: 0.84rem;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.settings-form {
  display: grid;
  gap: 1rem;
}

.settings-form label {
  display: grid;
  gap: 0.45rem;
  color: var(--vp-c-text-1);
  font-weight: 650;
}

.settings-form input,
.settings-form textarea {
  width: 100%;
  padding: 0.72rem 0.8rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font: inherit;
  font-weight: 400;
}

.avatar-upload {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.avatar-upload img {
  width: 86px;
  height: 86px;
  border-radius: 999px;
  object-fit: cover;
}

.upload-button {
  display: inline-grid;
  place-items: center;
  min-height: 38px;
  padding: 0 0.85rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}

.upload-button input {
  display: none;
}

.form-note {
  margin: 0;
  padding: 0.8rem;
  border-radius: 8px;
  background: rgba(245, 158, 11, 0.12);
  color: #92400e;
  font-size: 0.86rem;
}

.submit-button {
  width: fit-content;
  min-height: 40px;
  padding: 0 1rem;
  border: 0;
  border-radius: 8px;
  background: var(--vp-c-brand-1);
  color: #fff;
  cursor: pointer;
}

.submit-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.empty-state,
.success-message,
.error-message {
  padding: 1rem;
  border-radius: 8px;
}

.empty-state {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  text-align: center;
}

.success-message {
  margin-bottom: 1rem;
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.error-message {
  margin-bottom: 1rem;
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

@media (max-width: 980px) {
  #profile-page {
    width: min(100%, calc(100vw - 24px));
  }

  .profile-layout {
    grid-template-columns: 1fr;
  }

  .profile-sidebar {
    position: static;
  }

  .article-row {
    grid-template-columns: 1fr 72px;
  }

  .article-row span,
  .row-actions {
    grid-column: span 2;
  }
}

@media (max-width: 640px) {
  .status-grid,
  .card-grid {
    grid-template-columns: 1fr;
  }

  .panel-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .article-card {
    grid-template-columns: 96px minmax(0, 1fr);
  }

  .article-card img {
    width: 96px;
    height: 72px;
  }
}
</style>
