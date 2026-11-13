-- console-v2 R-012 / agent-v1 R-002(2026-11-13):socks5 公网落地模板 + socks 席位。
-- 1) node_clients.protocol 词表加 'socks'(席位凭据 cred_ref = "user:pass",与 lib/clients/node-client-admin.ts 同一份词表)。
ALTER TABLE node_clients DROP CONSTRAINT IF EXISTS node_clients_protocol_check;
ALTER TABLE node_clients
  ADD CONSTRAINT node_clients_protocol_check CHECK (protocol IN ('vless','vmess','trojan','ss','socks'));

-- 2) 公网 socks5 模板(listen 0.0.0.0、密码认证、UDP;默认端口 2080,同机占用时 console 自动 +1)。幂等。
INSERT INTO node_profiles (name, engine, transport_protocol, inbound_port, enabled, config_template)
SELECT 'SOCKS5 · 公网落地 · 随机账密', 'xray', 'socks', 2080, true,
       '{"protocol":"socks","listen":"0.0.0.0","auth":"password","udp":true,"credential_mode":"random"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM node_profiles WHERE name = 'SOCKS5 · 公网落地 · 随机账密');

-- 3) 旧回环模板改名标明用途(transit 安全通道的本机口),不删不停用。
UPDATE node_profiles
   SET name = 'SOCKS5 · 仅本机回环(transit 安全通道用,非公网)'
 WHERE id = 'b6734551-c161-4c22-ae09-ab1910e30301' AND name = 'SOCKS5 · 安全通道专用';
