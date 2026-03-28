-- 修复安全问题: 移除硬编码的敏感信息
-- 创建日期: 2025-12-06 11:01:21
-- 说明: 清除之前迁移中硬编码的API密钥和Webhook URL

-- 1. 更新 Resend API Key 为空值（如果存在）
UPDATE public.system_configs 
SET value = '', 
    description = 'Resend API Key - 请通过管理界面或环境变量配置，不要硬编码'
WHERE key = 'sys.resend.apikey';

-- 2. 更新企业微信 Webhook URL 为空值（如果存在）
UPDATE public.system_configs 
SET value = '', 
    description = 'WeChat Work Bot Webhook URL - 请通过管理界面或环境变量配置，不要硬编码'
WHERE key = 'message.cheap.push.qywxboturl';

-- 3. 添加注释提醒
COMMENT ON COLUMN public.system_configs.value IS '配置值。敏感信息（API密钥、Webhook URL等）请通过管理界面或环境变量配置，不要硬编码在迁移文件中。';

-- 4. 确保这些配置项存在（如果不存在则创建）
INSERT INTO public.system_configs (key, value, description, "group", is_secret)
VALUES 
  ('sys.resend.apikey', '', 'Resend API Key - 请通过管理界面配置', 'email', true),
  ('sys.resend.frommail', 'vip', 'Resend Sender Email Prefix (e.g. vip -> vip@domain.com)', 'email', false),
  ('message.cheap.push.qywxboturl', '', 'WeChat Work Bot Webhook URL - 请通过管理界面配置', 'message', true)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  "group" = EXCLUDED."group",
  is_secret = EXCLUDED.is_secret,
  value = CASE 
    WHEN system_configs.value = '' THEN EXCLUDED.value
    ELSE system_configs.value
  END;
