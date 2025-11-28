-- Configure WeChat Work Bot URL
INSERT INTO public.system_configs (key, value, description, is_secret)
VALUES 
  ('message.cheap.push.qywxboturl', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=a97e665a-252f-4b38-8027-3985381b0f6c', 'WeChat Work Bot Webhook URL', true)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  is_secret = EXCLUDED.is_secret;
