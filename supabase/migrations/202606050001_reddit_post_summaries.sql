create table public.reddit_post_summaries (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.feeds(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  subreddit text not null,
  reddit_post_id text not null,
  title text not null,
  url text not null,
  summary text not null,
  summary_date date not null,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  ai_provider text not null default 'gemini',
  ai_model text not null,
  unique (feed_id, reddit_post_id)
);

create index reddit_post_summaries_summary_date_idx
on public.reddit_post_summaries (summary_date desc);

create index reddit_post_summaries_published_at_idx
on public.reddit_post_summaries (published_at desc);

create index reddit_post_summaries_feed_id_idx
on public.reddit_post_summaries (feed_id);

alter table public.reddit_post_summaries enable row level security;

create policy "owner reads reddit post summaries"
on public.reddit_post_summaries for select
to authenticated
using (owner_id = auth.uid() and public.is_owner());

create or replace view public.public_reddit_post_summaries as
select
  id,
  summary_date,
  subreddit,
  title,
  url,
  summary,
  published_at,
  fetched_at
from public.reddit_post_summaries;

revoke all on public.public_reddit_post_summaries from public;
grant usage on schema public to anon, authenticated;
grant select on public.public_reddit_post_summaries to anon, authenticated;
