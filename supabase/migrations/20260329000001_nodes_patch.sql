-- Migration: nodes_patch
-- Description: Patch missing fields identified in CCB-04 vs 06_database_design comparison
-- Date: 2026-03-29
-- Covers: nodes, node_profiles, node_deployments, orders

-- ============================================================
-- 1. nodes 表补全（P0 必须字段）
-- ============================================================

-- protocol: 节点协议类型，与 xray inbound protocol 对应
ALTER TABLE nodes
    ADD COLUMN IF NOT EXISTS protocol varchar(20) NOT NULL DEFAULT 'vless'
        CHECK (protocol IN ('vless', 'vmess', 'trojan', 'socks', 'http'));

-- inbound_tag: xray inbound tag，用于与 jiedian-agent 配置关联
ALTER TABLE nodes
    ADD COLUMN IF NOT EXISTS inbound_tag varchar(80);

-- subscribe_token: 订阅链接 token（无需登录访问），P1 订阅链接生成必须
ALTER TABLE nodes
    ADD COLUMN IF NOT EXISTS subscribe_token varchar(120);

-- outbound_strategy: 出口 IP 策略
ALTER TABLE nodes
    ADD COLUMN IF NOT EXISTS outbound_strategy varchar(50) NOT NULL DEFAULT 'fixed'
        CHECK (outbound_strategy IN ('fixed', 'weighted', 'failover'));

-- public_ip: 冗余存节点公网 IP（来自 vps_instances），避免频繁 JOIN
ALTER TABLE nodes
    ADD COLUMN IF NOT EXISTS public_ip inet;

-- order_id: 关联订单（P1 允许 NULL，待 orders 表就绪后逻辑关联）
ALTER TABLE nodes
    ADD COLUMN IF NOT EXISTS order_id uuid;

-- subscribe_token 唯一索引（单独建，支持 IF NOT EXISTS）
CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_subscribe_token
    ON nodes (subscribe_token)
    WHERE subscribe_token IS NOT NULL;

-- status 补充 'expired' 和 'deleted' 状态（原只有 provisioning/active/draining/error）
-- PostgreSQL 不支持直接 ALTER CHECK，需要先 DROP 再 ADD
ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_status_check;
ALTER TABLE nodes
    ADD CONSTRAINT nodes_status_check
        CHECK (status IN ('provisioning', 'active', 'draining', 'suspended', 'expired', 'deleted', 'error'));

-- ============================================================
-- 2. node_profiles 表补全
-- ============================================================

-- transport_protocol: inbound 层协议，与 config_template 中内容对应
ALTER TABLE node_profiles
    ADD COLUMN IF NOT EXISTS transport_protocol varchar(20) NOT NULL DEFAULT 'vless'
        CHECK (transport_protocol IN ('vless', 'vmess', 'trojan', 'socks', 'http'));

-- inbound_port: 默认监听端口（可被 nodes.port 覆盖）
ALTER TABLE node_profiles
    ADD COLUMN IF NOT EXISTS inbound_port int
        CHECK (inbound_port BETWEEN 1 AND 65535);

-- enabled: 软禁用模板
ALTER TABLE node_profiles
    ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;

-- created_by: 记录创建人
ALTER TABLE node_profiles
    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- engine CHECK 约束（原来是 varchar(50) 无约束）
ALTER TABLE node_profiles DROP CONSTRAINT IF EXISTS node_profiles_engine_check;
ALTER TABLE node_profiles
    ADD CONSTRAINT node_profiles_engine_check
        CHECK (engine IN ('xray', 'sing-box', 'gost'));

-- ============================================================
-- 3. node_deployments 表补全
-- ============================================================

-- profile_id: 记录本次部署使用的协议模板快照引用
ALTER TABLE node_deployments
    ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES node_profiles(id);

-- deploy_mode: 下发方式
ALTER TABLE node_deployments
    ADD COLUMN IF NOT EXISTS deploy_mode varchar(20) NOT NULL DEFAULT 'agent_api'
        CHECK (deploy_mode IN ('agent_api', 'panel_api'));

-- rendered_config: 实际下发的配置快照（与 request_payload 分开，request_payload 存原始请求）
ALTER TABLE node_deployments
    ADD COLUMN IF NOT EXISTS rendered_config jsonb;

-- config_hash: 配置内容哈希，用于幂等和版本对比
ALTER TABLE node_deployments
    ADD COLUMN IF NOT EXISTS config_hash varchar(64);

-- rollback_version: 回滚时指向的历史部署 id
ALTER TABLE node_deployments
    ADD COLUMN IF NOT EXISTS rollback_to_id uuid REFERENCES node_deployments(id);

-- scheduled_at: 任务计划执行时间（区别于 created_at）
ALTER TABLE node_deployments
    ADD COLUMN IF NOT EXISTS scheduled_at timestamptz NOT NULL DEFAULT now();

