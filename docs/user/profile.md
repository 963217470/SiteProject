---
title: Profile
layout: page
---

<div id="profile-page"></div>

<style>
#profile-page {
  width: min(1120px, calc(100vw - 32px));
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
  padding: 1.75rem 0 3.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  overflow: hidden;
}

.profile-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 1.5rem;
  align-items: center;
  min-height: 180px;
  padding: 2rem 2.25rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.profile-body {
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr);
  min-height: 520px;
}

.profile-sidebar {
  border-right: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
}

.profile-tabs {
  display: grid;
  position: sticky;
  top: 86px;
}

.avatar-frame {
  display: grid;
  place-items: center;
  width: 116px;
  height: 116px;
  border-radius: 999px;
}

.member-frame {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.16), rgba(20, 184, 166, 0.14));
}

.admin-frame {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.24), rgba(239, 68, 68, 0.12));
}

.user-avatar {
  width: 100px;
  height: 100px;
  border: 4px solid var(--vp-c-bg);
  border-radius: 999px;
  object-fit: cover;
}

.profile-identity {
  min-width: 0;
}

.profile-identity h1 {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.35;
}

.email {
  margin: 0.5rem 0 0;
  color: var(--vp-c-text-2);
  font-size: 0.82rem;
  word-break: break-all;
}

.role-block {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.6rem;
  padding: 0.35rem 0.65rem;
  border-radius: 8px;
  font-size: 0.82rem;
}

.role-block span {
  color: inherit;
  opacity: 0.75;
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
  max-width: 520px;
  margin: 0.75rem 0 0;
  color: var(--vp-c-text-2);
  font-size: 0.88rem;
  line-height: 1.7;
}

.stats-card {
  display: grid;
  grid-template-columns: repeat(3, minmax(112px, 1fr));
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-c-bg);
}

.stats-card div {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
  padding: 0.75rem 0.95rem;
  text-align: center;
  border-right: 1px solid var(--vp-c-divider);
}

.stats-card div:last-child {
  border-right: 0;
}

.stats-card strong {
  color: var(--vp-c-text-1);
  font-size: 1.1rem;
}

.stats-card span {
  color: var(--vp-c-text-2);
  font-size: 0.78rem;
}

.profile-main {
  min-width: 0;
  padding: 1.75rem 2rem 2rem;
}

.profile-tabs button {
  display: grid;
  place-items: center;
  min-height: 92px;
  padding: 0 1rem;
  border: 0;
  border-bottom: 1px solid var(--vp-c-divider);
  background: transparent;
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 650;
}

.profile-tabs button.active {
  background: var(--vp-c-bg);
  color: var(--vp-c-brand-1);
  box-shadow: inset 3px 0 0 var(--vp-c-brand-1);
}

.panel {
  min-height: 100%;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.1rem;
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
  margin-bottom: 1.2rem;
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
  grid-template-columns: minmax(180px, 1fr) 74px 92px 78px 78px 78px auto;
  gap: 0.75rem;
  align-items: center;
  min-height: 92px;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
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
  gap: 1.1rem;
}

.article-card {
  display: grid;
  grid-template-columns: 118px minmax(0, 1fr);
  gap: 0.85rem;
  min-height: 118px;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
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

.settings-card {
  width: min(620px, 100%);
  margin: 1.5rem auto 0;
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

.settings-avatar-row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 1.4rem;
}

.settings-avatar-row img {
  width: 96px;
  height: 96px;
  border-radius: 999px;
  object-fit: cover;
}

.upload-button {
  display: inline-grid;
  place-items: center;
  min-height: 58px;
  padding: 0 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  cursor: pointer;
  font-weight: 500;
}

.upload-button.dragging {
  border-color: var(--vp-c-brand-1);
  background: rgba(20, 184, 166, 0.1);
  color: var(--vp-c-brand-1);
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

  .profile-hero {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .stats-card {
    grid-column: 1 / -1;
    width: 100%;
  }

  .profile-body {
    grid-template-columns: 1fr;
  }

  .profile-sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--vp-c-divider);
  }

  .profile-tabs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    position: static;
  }

  .profile-tabs button {
    min-height: 58px;
    border-right: 1px solid var(--vp-c-divider);
    border-bottom: 0;
    font-size: 0.92rem;
  }

  .profile-tabs button:last-child {
    border-right: 0;
  }

  .profile-tabs button.active {
    box-shadow: inset 0 -3px 0 var(--vp-c-brand-1);
  }

  .profile-main {
    padding: 1.25rem;
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
  .profile-layout {
    border-right: 0;
    border-left: 0;
    border-radius: 0;
  }

  .profile-hero {
    grid-template-columns: 1fr;
    justify-items: center;
    padding: 1.5rem 1rem;
    text-align: center;
  }

  .role-block {
    justify-content: center;
  }

  .stats-card,
  .status-grid,
  .card-grid {
    grid-template-columns: 1fr;
  }

  .stats-card div {
    border-right: 0;
    border-bottom: 1px solid var(--vp-c-divider);
  }

  .stats-card div:last-child {
    border-bottom: 0;
  }

  .profile-tabs button {
    min-height: 52px;
    padding: 0 0.4rem;
    font-size: 0.86rem;
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

  .settings-avatar-row {
    grid-template-columns: 1fr;
    justify-items: center;
  }
}
</style>
