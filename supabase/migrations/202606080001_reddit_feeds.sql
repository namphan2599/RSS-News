create table public.reddit_feeds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  subreddit text not null,
  url text not null unique,
  is_active boolean not null default true,
  last_fetched_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, subreddit)
);

create index reddit_feeds_owner_id_idx on public.reddit_feeds (owner_id);
create index reddit_feeds_is_active_idx on public.reddit_feeds (is_active);

create trigger reddit_feeds_set_updated_at
before update on public.reddit_feeds
for each row execute function public.set_updated_at();

alter table public.reddit_feeds enable row level security;

create policy "owner reads reddit feeds"
on public.reddit_feeds for select
to authenticated
using (owner_id = auth.uid());

create policy "owner inserts reddit feeds"
on public.reddit_feeds for insert
to authenticated
with check (owner_id = auth.uid() and public.is_owner());

create policy "owner updates reddit feeds"
on public.reddit_feeds for update
to authenticated
using (owner_id = auth.uid() and public.is_owner())
with check (owner_id = auth.uid() and public.is_owner());

create policy "owner deletes reddit feeds"
on public.reddit_feeds for delete
to authenticated
using (owner_id = auth.uid() and public.is_owner());

insert into public.reddit_feeds (
  owner_id,
  subreddit,
  url,
  is_active,
  last_fetched_at,
  last_error,
  created_at,
  updated_at
)
select distinct on (feeds.owner_id, reddit_info.subreddit)
  feeds.owner_id,
  reddit_info.subreddit,
  feeds.url,
  feeds.is_active,
  feeds.last_fetched_at,
  feeds.last_error,
  feeds.created_at,
  feeds.updated_at
from public.feeds
cross join lateral (
  select coalesce(
    (regexp_match(feeds.url, '^https?://(www\.)?reddit\.com/r/([^/.]+)\.rss$'))[2],
    (regexp_match(feeds.url, '^https?://(www\.)?reddit\.com/r/([^/]+)/\.rss/?$'))[2]
  ) as subreddit
) reddit_info
where reddit_info.subreddit is not null
order by feeds.owner_id, reddit_info.subreddit, feeds.created_at;

alter table public.reddit_post_summaries
drop constraint reddit_post_summaries_feed_id_fkey;

update public.reddit_post_summaries summaries
set feed_id = reddit_feeds.id
from public.feeds old_feeds
cross join lateral (
  select coalesce(
    (regexp_match(old_feeds.url, '^https?://(www\.)?reddit\.com/r/([^/.]+)\.rss$'))[2],
    (regexp_match(old_feeds.url, '^https?://(www\.)?reddit\.com/r/([^/]+)/\.rss/?$'))[2]
  ) as subreddit
) reddit_info
join public.reddit_feeds
  on reddit_feeds.owner_id = old_feeds.owner_id
  and reddit_feeds.subreddit = reddit_info.subreddit
where summaries.feed_id = old_feeds.id;

alter table public.reddit_post_summaries
add constraint reddit_post_summaries_feed_id_fkey
foreign key (feed_id) references public.reddit_feeds(id) on delete cascade;
