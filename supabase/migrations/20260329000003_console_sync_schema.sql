-- Migration: console_sync_schema
-- Description: 适配 Agent Local First，新增 sync 接口所需的字段和表
-- Date: 2026-03-29

-- ============================================================
-- 1. vps_instances 新增同步状态字段
-- ============================================================

ALTER TABLE vps_instances
  ADD COLUMN IF NOT EXISTS last_sync_at        timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_batch_id  text,
  ADD COLUMN IF NOT EXISTS sync_cpu_percent    numeric,
  ADD COLUMN IF NOT EXISTS sync_mem_percent    numeric,
  ADD COLUMN IF NOT EXISTS sync_disk_percent   numeric;

CREATE INDEX IF NOT EXISTS idx_vps_instances_last_sync
  ON vps_instances (last_sync_at DESC NULLS LAST);

-- ============================================================
-- 2. vps_instances 账单字段（来自 openclaw 定时同步）
-- ============================================================

ALTER TABLE vps_instances
  ADD COLUMN IF NOT EXISTS credit_remaining   numeric,
  ADD COLUMN IF NOT EXISTS cost_30d           numeric,
  ADD COLUMN IF NOT EXISTS upload_bytes       bigint,
  ADD COLUMN IF NOT EXISTS download_bytes     bigint,
  ADD COLUMN IF NOT EXISTS billing_updated_at timestamptz;

-- ============================================================
-- 3. agent_events 表（接收 sync 批次中的事件审计）
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid        NOT NULL REFERENCES vps_instances(id),
  batch_id      text        NOT NULL,
  event_type    text        NOT NULL,
  level         text        NOT NULL DEFAULT 'info'
                CHECK (level IN ('debug', 'info', 'warning', 'error', 'critical')),
  source        text        NOT NULL,
  payload       jsonb,
  agent_time    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_events_instance_time
  ON agent_events (instance_id, agent_time DESC);

CREATE INDEX IF NOT EXISTS idx_agent_events_level
  ON agent_events (level, agent_time DESC);

ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_events' AND policyname = 'agent_events_admin_all'
  ) THEN
    CREATE POLICY "agent_events_admin_all"
      ON agent_events FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid() AND role IN ('admin', 'ops')
        )
      );
  END IF;
END;
$$;

-- ============================================================
-- 完成
-- ============================================================
