-- Migration: ip_assets provider_id 唯一索引 ｜ Date: 2026-08-15
-- 背景:Proxy-Cheap 正确端点 /services/proxies 返回 active+expired,但过期代理 publicIp=null。
--   原去重键 (provider, public_ip) 对 null 无效 → 改用 provider_id(proxy 稳定 id)去重。
-- 普通唯一索引(非部分):Postgres NULLS DISTINCT 允许多个 null provider_id(手工条目),
--   非空 provider_id 唯一,且匹配 supabase upsert 的裸 ON CONFLICT (provider, provider_id)。
-- 状态:✅ 生产已执行(2026-08-15)。历史遗留重复(旧 public_ip 去重期插入)先去重再建索引。

-- 1) 去重:同 (provider, provider_id) 保留 id 最大的一条,删掉较旧的
DELETE FROM public.ip_assets a
USING public.ip_assets b
WHERE a.provider = b.provider
  AND a.provider_id = b.provider_id
  AND a.provider_id IS NOT NULL AND a.provider_id <> ''
  AND a.id < b.id;

-- 2) 建唯一索引(NULLS DISTINCT:多个 null provider_id 手工条目允许并存)
CREATE UNIQUE INDEX IF NOT EXISTS ip_assets_unique_provider_providerid
  ON public.ip_assets (provider, provider_id);
