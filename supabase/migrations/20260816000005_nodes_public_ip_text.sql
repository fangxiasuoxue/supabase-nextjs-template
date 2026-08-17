-- nodes.public_ip 从 inet 改为 text,以便存储【落地域名】(如 usN.ibfvps.dpdns.org)或 IP。
-- poller(B阶段)用 public_ip 作为分享链接的 host;域名比 e2-micro 的临时 IP 稳定。
-- 现有 inet 值(IP)按 ::text 无损转换。
ALTER TABLE nodes ALTER COLUMN public_ip TYPE text USING public_ip::text;
