-- DB-006: knowledge branches and branch requests.

begin;

create table if not exists public.knowledge_branches (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.knowledge_branches(id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_branches_name_not_blank check (length(trim(name)) > 0),
  constraint knowledge_branches_slug_not_blank check (length(trim(slug)) > 0),
  constraint knowledge_branches_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint knowledge_branches_sort_order_nonnegative_check check (sort_order >= 0),
  constraint knowledge_branches_no_self_parent check (parent_id is null or parent_id <> id)
);

create unique index if not exists knowledge_branches_parent_slug_uidx
on public.knowledge_branches (
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  slug
);

create index if not exists knowledge_branches_parent_sort_idx
on public.knowledge_branches (parent_id, sort_order, name);

create table if not exists public.knowledge_branch_requests (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  requested_path text not null,
  status text not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_branch_requests_path_not_blank
    check (length(trim(requested_path)) > 0),
  constraint knowledge_branch_requests_status_check
    check (status in ('pending', 'approved', 'rejected')),
  constraint knowledge_branch_requests_review_state_check check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
  )
);

create index if not exists knowledge_branch_requests_status_created_idx
on public.knowledge_branch_requests (status, created_at desc);

create index if not exists knowledge_branch_requests_requester_created_idx
on public.knowledge_branch_requests (requester_id, created_at desc);

create index if not exists knowledge_branch_requests_article_idx
on public.knowledge_branch_requests (article_id);

create unique index if not exists knowledge_branch_requests_pending_article_uidx
on public.knowledge_branch_requests (article_id)
where status = 'pending';

drop trigger if exists set_knowledge_branches_updated_at on public.knowledge_branches;
create trigger set_knowledge_branches_updated_at
before update on public.knowledge_branches
for each row execute function public.set_updated_at();

drop trigger if exists set_knowledge_branch_requests_updated_at on public.knowledge_branch_requests;
create trigger set_knowledge_branch_requests_updated_at
before update on public.knowledge_branch_requests
for each row execute function public.set_updated_at();

alter table public.articles
drop constraint if exists articles_kb_branch_id_fkey;

alter table public.articles
add constraint articles_kb_branch_id_fkey
foreign key (kb_branch_id) references public.knowledge_branches(id) on delete set null;

alter table public.articles
drop constraint if exists articles_kb_selection_check;

alter table public.articles
add constraint articles_kb_selection_check
check (not kb_enabled or kb_branch_id is not null);

alter table public.knowledge_branches enable row level security;
alter table public.knowledge_branch_requests enable row level security;

create policy "Anyone can view knowledge branches"
on public.knowledge_branches for select
using (true);

create policy "Admins can create knowledge branches"
on public.knowledge_branches for insert to authenticated
with check (public.is_admin() and created_by = auth.uid());

create policy "Admins can update knowledge branches"
on public.knowledge_branches for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete knowledge branches"
on public.knowledge_branches for delete to authenticated
using (public.is_admin());

create policy "Users can create own branch requests"
on public.knowledge_branch_requests for insert to authenticated
with check (
  requester_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1 from public.articles
    where articles.id = knowledge_branch_requests.article_id
      and articles.author_id = auth.uid()
  )
);

create policy "Users can view own branch requests"
on public.knowledge_branch_requests for select to authenticated
using (requester_id = auth.uid());

create policy "Admins can view all branch requests"
on public.knowledge_branch_requests for select to authenticated
using (public.is_admin());

create policy "Admins can update branch requests"
on public.knowledge_branch_requests for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete branch requests"
on public.knowledge_branch_requests for delete to authenticated
using (public.is_admin());

revoke all on table public.knowledge_branches from anon, authenticated;
revoke all on table public.knowledge_branch_requests from anon, authenticated;
grant select on table public.knowledge_branches to anon, authenticated;
grant insert, update, delete on table public.knowledge_branches to authenticated;
grant select, insert, update, delete on table public.knowledge_branch_requests to authenticated;

commit;
