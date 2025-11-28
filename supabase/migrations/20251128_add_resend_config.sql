-- Add Resend configuration items to system_configs

INSERT INTO public.system_configs (key, value, description, is_secret)
VALUES 
  ('sys.resend.apikey', 're_gexw6RSU_J7HFryR9ndAvbcYbiZ2aXzaa', 'Resend API Key', true),
  ('sys.resend.frommail', 'vip', 'Resend Sender Email Prefix (e.g. vip -> vip@domain.com)', false)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  is_secret = EXCLUDED.is_secret;
