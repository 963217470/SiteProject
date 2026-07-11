-- DB-008: reviewed profile changes with atomic approval.

begin;

create table if not exists public.profile_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text,
  avatar_url text,
  bio text,
  status text not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_changes_username_check
    check (username is null or (length(trim(username)) between 1 and 40)),
  constraint profile_changes_avatar_url_length_check
    check (avatar_url is null or length(avatar_url) <= 2048),
  constraint profile_changes_bio_length_check
    check (bio is null or length(bio) <= 160),
  constraint profile_changes_status_check
    check (status in ('pending', 'approved', 'rejected')),
  constraint profile_changes_review_state_check check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
  ),
  constraint profile_changes_has_change_check
    check (username is not null or avatar_url is not null or bio is not null)
);

create index if not exists profile_changes_user_status_created_idx
on public.profile_changes (user_id, status, created_at desc);

create index if not exists profile_changes_status_created_idx
on public.profile_changes (status, created_at desc);

drop trigger if exists set_profile_changes_updated_at on public.profile_changes;
create trigger set_profile_changes_updated_at
before update on public.profile_changes
for each row execute function public.set_updated_at();

alter table public.profile_changes enable row level security;

create policy "Users can create own profile changes"
on public.profile_changes for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
);

create policy "Users can view own profile changes"
on public.profile_changes for select to authenticated
using (user_id = auth.uid());

create policy "Admins can view profile changes"
on public.profile_changes for select to authenticated
using (public.is_admin());

revoke all on table public.profile_changes from anon, authenticated;
grant select, insert on table public.profile_changes to authenticated;

create or replace function public.review_profile_change(
  p_change_id uuid,
  p_decision text,
  p_review_note text default null
)
returns public.profile_changes
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending_change public.profile_changes;
  reviewed_change public.profile_changes;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only administrators can review profile changes'
      using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Profile change decision must be approved or rejected'
      using errcode = '22023';
  end if;

  select * into pending_change
  from public.profile_changes
  where id = p_change_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Pending profile change not found'
      using errcode = 'P0002';
  end if;

  if p_decision = 'approved' then
    update public.profiles
    set
      username = case
        when pending_change.username is not null then trim(pending_change.username)
        else username
      end,
      avatar_url = case
        when pending_change.avatar_url is not null then pending_change.avatar_url
        else avatar_url
      end,
      bio = case
        when pending_change.bio is not null then pending_change.bio
        else bio
      end
    where id = pending_change.user_id;

    if not found then
      raise exception 'Profile for requested change not found'
        using errcode = 'P0002';
    end if;
  end if;

  update public.profile_changes
  set
    status = p_decision,
    review_note = nullif(trim(p_review_note), ''),
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_change_id
  returning * into reviewed_change;

  return reviewed_change;
end;
$$;

revoke all on function public.review_profile_change(uuid, text, text) from public;
grant execute on function public.review_profile_change(uuid, text, text) to authenticated;

commit;
