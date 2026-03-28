-- Migration: nodes_core
-- Description: Create core node management tables

-- 1. Node Profiles (Protocol Templates)
CREATE TABLE IF NOT EXISTS node_profiles (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        varchar(100) NOT NULL,
    engine      varchar(50)  NOT NULL DEFAULT 'xray', -- xray, gost, sing-box
    config_template jsonb    NOT NULL,               -- e.g. {"protocol": "vless", "security": "xtls"}
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- 2. Nodes (Proxy Nodes)
CREATE TABLE IF NOT EXISTS nodes (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        REFERENCES auth.users(id),
    name        varchar(100) NOT NULL,
    profile_id  uuid        REFERENCES node_profiles(id),
    vps_instance_id uuid    REFERENCES vps_instances(id),
    status      varchar(20) NOT NULL DEFAULT 'provisioning', -- provisioning, active, draining, error
    ip_resource_ids uuid[]  DEFAULT '{}',            -- Array of bound IP asset IDs
    port        int,
    config_hash varchar(64),
    last_deployed_at timestamptz,
    expires_at  timestamptz,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- 3. Node Deployments (Deployment Task State Machine)
CREATE TABLE IF NOT EXISTS node_deployments (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id     uuid        NOT NULL REFERENCES nodes(id),
    task_type   varchar(50) NOT NULL, -- create, update, rotate-ip, delete
    status      varchar(20) NOT NULL DEFAULT 'pending', -- pending, processing, success, fail, rollback
    request_payload jsonb,
    response_payload jsonb,
    error_message text,
    retry_count int         DEFAULT 0,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_nodes_user_id ON nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
CREATE INDEX IF NOT EXISTS idx_deployments_node_id ON node_deployments(node_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON node_deployments(status);
