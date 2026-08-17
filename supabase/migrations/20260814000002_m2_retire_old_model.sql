-- Migration: m2_retire_old_model  ✅ 已在生产库 vvgdwqvuxzcwkhoeavle 执行(2026-08-14,SQL Editor,验证通过)
-- Date: 2026-08-14 ｜ M2 阶段 e(旧模型退场,D9)
-- 执行前巡检:6 表 + nodes 均 count=0(无数据损失)。执行后验证:旧表/视图=null、vps_instances 完好、
--   nodes.vps_id 列消失、nodes_admin_ops_all 新策略建立。命中并解决 2BP01(旧 RLS 策略依赖 vps_id)。
-- 依据:ops/testing/security/old_model_freeze.js(6 旧表代码零引用,冻结成立)+ 26/22 号文档。
-- 前置闸门(必须全满足才可在生产 SQL Editor 执行):
--   1) 6 张旧表在生产「无数据」或数据已确认废弃(见文末巡检查询,人工确认);
--   2) 观察一周期无新代码/外部写入旧表(D9);
--   3) 生产快照/备份(pg_dump 或 Supabase 时点备份)后再执行。
-- 安全性说明:全程 IF EXISTS,对生产 schema 差异健壮;nodes 空表故列删数据安全;
--   视图/旧表代码零引用。仍属破坏性,故 gated。docker 自验见 ops/testing/m2/run_retire_tests.js。

BEGIN;

-- 1. 旧视图(代码零引用;node_statistics 依赖 nodes.vps_id,必须先删)
DROP VIEW IF EXISTS public.node_statistics;
DROP VIEW IF EXISTS public.subscription_details;

-- 1b. 旧 nodes RLS 策略(2025-12 建,引用 vps_id/node_permissions)→ 不删则 DROP COLUMN vps_id 报 2BP01
DROP POLICY IF EXISTS "Users can view authorized nodes"               ON public.nodes;
DROP POLICY IF EXISTS "Users can insert nodes they have permission for" ON public.nodes;
DROP POLICY IF EXISTS "Users can update authorized nodes"             ON public.nodes;
DROP POLICY IF EXISTS "Users can delete nodes with manage permission" ON public.nodes;

-- 1c. 新模型 nodes RLS:admin/ops 全权(nodes RLS 已开,删完旧策略必须补,否则 deny-all)。
--     非自引用(策略在 nodes、子查询在 user_roles),不触发 user_roles 递归锁死。
DROP POLICY IF EXISTS "nodes_admin_ops_all" ON public.nodes;
CREATE POLICY "nodes_admin_ops_all" ON public.nodes FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','ops')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','ops')));

-- 2. nodes 旧模型死列(指向旧表的 FK 列 + 其它旧字段;nodes 空表,数据安全)
ALTER TABLE public.nodes
  DROP COLUMN IF EXISTS vps_id,
  DROP COLUMN IF EXISTS source_config_id,
  DROP COLUMN IF EXISTS host,
  DROP COLUMN IF EXISTS uuid,
  DROP COLUMN IF EXISTS extra_params,
  DROP COLUMN IF EXISTS node_url,
  DROP COLUMN IF EXISTS qr_code_path,
  DROP COLUMN IF EXISTS is_manual,
  DROP COLUMN IF EXISTS traffic_up,
  DROP COLUMN IF EXISTS traffic_down,
  DROP COLUMN IF EXISTS traffic_total,
  DROP COLUMN IF EXISTS expire_time,
  DROP COLUMN IF EXISTS synced_at;

-- 3. 旧模型 6 表(代码零引用)。CASCADE 清残余 FK/触发器/RLS 策略。
--    顺序:子表先于父表(即便有 CASCADE 也显式排序,便于审阅)。
DROP TABLE IF EXISTS public.sync_logs           CASCADE;
DROP TABLE IF EXISTS public.subscription_nodes  CASCADE;
DROP TABLE IF EXISTS public.subscriptions       CASCADE;
DROP TABLE IF EXISTS public.node_permissions    CASCADE;
DROP TABLE IF EXISTS public.node_source_configs CASCADE;
DROP TABLE IF EXISTS public.vps_configs         CASCADE;

COMMIT;

-- ============================================================
-- 生产前置巡检(先在 SQL Editor 单独跑;6 表 count 都为 0、nodes 也为 0 才可执行上面的退场)
-- ============================================================
-- SELECT 'vps_configs' t, count(*) n FROM public.vps_configs
-- UNION ALL SELECT 'node_source_configs', count(*) FROM public.node_source_configs
-- UNION ALL SELECT 'node_permissions',    count(*) FROM public.node_permissions
-- UNION ALL SELECT 'subscriptions',       count(*) FROM public.subscriptions
-- UNION ALL SELECT 'subscription_nodes',  count(*) FROM public.subscription_nodes
-- UNION ALL SELECT 'sync_logs',           count(*) FROM public.sync_logs
-- UNION ALL SELECT 'nodes',               count(*) FROM public.nodes;
--
-- 退场后验证:上述表 to_regclass(...) 应全为 NULL;nodes 的旧列应消失;
--   SELECT to_regclass('public.vps_configs');  -- 期望 NULL
