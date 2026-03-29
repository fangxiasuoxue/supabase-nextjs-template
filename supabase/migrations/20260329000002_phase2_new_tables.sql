-- Migration: phase2_new_tables
-- Description: Phase-2 新增表和字段，支持告警中心、VPS 指标、IP 测试增强
-- Date: 2026-03-29

-- ============================================================
-- 1. proxy_test_results 新增字段（IP 测试增强）
-- ============================================================

ALTER TABLE proxy_test_results
    ADD COLUMN IF NOT EXISTS tested_from_vps_id uuid REFERENCES vps_instances(id),
    ADD COLUMN IF NOT EXISTS upload_mbps         numeric,
    ADD COLUMN IF NOT EXISTS download_mbps       numeric,
    ADD COLUMN IF NOT EXISTS tested_from_ip      text,
    ADD COLUMN IF NOT EXISTS test_method         text NOT NULL DEFAULT 'vercel'
        CHECK (test_method IN ('vercel', 'agent'));

CREATE INDEX IF NOT EXISTS idx_proxy_test_results_method
    ON proxy_test_results (test_method);

CREATE INDEX IF NOT EXISTS idx_proxy_test_results_vps
    ON proxy_test_results (tested_from_vps_id)
    WHERE tested_from_vps_id IS NOT NULL;

-- ============================================================
-- 2. alerts 告警表
-- ============================================================

CREATE TABLE IF NOT EXISTS alerts (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type    text        NOT NULL,
    severity      text        NOT NULL
                  CHECK (severity IN ('info', 'warning', 'critical')),
    resource_type text        NOT NULL,
    resource_id   text        NOT NULL,
    status        text        NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'acked', 'auto_resolved', 'closed')),
    title         text        NOT NULL,
    content       text,
    acked_by      uuid        REFERENCES auth.users(id),
    acked_at      timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_severity
    ON alerts (severity);

CREATE INDEX IF NOT EXISTS idx_alerts_status
    ON alerts (status);

CREATE INDEX IF NOT EXISTS idx_alerts_created_at
    ON alerts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_resource
    ON alerts (resource_type, resource_id);

-- RLS: admin/ops 可读写，普通用户不可见
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'alerts' AND policyname = 'alerts_admin_all'
    ) THEN
        CREATE POLICY "alerts_admin_all"
            ON alerts
            FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM user_roles
                    WHERE user_id = auth.uid()
                      AND role IN ('admin', 'ops')
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM user_roles
                    WHERE user_id = auth.uid()
                      AND role IN ('admin', 'ops')
                )
            );
    END IF;
END;
$$;

-- ============================================================
-- 3. vps_metrics 分区表（心跳指标存储）
-- ============================================================

CREATE TABLE IF NOT EXISTS vps_metrics (
    id          bigserial,
    instance_id uuid        NOT NULL REFERENCES vps_instances(id),
    recorded_at timestamptz NOT NULL DEFAULT now(),
    cpu_percent numeric,
    mem_percent numeric,
    disk_percent numeric,
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- 当前月份分区（2026-03）
CREATE TABLE IF NOT EXISTS vps_metrics_2026_03
    PARTITION OF vps_metrics
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- 下月分区（2026-04），提前创建避免写入失败
CREATE TABLE IF NOT EXISTS vps_metrics_2026_04
    PARTITION OF vps_metrics
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE INDEX IF NOT EXISTS idx_vps_metrics_instance_time
    ON vps_metrics (instance_id, recorded_at DESC);

-- RLS: 不启用（仅 service_role 写入，前端不直读）
-- vps_metrics 通过 API Route 经 callAgent 写入，无需 RLS

-- ============================================================
-- 4. pg_cron：每月25号自动创建下月分区（手动在 Supabase SQL Editor 执行）
-- ============================================================
-- 注意：pg_cron 内嵌 $$ 与外层冲突，需单独在 SQL Editor 粘贴执行：
--
-- SELECT cron.schedule(
--     'create-vps-metrics-partition',
--     '0 0 25 * *',
--     'SELECT create_next_vps_metrics_partition()'
-- );
--
-- CREATE OR REPLACE FUNCTION create_next_vps_metrics_partition()
-- RETURNS void LANGUAGE plpgsql AS $func$
-- DECLARE
--     next_month     date := date_trunc(''month'', now() + interval ''1 month'');
--     partition_name text := ''vps_metrics_'' || to_char(next_month, ''YYYY_MM'');
--     start_date     text := to_char(next_month, ''YYYY-MM-DD'');
--     end_date       text := to_char(next_month + interval ''1 month'', ''YYYY-MM-DD'');
-- BEGIN
--     EXECUTE format(
--         ''CREATE TABLE IF NOT EXISTS %I PARTITION OF vps_metrics FOR VALUES FROM (%L) TO (%L)'',
--         partition_name, start_date, end_date
--     );
-- END;
-- $func$;

-- ============================================================
-- 完成
-- ============================================================
