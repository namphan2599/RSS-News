create or replace view public.public_daily_digests as
select
  id,
  digest_date,
  title,
  summary,
  item_count,
  generated_at
from public.daily_digests;

revoke all on public.public_daily_digests from public;
grant usage on schema public to anon, authenticated;
grant select on public.public_daily_digests to anon, authenticated;
