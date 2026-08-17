-- 聚合订阅(bundle):一个 token 对应「所有 status=active 节点」的合集订阅。
-- 公开订阅端点 /sub/bundle/[token] 走 service_role(绕过 RLS)读所有 active 节点的
-- 最新 node_deployments.rendered_config,汇总 share_links → 一个 base64 订阅。
-- 本表只存 token 元数据(极小),不存节点内容。

CREATE TABLE IF NOT EXISTS subscription_bundles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token      text UNIQUE NOT NULL,
  name       text,
  created_at timestamptz DEFAULT now()
);

-- 默认 bundle:若表为空则种一行高熵 token(64 hex chars = 256bit,拼两个 uuid,
-- 不依赖 pgcrypto/gen_random_bytes,任何 Postgres 都能跑)。前端节点页据此展示
-- 聚合订阅 URL / 二维码 / 复制按钮。
INSERT INTO subscription_bundles (token, name)
SELECT
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  '全部活跃节点'
WHERE NOT EXISTS (SELECT 1 FROM subscription_bundles);

-- RLS:登录管理员(authenticated)需要读 token 才能在节点页展示聚合订阅链接;
-- token 非高度敏感(与单节点 subscribe_token 同级,且节点页仅 admin 可达)。
-- service_role(公开订阅端点服务端读)本就绕过 RLS,不受此策略影响。
ALTER TABLE subscription_bundles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscription_bundles_select_authenticated ON subscription_bundles;
CREATE POLICY subscription_bundles_select_authenticated
  ON subscription_bundles FOR SELECT TO authenticated USING (true);
