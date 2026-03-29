-- Migration: Create Node Management Tables
-- Created: 2025-12-06 11:01:20
-- Description: Creates all tables, indexes, RLS policies, and functions for node management system

-- ============================================
-- Enable Extensions
-- ============================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- VPS Configuration Table
-- ============================================
CREATE TABLE IF NOT EXISTS vps_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    ip VARCHAR(45) NOT NULL,
    port INTEGER DEFAULT 22,
    username VARCHAR(100),
    password TEXT, -- encrypted storage
    vps_module_id UUID, -- optional link to VPS module
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_vps_name UNIQUE(name)
);

COMMENT ON TABLE vps_configs IS 'VPS server configuration information';
COMMENT ON COLUMN vps_configs.password IS 'Encrypted SSH password';
COMMENT ON COLUMN vps_configs.vps_module_id IS 'Optional link to VPS module ID';

-- ============================================
-- Node Source Configuration Table
-- ============================================
CREATE TABLE IF NOT EXISTS node_source_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vps_id UUID REFERENCES vps_configs(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('3x-ui', 's-ui', 'xray-gateway', 'gost', 'xray-core')),
    api_url TEXT NOT NULL,
    username VARCHAR(100),
    password TEXT, -- encrypted storage
    token TEXT, -- encrypted storage
    sub_url TEXT,
    extra_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR(50) CHECK (last_sync_status IN ('success', 'failed', 'pending')),
    last_sync_error TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_vps_source UNIQUE(vps_id, source_type)
);

COMMENT ON TABLE node_source_configs IS 'Node source system configuration';
COMMENT ON COLUMN node_source_configs.source_type IS 'Source type: 3x-ui, s-ui, xray-gateway, gost, xray-core';
COMMENT ON COLUMN node_source_configs.extra_config IS 'Additional configuration parameters in JSON format';

-- ============================================
-- Nodes Table
-- ============================================
CREATE TABLE IF NOT EXISTS nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    vps_id UUID REFERENCES vps_configs(id) ON DELETE SET NULL,
    source_config_id UUID REFERENCES node_source_configs(id) ON DELETE SET NULL,
    protocol VARCHAR(50) NOT NULL CHECK (protocol IN ('vless', 'vmess', 'trojan', 'shadowsocks', 'ssr', 'socks', 'http')),
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL CHECK (port > 0 AND port <= 65535),
    uuid VARCHAR(255), -- UUID or password
    extra_params JSONB DEFAULT '{}',
    node_url TEXT,
    qr_code_path TEXT,
    status VARCHAR(20) DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled', 'expired')),
    is_manual BOOLEAN DEFAULT false,
    remark TEXT,
    traffic_up BIGINT DEFAULT 0 CHECK (traffic_up >= 0),
    traffic_down BIGINT DEFAULT 0 CHECK (traffic_down >= 0),
    traffic_total BIGINT DEFAULT 0 CHECK (traffic_total >= 0),
    expire_time TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE nodes IS 'Proxy node information';
COMMENT ON COLUMN nodes.is_manual IS 'Manually added nodes will not be overwritten by sync';
COMMENT ON COLUMN nodes.traffic_up IS 'Upload traffic in bytes';
COMMENT ON COLUMN nodes.traffic_down IS 'Download traffic in bytes';
COMMENT ON COLUMN nodes.traffic_total IS 'Total traffic limit in bytes, 0 means unlimited';
COMMENT ON COLUMN nodes.deleted_at IS 'Soft delete timestamp';

-- ============================================
-- Node Permissions Table
-- ============================================
CREATE TABLE IF NOT EXISTS node_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
    permission_type VARCHAR(20) NOT NULL CHECK (permission_type IN ('read', 'write', 'manage')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_node_permission UNIQUE(user_id, node_id, permission_type)
);

COMMENT ON TABLE node_permissions IS 'Node access permissions';
COMMENT ON COLUMN node_permissions.node_id IS 'NULL means global permission';
COMMENT ON COLUMN node_permissions.permission_type IS 'read: view, write: modify, manage: delete and sync';

-- ============================================
-- Subscriptions Table
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    subscription_token VARCHAR(100) UNIQUE NOT NULL,
    access_count INTEGER DEFAULT 0 CHECK (access_count >= 0),
    expire_time TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE subscriptions IS 'Subscription link management';
COMMENT ON COLUMN subscriptions.subscription_token IS 'Subscription access token';
COMMENT ON COLUMN subscriptions.access_count IS 'Subscription access count statistics';

-- ============================================
-- Subscription Nodes Association Table
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE NOT NULL,
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_subscription_node UNIQUE(subscription_id, node_id)
);

COMMENT ON TABLE subscription_nodes IS 'List of nodes included in subscription';
COMMENT ON COLUMN subscription_nodes.sort_order IS 'Node order in subscription';