-- started_at / finished_at: 执行时间记录
ALTER TABLE node_deployments
    ADD COLUMN IF NOT EXISTS started_at timestamptz;

ALTER TABLE node_deployments
    ADD COLUMN IF NOT EXISTS finished_at timestamptz;

-- status 补充 rollback_success / rollback_failed
ALTER TABLE node_deployments DROP CONSTRAINT IF EXISTS node_deployments_status_check;
ALTER TABLE node_deployments
    ADD CONSTRAINT node_deployments_status_check
        CHECK (status IN ('pending', 'processing', 'success', 'fail',
                          'rollback', 'rollback_success', 'rollback_failed'));

-- task_type 增加约束
ALTER TABLE node_deployments DROP CONSTRAINT IF EXISTS node_deployments_task_type_check;
ALTER TABLE node_deployments
    ADD CONSTRAINT node_deployments_task_type_check
        CHECK (task_type IN ('create', 'update', 'rotate-ip', 'delete', 'restart', 'rollback'));

-- ============================================================
-- 4. orders 表补全
-- ============================================================

-- order_no: 对外展示的订单号，唯一
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS order_no varchar(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_no
    ON orders (order_no)
    WHERE order_no IS NOT NULL;

-- 自动生成 order_no 的触发器
CREATE OR REPLACE FUNCTION generate_order_no()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.order_no IS NULL OR NEW.order_no = '' THEN
        NEW.order_no := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' ||
                        upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_order_no ON orders;
CREATE TRIGGER trg_orders_order_no
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION generate_order_no();

-- order_type: 订单类型
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS order_type varchar(20) NOT NULL DEFAULT 'new'
        CHECK (order_type IN ('new', 'renew', 'upgrade'));

-- started_at: 服务开始时间
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- note: 备注
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS note text;

-- amount 精度从 numeric(10,2) → 无需 ALTER（已够用，不修改避免锁表风险）
-- status 补充 'allocating'
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders
    ADD CONSTRAINT orders_status_check
        CHECK (status IN ('pending', 'paid', 'allocating', 'active', 'suspended', 'expired', 'cancelled'));

-- ============================================================
-- 5. vps_instances 补全心跳相关字段
-- ============================================================

ALTER TABLE vps_instances
    ADD COLUMN IF NOT EXISTS provider varchar(20) NOT NULL DEFAULT 'gcp'
        CHECK (provider IN ('gcp', 'aliyun', 'aws', 'manual')),
    ADD COLUMN IF NOT EXISTS runtime_stack varchar(50) DEFAULT 'xray',
    ADD COLUMN IF NOT EXISTS heartbeat_status varchar(20) NOT NULL DEFAULT 'unknown'
        CHECK (heartbeat_status IN ('online', 'offline', 'degraded', 'unknown')),
    ADD COLUMN IF NOT EXISTS agent_version varchar(50),
    ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
    ADD COLUMN IF NOT EXISTS public_ip inet,
    ADD COLUMN IF NOT EXISTS zone varchar(32),
    ADD COLUMN IF NOT EXISTS region varchar(20),
    ADD COLUMN IF NOT EXISTS machine_type varchar(20) DEFAULT 'e2-micro',
    ADD COLUMN IF NOT EXISTS disk_type varchar(20) DEFAULT 'pd-standard',
    ADD COLUMN IF NOT EXISTS disk_size_gb int DEFAULT 30,
    ADD COLUMN IF NOT EXISTS network_tier varchar(20) DEFAULT 'STANDARD',
    ADD COLUMN IF NOT EXISTS gcp_project_id varchar(120),
    ADD COLUMN IF NOT EXISTS gcp_instance_name varchar(120);

CREATE INDEX IF NOT EXISTS idx_vps_heartbeat
    ON vps_instances (heartbeat_status, last_heartbeat_at);

-- ============================================================
-- 6. gcp_instance_policies 补全：插入默认策略
-- ============================================================

INSERT INTO gcp_instance_policies DEFAULT VALUES
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. resource_bindings 表（规划中有，迁移中缺失）
-- ============================================================

CREATE TABLE IF NOT EXISTS resource_bindings (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    uuid        NOT NULL REFERENCES orders(id),
    bind_type   varchar(20) NOT NULL
                CHECK (bind_type IN ('vps_instance', 'node', 'ip_asset', 'gcp_instance')),
    resource_id uuid        NOT NULL,
    status      varchar(20) NOT NULL DEFAULT 'binding'
                CHECK (status IN ('binding', 'active', 'released')),
    bound_at    timestamptz NOT NULL DEFAULT now(),
    released_at timestamptz
);

-- 同一资源不能被同时激活绑定两次
CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_bindings_active
    ON resource_bindings (bind_type, resource_id)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_resource_bindings_order
    ON resource_bindings (order_id);

-- ============================================================
-- 完成
-- ============================================================
