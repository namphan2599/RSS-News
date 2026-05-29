create policy "owner reads digest markdown storage objects"
on storage.objects for select
to authenticated
using (
  bucket_id = 'digests'
  and exists (
    select 1
    from public.daily_digests
    where daily_digests.storage_bucket = storage.objects.bucket_id
      and daily_digests.storage_path = storage.objects.name
      and daily_digests.owner_id = auth.uid()
      and public.is_owner()
  )
);