-- ============================================
-- Sync Logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_config_id UUID REFERENCES node_source_configs(id) ON DELETE CASCADE NOT NULL,
    sync_type VARCHAR(20) CHECK (sync_type IN ('full', 'incremental')),
    status VARCHAR(20) CHECK (status IN ('success', 'failed', 'partial')),
    nodes_added INTEGER DEFAULT 0,
    nodes_updated INTEGER DEFAULT 0,
    nodes_deleted INTEGER DEFAULT 0,
    error_message TEXT,
    duration_ms INTEGER,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE sync_logs IS 'Node synchronization operation logs';
COMMENT ON COLUMN sync_logs.sync_type IS 'full: full sync, incremental: incremental sync';
COMMENT ON COLUMN sync_logs.duration_ms IS 'Sync duration in milliseconds';

-- ============================================
-- Create Indexes
-- ============================================

-- VPS configs indexes
CREATE INDEX IF NOT EXISTS idx_vps_configs_name ON vps_configs(name);
CREATE INDEX IF NOT EXISTS idx_vps_configs_created_by ON vps_configs(created_by);
CREATE INDEX IF NOT EXISTS idx_vps_configs_created_at ON vps_configs(created_at DESC);

-- Node source configs indexes
CREATE INDEX IF NOT EXISTS idx_node_source_configs_vps_id ON node_source_configs(vps_id);
CREATE INDEX IF NOT EXISTS idx_node_source_configs_source_type ON node_source_configs(source_type);
CREATE INDEX IF NOT EXISTS idx_node_source_configs_is_active ON node_source_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_node_source_configs_last_sync_at ON node_source_configs(last_sync_at DESC);

-- Nodes indexes
CREATE INDEX IF NOT EXISTS idx_nodes_vps_id ON nodes(vps_id);
CREATE INDEX IF NOT EXISTS idx_nodes_source_config_id ON nodes(source_config_id);
CREATE INDEX IF NOT EXISTS idx_nodes_protocol ON nodes(protocol);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
CREATE INDEX IF NOT EXISTS idx_nodes_created_by ON nodes(created_by);
CREATE INDEX IF NOT EXISTS idx_nodes_expire_time ON nodes(expire_time);
CREATE INDEX IF NOT EXISTS idx_nodes_deleted_at ON nodes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_nodes_created_at ON nodes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes(name);
CREATE INDEX IF NOT EXISTS idx_nodes_status_deleted ON nodes(status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_nodes_vps_protocol ON nodes(vps_id, protocol);

-- Node permissions indexes
CREATE INDEX IF NOT EXISTS idx_node_permissions_user_id ON node_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_node_permissions_node_id ON node_permissions(node_id);
CREATE INDEX IF NOT EXISTS idx_node_permissions_permission_type ON node_permissions(permission_type);

-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_token ON subscriptions(subscription_token);
CREATE INDEX IF NOT EXISTS idx_subscriptions_is_active ON subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expire_time ON subscriptions(expire_time);

-- Subscription nodes indexes
CREATE INDEX IF NOT EXISTS idx_subscription_nodes_subscription_id ON subscription_nodes(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_nodes_node_id ON subscription_nodes(node_id);
CREATE INDEX IF NOT EXISTS idx_subscription_nodes_sort_order ON subscription_nodes(subscription_id, sort_order);

-- Sync logs indexes
CREATE INDEX IF NOT EXISTS idx_sync_logs_source_config_id ON sync_logs(source_config_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);

-- ============================================
-- Create Triggers
-- ============================================

-- Auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vps_configs_updated_at
    BEFORE UPDATE ON vps_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_node_source_configs_updated_at
    BEFORE UPDATE ON node_source_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nodes_updated_at
    BEFORE UPDATE ON nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-check node expiration status
CREATE OR REPLACE FUNCTION check_node_expiration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expire_time IS NOT NULL AND NEW.expire_time < NOW() THEN
        NEW.status = 'expired';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_node_expiration_trigger
    BEFORE INSERT OR UPDATE ON nodes
    FOR EACH ROW
    EXECUTE FUNCTION check_node_expiration();

-- ============================================
-- Enable Row Level Security
-- ============================================

ALTER TABLE vps_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_source_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- VPS configs policies
CREATE POLICY "Users can view their own VPS configs"
    ON vps_configs FOR SELECT
    USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own VPS configs"
    ON vps_configs FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own VPS configs"
    ON vps_configs FOR UPDATE
    USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own VPS configs"
    ON vps_configs FOR DELETE
    USING (auth.uid() = created_by);

-- Node source configs policies
CREATE POLICY "Users can view their own source configs"
    ON node_source_configs FOR SELECT
    USING (
        auth.uid() = created_by
        OR EXISTS (
            SELECT 1 FROM vps_configs 
            WHERE id = node_source_configs.vps_id 
            AND created_by = auth.uid()
        )
    );

CREATE POLICY "Users can manage their own source configs"
    ON node_source_configs FOR ALL
    USING (auth.uid() = created_by);

-- Nodes policies
CREATE POLICY "Users can view authorized nodes"
    ON nodes FOR SELECT
    USING (
        deleted_at IS NULL AND (
            auth.uid() = created_by
            OR EXISTS (
                SELECT 1 FROM node_permissions 
                WHERE user_id = auth.uid() 
                AND node_id IS NULL 
                AND permission_type IN ('read', 'write', 'manage')
            )
            OR EXISTS (
                SELECT 1 FROM node_permissions 
                WHERE user_id = auth.uid() 
                AND node_id = nodes.id
            )
            OR EXISTS (
                SELECT 1 FROM vps_configs 
                WHERE id = nodes.vps_id 
                AND created_by = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert nodes they have permission for"
    ON nodes FOR INSERT
    WITH CHECK (
        auth.uid() = created_by
        OR EXISTS (
            SELECT 1 FROM node_permissions 
            WHERE user_id = auth.uid() 
            AND (node_id IS NULL OR node_id = nodes.id)
            AND permission_type IN ('write', 'manage')
        )
    );

CREATE POLICY "Users can update authorized nodes"
    ON nodes FOR UPDATE
    USING (
        deleted_at IS NULL AND (
            auth.uid() = created_by
            OR EXISTS (
                SELECT 1 FROM node_permissions 
                WHERE user_id = auth.uid() 
                AND (node_id IS NULL OR node_id = nodes.id)
                AND permission_type IN ('write', 'manage')
            )
        )
    );

CREATE POLICY "Users can delete nodes with manage permission"
    ON nodes FOR DELETE
    USING (
        auth.uid() = created_by
        OR EXISTS (
            SELECT 1 FROM node_permissions 
            WHERE user_id = auth.uid() 
            AND (node_id IS NULL OR node_id = nodes.id)
            AND permission_type = 'manage'
        )
    );

-- Node permissions policies
CREATE POLICY "Users can view permissions for their nodes"
    ON node_permissions FOR SELECT
    USING (
        user_id = auth.uid()
        OR created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM nodes 
            WHERE id = node_permissions.node_id 
            AND created_by = auth.uid()
        )
    );

CREATE POLICY "Users can manage permissions for their nodes"
    ON node_permissions FOR ALL
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM nodes 
            WHERE id = node_permissions.node_id 
            AND created_by = auth.uid()
        )
    );

-- Subscriptions policies
CREATE POLICY "Users can view their own subscriptions"
    ON subscriptions FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own subscriptions"
    ON subscriptions FOR ALL
    USING (user_id = auth.uid());

-- Subscription nodes policies
CREATE POLICY "Users can view their subscription nodes"
    ON subscription_nodes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM subscriptions 
            WHERE id = subscription_nodes.subscription_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their subscription nodes"
    ON subscription_nodes FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM subscriptions 
            WHERE id = subscription_nodes.subscription_id 
            AND user_id = auth.uid()
        )
    );

