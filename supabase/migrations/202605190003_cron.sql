create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'generate-daily-rss-digest';

select cron.schedule(
  'generate-daily-rss-digest',
  '0 */3 * * *',
  $$
  select
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/generate-daily-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('source', 'cron')
    );
  $$
);
