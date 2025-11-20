alter table public.ip_assets
  add column if not exists order_id text;