-- Sync logs policies
CREATE POLICY "Users can view sync logs for their configs"
    ON sync_logs FOR SELECT
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM node_source_configs 
            WHERE id = sync_logs.source_config_id 
            AND created_by = auth.uid()
        )
    );

CREATE POLICY "Users can insert sync logs"
    ON sync_logs FOR INSERT
    WITH CHECK (created_by = auth.uid());

-- ============================================
-- Utility Functions
-- ============================================

-- Generate subscription token
CREATE OR REPLACE FUNCTION generate_subscription_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Soft delete node
CREATE OR REPLACE FUNCTION soft_delete_node(node_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE nodes 
    SET deleted_at = NOW(), status = 'disabled'
    WHERE id = node_uuid AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restore deleted node
CREATE OR REPLACE FUNCTION restore_node(node_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE nodes 
    SET deleted_at = NULL, status = 'enabled'
    WHERE id = node_uuid AND deleted_at IS NOT NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check user node permission
CREATE OR REPLACE FUNCTION check_node_permission(
    p_user_id UUID,
    p_node_id UUID,
    p_permission_type VARCHAR
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM node_permissions
        WHERE user_id = p_user_id
        AND (node_id IS NULL OR node_id = p_node_id)
        AND permission_type = p_permission_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update subscription access count
CREATE OR REPLACE FUNCTION increment_subscription_access(p_token VARCHAR)
RETURNS VOID AS $$
BEGIN
    UPDATE subscriptions
    SET access_count = access_count + 1
    WHERE subscription_token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Views
-- ============================================

-- Node statistics view
CREATE OR REPLACE VIEW node_statistics AS
SELECT 
    vps_id,
    protocol,
    status,
    COUNT(*) as node_count,
    SUM(traffic_up) as total_traffic_up,
    SUM(traffic_down) as total_traffic_down,
    SUM(traffic_total) as total_traffic_limit
FROM nodes
WHERE deleted_at IS NULL
GROUP BY vps_id, protocol, status;

COMMENT ON VIEW node_statistics IS 'Node statistics view';

-- Subscription details view
CREATE OR REPLACE VIEW subscription_details AS
SELECT 
    s.id,
    s.name,
    s.user_id,
    s.subscription_token,
    s.access_count,
    s.expire_time,
    s.is_active,
    COUNT(sn.node_id) as node_count,
    s.created_at,
    s.updated_at
FROM subscriptions s
LEFT JOIN subscription_nodes sn ON s.id = sn.subscription_id
GROUP BY s.id;

COMMENT ON VIEW subscription_details IS 'Subscription details view with node count';
