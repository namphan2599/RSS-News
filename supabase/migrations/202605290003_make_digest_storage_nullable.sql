alter table public.daily_digests
  alter column storage_bucket drop not null,
  alter column storage_path drop not null;
