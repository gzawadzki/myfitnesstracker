-- Google Health API v4 OAuth tokens, one row per user. Run in the Supabase SQL Editor.
-- Refresh token is the long-lived secret; access token is a short-lived cache.
-- RLS denies ALL client access — only the Vercel serverless functions (service-role key) touch it,
-- so tokens are never exposed to the browser (unlike the old localStorage access_token).

create table if not exists public.google_health_tokens (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  access_token  text,
  expires_at    timestamptz,
  scope         text,
  connected_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.google_health_tokens enable row level security;
-- No policies for anon/authenticated => the table is invisible to the client entirely.
-- The service-role key used by the Vercel functions bypasses RLS.

create or replace function public.touch_google_health_tokens()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_google_health_tokens on public.google_health_tokens;
create trigger trg_touch_google_health_tokens
  before update on public.google_health_tokens
  for each row execute function public.touch_google_health_tokens();
