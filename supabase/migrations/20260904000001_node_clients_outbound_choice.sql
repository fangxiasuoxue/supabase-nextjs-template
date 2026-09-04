-- node_clients 增加 per-client outbound 选择。
-- 产品语义:在 clients 管理页给某个 client 选择/填写 outbound_tag,console 负责保存期望态;
-- 可应用时下发 agent routing: inboundTag + user(email) -> outboundTag。
ALTER TABLE public.node_clients
  ADD COLUMN IF NOT EXISTS outbound_tag text,
  ADD COLUMN IF NOT EXISTS outbound_config jsonb;

CREATE INDEX IF NOT EXISTS idx_node_clients_outbound_tag
  ON public.node_clients(node_id, outbound_tag)
  WHERE outbound_tag IS NOT NULL;

COMMENT ON COLUMN public.node_clients.outbound_tag IS '该 client 指定出口 outbound tag;agent routing 用 user(email) 绑定到该 outbound';
COMMENT ON COLUMN public.node_clients.outbound_config IS '可选 outbound 配置草案/元数据,避免凭记忆配置;敏感字段不得前端外露';
