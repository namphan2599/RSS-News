insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('digests', 'digests', false, 1048576, array['text/markdown', 'text/plain'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
