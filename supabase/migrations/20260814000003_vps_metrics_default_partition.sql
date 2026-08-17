-- Migration: vps_metrics_default_partition ｜ Date: 2026-08-14 ｜ M4/W5 监控指标落库
-- 问题:vps_metrics 按月 RANGE 分区,但 20260329000002 只建了 2026_03/2026_04 分区。
--   现为 2026-08,无当月分区 → 任何 metrics 写入报 "no partition of relation found"。
-- 修复:加 DEFAULT 兜底分区,任何 recorded_at 落不到具体月分区时进 DEFAULT,
--   写入永不因缺分区失败(免去每月手动/pg_cron 建分区的运维负担)。
-- 状态:✅ 已在生产库 vvgdwqvuxzcwkhoeavle 执行(2026-08-14,SQL Editor)。
--   验证:当月(2026-08)指标 insert 成功(进 DEFAULT 分区),写入通道打通。
-- 前置:若已存在 DEFAULT 分区则 IF NOT EXISTS 跳过。

CREATE TABLE IF NOT EXISTS public.vps_metrics_default
    PARTITION OF public.vps_metrics DEFAULT;

-- 验证:
--   SELECT to_regclass('public.vps_metrics_default');  -- 期望非 null
--   插入测试(退场后清理):
--   INSERT INTO public.vps_metrics (instance_id, recorded_at, cpu_percent)
--     SELECT id, now(), 12.3 FROM public.vps_instances LIMIT 1;  -- 应成功(进 DEFAULT 分区)
