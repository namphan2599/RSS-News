create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
as $$
  select lower(nullif(trim(auth.jwt() ->> 'email'), '')) = lower(nullif(trim(current_setting('app.owner_email', true)), ''));
$$;

create table public.feeds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text,
  url text not null unique,
  site_url text,
  category text,
  is_active boolean not null default true,
  last_fetched_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger feeds_set_updated_at
before update on public.feeds
for each row execute function public.set_updated_at();

create table public.rss_items (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.feeds(id) on delete cascade,
  guid text,
  url text not null,
  normalized_url text,
  title text not null,
  description text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  content_hash text not null,
  unique (feed_id, content_hash)
);

create index rss_items_published_at_idx on public.rss_items (published_at desc);
create index rss_items_fetched_at_idx on public.rss_items (fetched_at desc);
create index rss_items_feed_id_idx on public.rss_items (feed_id);

create table public.digest_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_date date not null,
  status text not null check (status in ('running', 'succeeded', 'failed', 'partial')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  feed_count int not null default 0,
  failed_feed_count int not null default 0,
  item_count int not null default 0,
  selected_item_count int not null default 0,
  input_tokens int,
  output_tokens int,
  ai_provider text,
  ai_model text,
  error text,
  metadata jsonb not null default '{}'::jsonb
);

create index digest_runs_run_date_idx on public.digest_runs (run_date desc);
create index digest_runs_owner_id_idx on public.digest_runs (owner_id);

create table public.daily_digests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  digest_date date not null,
  storage_bucket text not null default 'digests',
  storage_path text not null,
  title text not null,
  summary text,
  item_count int not null default 0,
  run_id uuid references public.digest_runs(id),
  generated_at timestamptz not null default now(),
  unique (owner_id, digest_date)
);

create index daily_digests_digest_date_idx on public.daily_digests (digest_date desc);
create index daily_digests_owner_id_idx on public.daily_digests (owner_id);

create table public.app_logs (
  id bigint generated always as identity primary key,
  level text not null check (level in ('debug', 'info', 'warn', 'error')),
  source text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index app_logs_created_at_idx on public.app_logs (created_at desc);

create table public.digest_locks (
  digest_date date primary key,
  run_id uuid not null references public.digest_runs(id) on delete cascade,
  acquired_at timestamptz not null default now()
);

alter table public.feeds enable row level security;
alter table public.rss_items enable row level security;
alter table public.digest_runs enable row level security;
alter table public.daily_digests enable row level security;
alter table public.app_logs enable row level security;
alter table public.digest_locks enable row level security;

create policy "owner reads feeds"
on public.feeds for select
to authenticated
using (owner_id = auth.uid());

create policy "owner inserts feeds"
on public.feeds for insert
to authenticated
with check (owner_id = auth.uid() and public.is_owner());

create policy "owner updates feeds"
on public.feeds for update
to authenticated
using (owner_id = auth.uid() and public.is_owner())
with check (owner_id = auth.uid() and public.is_owner());

create policy "owner deletes feeds"
on public.feeds for delete
to authenticated
using (owner_id = auth.uid() and public.is_owner());

create policy "owner reads rss items through owned feeds"
on public.rss_items for select
to authenticated
using (
  exists (
    select 1
    from public.feeds
    where feeds.id = rss_items.feed_id
      and feeds.owner_id = auth.uid()
  )
);

create policy "owner reads digest runs"
on public.digest_runs for select
to authenticated
using (owner_id = auth.uid() and public.is_owner());

create policy "owner reads daily digests"
on public.daily_digests for select
to authenticated
using (owner_id = auth.uid() and public.is_owner());

create policy "owner reads app logs"
on public.app_logs for select
to authenticated
using (public.is_owner());

create policy "owner reads digest locks"
on public.digest_locks for select
to authenticated
using (public.is_owner());
