-- 添加消息管理模块的系统配置项

-- Webhook 服务路由配置
insert into public.system_configs (key, value, description, "group", is_secret)
values (
  'sys.outservice.cheapwebhook.url',
  '/api/outservice/cheapwebhook',
  'Proxy-Cheap Webhook 服务路由',
  'webhook',
  false
)
on conflict (key) do nothing;

-- Webhook 签名密钥
insert into public.system_configs (key, value, description, "group", is_secret)
values (
  'message.cheap.webhook.secret',
  '',
  'Proxy-Cheap Webhook 签名密钥(从 proxy-cheap 平台获取)',
  'webhook',
  true
)
on conflict (key) do nothing;

-- 默认转发用户列表
insert into public.system_configs (key, value, description, "group", is_secret)
values (
  'message.cheap.forward.users',
  '[]',
  '默认转发用户ID列表(JSON数组格式)',
  'message',
  false
)
on conflict (key) do nothing;

-- 企业微信机器人 URL
insert into public.system_configs (key, value, description, "group", is_secret)
values (
  'message.cheap.push.qywxboturl',
  '',
  '企业微信机器人 Webhook URL',
  'message',
  false
)
on conflict (key) do nothing;
