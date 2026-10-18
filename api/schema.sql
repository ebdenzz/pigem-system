-- ============================================================
-- PIGEM database setup (Supabase / PostgreSQL)
-- HOW TO USE: Supabase dashboard -> SQL Editor -> New query -> paste this whole file -> Run
-- It is safe to run more than once.
-- ============================================================

-- MAJOR: 1) PROFILES - one row per login account, with the role that controls access
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text not null default '',
  role       text not null default 'customer' check (role in ('customer','agent','manager','admin')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- MAJOR: 2) APPLICATIONS - one row per internet service application
create table if not exists public.applications (
  id                uuid primary key default gen_random_uuid(),
  reference         text unique not null,                 -- example: PG-20261016-AB12CD
  customer_id       uuid not null references public.profiles(id),
  agent_id          uuid references public.profiles(id),  -- the Agent handling it (null = unclaimed)
  referral_agent_id uuid references public.profiles(id),  -- the Agent whose link was used
  status            text not null default 'Processing'
                    check (status in ('Processing','Needs Correction','Ready for Encoding','Provider Processing','Approved','Rejected')),
  plan              text not null,
  version           integer not null default 1,           -- goes up each time the customer corrects it
  details           jsonb not null default '{}',          -- everything typed in the form
  documents         jsonb not null default '{}',          -- storage paths of uploaded files
  screening         jsonb,                                -- result from the Python AI screening service
  correction_note   text not null default '',
  provider_reference text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- MAJOR: 3) NOTIFICATIONS - messages shown inside the website
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id),
  message    text not null,
  created_at timestamptz not null default now()
);

-- MAJOR: 4) ACTIVITY - a history of who did what
create table if not exists public.activity (
  id             bigint generated always as identity primary key,
  application_id uuid references public.applications(id),
  actor_id       uuid references public.profiles(id),
  event          text not null,
  detail         text not null default '',
  created_at     timestamptz not null default now()
);

-- ============================================================
-- MAJOR: AUTOMATIC PROFILE - every new sign-up becomes a 'customer'.
-- Roles can only be changed later by an Admin (or in this SQL editor).
-- ============================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''), 'customer');
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- MINOR: helper that returns the role of the person who is logged in
create or replace function public.my_role() returns text
language sql security definer stable set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

-- ============================================================
-- MAJOR: SECURITY RULES (Row Level Security) - who can see / change what
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.applications   enable row level security;
alter table public.notifications  enable row level security;
alter table public.activity       enable row level security;

-- PROFILES: you see yourself; staff see everyone; only Admin changes roles
drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles admin"  on public.profiles;
create policy "profiles read"  on public.profiles for select to authenticated
  using (id = auth.uid() or public.my_role() in ('agent','manager','admin'));
create policy "profiles admin" on public.profiles for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- APPLICATIONS: customers see their own, agents see unclaimed + their own, managers see all
drop policy if exists "apps read"             on public.applications;
drop policy if exists "apps customer insert"  on public.applications;
drop policy if exists "apps customer update"  on public.applications;
drop policy if exists "apps agent update"     on public.applications;
drop policy if exists "apps manager update"   on public.applications;

create policy "apps read" on public.applications for select to authenticated
  using (
    customer_id = auth.uid()
    or public.my_role() = 'manager'
    or (public.my_role() = 'agent' and (agent_id is null or agent_id = auth.uid()))
  );

create policy "apps customer insert" on public.applications for insert to authenticated
  with check (
    customer_id = auth.uid() and public.my_role() = 'customer' and status = 'Processing'
    and (agent_id is null or exists (select 1 from public.profiles p where p.id = agent_id and p.role = 'agent' and p.active))
  );

-- MINOR: a customer can only edit an application that was sent back for correction
create policy "apps customer update" on public.applications for update to authenticated
  using (customer_id = auth.uid() and status = 'Needs Correction')
  with check (customer_id = auth.uid() and status = 'Processing');

create policy "apps agent update" on public.applications for update to authenticated
  using (public.my_role() = 'agent' and (agent_id is null or agent_id = auth.uid()))
  with check (public.my_role() = 'agent' and agent_id = auth.uid());

create policy "apps manager update" on public.applications for update to authenticated
  using (public.my_role() = 'manager') with check (public.my_role() = 'manager');

-- NOTIFICATIONS: you read only your own; any logged-in user may send one
drop policy if exists "notes read"   on public.notifications;
drop policy if exists "notes insert" on public.notifications;
create policy "notes read"   on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notes insert" on public.notifications for insert to authenticated with check (auth.uid() is not null);

-- ACTIVITY: staff read it; anyone logged in can add their own entries
drop policy if exists "activity read"   on public.activity;
drop policy if exists "activity insert" on public.activity;
create policy "activity read"   on public.activity for select to authenticated
  using (public.my_role() in ('agent','manager','admin'));
create policy "activity insert" on public.activity for insert to authenticated with check (actor_id = auth.uid());

-- ============================================================
-- MAJOR: FILE STORAGE - a private bucket named "documents"
-- Files are saved as  <user id>/<file name>
-- ============================================================
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents upload" on storage.objects;
drop policy if exists "documents read"   on storage.objects;
create policy "documents upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents read" on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.my_role() in ('agent','manager'))
  );

-- ============================================================
-- AFTER RUNNING: make your first Admin (replace the email, then run this line alone)
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- ============================================================
