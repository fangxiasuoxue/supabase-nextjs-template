-- Migration: ip_latency_matrix ｜ Date: 2026-08-15 ｜ IP 测速矩阵(需求 #3)
-- 用途:存「每个源节点 → 每个 proxy-cheap IP」的最新时延,供 IP 页矩阵 UI(行=IP,列=源节点)。
-- 采集(混合):openwrt/gorelay 由 bench 脚本(A)写;US1-7/HK1-2-4 由 agent 探针经 sync 上报(B)。
-- 键:(ip, source_node) 唯一 → 每格保留最新一条(collector 用 upsert)。
-- 状态:⚠️ 待生产 SQL Editor 执行。RLS 禁用(仅 service_role 写/读,前端经 API)。

CREATE TABLE IF NOT EXISTS public.ip_latency_matrix (
  id          bigserial PRIMARY KEY,
  ip          text        NOT NULL,          -- 目标 proxy-cheap IP(匹配 ip_assets.ip)
  source_node text        NOT NULL,          -- 'hk1'/'hk2'/'hk4'/'us1'..'us7'/'openwrt'/'gorelay'
  latency_ms  integer,                       -- null = 不可达/测试失败
  tested_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ip_latency_matrix_cell_uniq UNIQUE (ip, source_node)
);

CREATE INDEX IF NOT EXISTS idx_ip_latency_matrix_ip ON public.ip_latency_matrix (ip);

-- RLS:不启用(与 vps_metrics 同,仅 service_role 经 API 读写,前端不直读)
ALTER TABLE public.ip_latency_matrix DISABLE ROW LEVEL SECURITY;

-- collector 用法(A/B 都这样 upsert):
--   INSERT INTO public.ip_latency_matrix (ip, source_node, latency_ms, tested_at)
--   VALUES ($ip, $node, $ms, now())
--   ON CONFLICT (ip, source_node) DO UPDATE SET latency_ms = EXCLUDED.latency_ms, tested_at = EXCLUDED.tested_at;
