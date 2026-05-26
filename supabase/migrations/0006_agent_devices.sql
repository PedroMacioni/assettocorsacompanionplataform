-- Modern agent device model.
-- Enforces one connected computer per account.

create table if not exists public.agent_devices (
  user_id uuid primary key references auth.users(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  device_name text not null,
  machine_fingerprint_hash text not null,
  device_secret_hash text not null,
  platform text not null default 'windows',
  app_version text,
  status text not null default 'connected'
    check (status in ('connected', 'revoked')),
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz,
  last_synced_at timestamptz,
  last_sync_sessions_count integer not null default 0,
  sync_requested_at timestamptz,
  revoked_at timestamptz,
  revoked_by text check (revoked_by is null or revoked_by in ('web', 'agent', 'system'))
);

create index if not exists agent_devices_status_idx
  on public.agent_devices (status);

create index if not exists agent_devices_last_seen_idx
  on public.agent_devices (last_seen_at desc);

alter table public.agent_devices enable row level security;

drop policy if exists "Users can read their own agent device"
  on public.agent_devices;
create policy "Users can read their own agent device"
  on public.agent_devices
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own agent device"
  on public.agent_devices;
create policy "Users can update their own agent device"
  on public.agent_devices
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own agent device"
  on public.agent_devices;
create policy "Users can delete their own agent device"
  on public.agent_devices
  for delete
  using (auth.uid() = user_id);

create table if not exists public.agent_pairing_requests (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique,
  device_name text not null,
  machine_fingerprint_hash text not null,
  device_secret_hash text not null,
  platform text not null default 'windows',
  app_version text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'cancelled', 'expired')),
  user_id uuid references auth.users(id) on delete cascade,
  approved_device_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  approved_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists agent_pairing_requests_public_code_idx
  on public.agent_pairing_requests (public_code);

create index if not exists agent_pairing_requests_status_expires_idx
  on public.agent_pairing_requests (status, expires_at);

create index if not exists agent_pairing_requests_user_id_idx
  on public.agent_pairing_requests (user_id);

alter table public.agent_pairing_requests enable row level security;

-- Pairing rows are created and polled by Next.js API routes using the
-- service-role client. Authenticated users only see requests after the
-- request has been attached to their account.
drop policy if exists "Users can read their own pairing requests"
  on public.agent_pairing_requests;
create policy "Users can read their own pairing requests"
  on public.agent_pairing_requests
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own pairing requests"
  on public.agent_pairing_requests;
create policy "Users can update their own pairing requests"
  on public.agent_pairing_requests
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
