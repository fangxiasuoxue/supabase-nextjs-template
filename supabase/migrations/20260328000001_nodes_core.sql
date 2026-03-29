-- Migration: nodes_core
-- Description: Create core node management tables (idempotent)

-- 1. Node Profiles (Protocol Templates)
CREATE TABLE IF NOT EXISTS node_profiles (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        varchar(100) NOT NULL,
    engine      varchar(50)  NOT NULL DEFAULT 'xray',
    config_template jsonb    NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- 2. Nodes — CREATE only if not exists (old migration may have created it)
CREATE TABLE IF NOT EXISTS nodes (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        varchar(100) NOT NULL DEFAULT '',
    status      varchar(20) NOT NULL DEFAULT 'provisioning',
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- Add columns that may be missing from the older nodes table
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS user_id         uuid        REFERENCES auth.users(id);
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS profile_id      uuid        REFERENCES node_profiles(id);
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS vps_instance_id uuid        REFERENCES vps_instances(id);
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS ip_resource_ids uuid[]      DEFAULT '{}';
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS port            int;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS config_hash     varchar(64);
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS last_deployed_at timestamptz;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS expires_at      timestamptz;

-- 3. Node Deployments (Deployment Task State Machine)
CREATE TABLE IF NOT EXISTS node_deployments (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id         uuid        NOT NULL REFERENCES nodes(id),
    task_type       varchar(50) NOT NULL,
    status          varchar(20) NOT NULL DEFAULT 'pending',
    request_payload jsonb,
    response_payload jsonb,
    error_message   text,
    retry_count     int         DEFAULT 0,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_nodes_user_id ON nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
CREATE INDEX IF NOT EXISTS idx_deployments_node_id ON node_deployments(node_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON node_deployments(status);
