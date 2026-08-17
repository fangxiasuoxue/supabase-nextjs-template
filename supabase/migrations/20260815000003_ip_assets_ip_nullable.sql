-- Migration: ip_assets.ip / public_ip 放开 NOT NULL ｜ Date: 2026-08-15
-- 背景:/services/proxies 返回的过期代理 publicIp=null,而 ip / public_ip 列原带 NOT NULL,
--   SYNC upsert 过期行时报 "null value in column ip violates not-null constraint"。
--   过期代理本就无出口 IP,应允许 NULL(列表按 status 区分,不靠 ip 判活)。
-- 状态:✅ 生产已执行(2026-08-15)。

ALTER TABLE public.ip_assets ALTER COLUMN ip DROP NOT NULL;
ALTER TABLE public.ip_assets ALTER COLUMN public_ip DROP NOT NULL;
