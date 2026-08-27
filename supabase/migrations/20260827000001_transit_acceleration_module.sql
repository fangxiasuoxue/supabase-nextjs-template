-- ============================================================================
-- ✅ 已在生产库 vvgdwqvuxzcwkhoeavle 执行(2026-08-27,Management API /database/query,
--    验证:transit_channel 12列/transit_agg_point 10列/transit_agg_landing 10列/transit_tunnel 12列/
--    transit_binding 11列 + 5 表 RLS 全启用)。SDD 60 P0。
--    ⚠️ api.supabase.com 在 Cloudflare 后,curl 须带非默认 User-Agent(否则 403 CF 1010,同 GoRelay 坑)。
-- ----------------------------------------------------------------------------
-- 设计依据:docs/current/60-transit-acceleration-console-module-sdd.md(jiedian 仓库)。
--   模块 transit(中转加速),与 node / domain 模块并列。把「gw→跨境中转→(聚合)→落地」
--   这套 2026-08 已在生产手工验证的编排(runbook 2026-08-26-gorelay-new-platform-poc-us8
--   §P-A..P-J)固化成控制面声明式模型 + 编排引擎。
-- 分工(承 50 三存 / 59 SDD §10-§11):
--   · 中转「通道」(GoRelay 入口线路 / 自建 HK-VPS / CN2-GIA)= 可插拔供给 → transit_channel。
--   · 聚合点(GCP-US VPS 用 socks5 用户名选路扇出 N cheap)→ transit_agg_point + transit_agg_landing。
--   · GoRelay 隧道(listen_port pin + forward_addresses[] + load_balance)→ transit_tunnel(gorelay_tunnel_id 为现网权威主键)。
--   · gw 消费口(免认证 LAN socks,passwall2 node)→ transit_binding(期望态;gw 无 jiedian-agent,
--     应用靠生成 uci 脚本外部执行,见 SDD 60 §编排边界)。
--   · 落地 reality 参数不复制(承 nodes/node_deployments);cheap 账密现网权威 = ip_assets(不复制明文,存 label 引用)。
-- 幂等:全 IF NOT EXISTS / DROP ... IF EXISTS,可安全重跑。
-- 依赖(生产库已存在):public.update_updated_at_column()、vps_instances、nodes、ip_assets、user_roles。
-- 铁律:凭据不入本库明文(cheap 账密 → ip_assets 引用;agg 用户口令 → 引用 or 单独密管)。
-- ============================================================================

-- ---------- 表 1:中转通道(可插拔跨境供给)----------
CREATE TABLE IF NOT EXISTS transit_channel (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL,                        -- 人读名,如「通道1·Lv3广东电信联通×40」
  provider         varchar(20) NOT NULL DEFAULT 'gorelay',      -- gorelay / self-hk / cn2gia(L2 供给类型)
  in_node_group_id int,                                         -- provider=gorelay:入口线路 id(/node/group/summary 实拉);自建为 null
  traffic_rate     int,                                         -- 倍率(gorelay 计费=流量×倍率);自建 null
  level            varchar(8),                                  -- Lv1/Lv2/Lv3(质量档;非专线不可用)
  region_from      text,                                        -- 入口地(广东/福建/…)
  region_to        text,                                        -- 出口地(香港/…)
  status           varchar(12) NOT NULL DEFAULT 'active',       -- active / inactive
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transit_channel_provider_chk CHECK (provider IN ('gorelay','self-hk','cn2gia')),
  CONSTRAINT transit_channel_status_chk   CHECK (status IN ('active','inactive'))
);
COMMENT ON TABLE  transit_channel                  IS '跨境中转「通道」(L2 可插拔供给:GoRelay 线路/自建 HK-VPS/CN2-GIA)。现网线路目录权威=GoRelay /node/group/summary,本表登声明。见 SDD 60 §数据模型 + 59 §11.3。';
COMMENT ON COLUMN transit_channel.in_node_group_id IS 'GoRelay 入口线路 id(倍率≈质量:Lv1 专线 3ms / Lv3 21ms / 非专线不可用);实拉为准勿写死。';
COMMENT ON COLUMN transit_channel.provider         IS 'L2 供给类型;三者与 L4 落地解耦、可并跑对照(59 §11.3),收敛靠数据。';

-- ---------- 表 2:聚合点(GCP-US VPS,socks5 用户名选路扇出 N cheap)----------
CREATE TABLE IF NOT EXISTS transit_agg_point (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vps_instance_id  uuid        NOT NULL,                        -- → vps_instances(承载聚合 xray 的机器)
  region           varchar(12),                                -- west / central / east(就近 cheap + 冗余)
  listen_port      int         NOT NULL DEFAULT 3900,           -- 聚合 socks5 入站口(0.0.0.0,GoRelay forward 到此;需门禁)
  inbound_tag      varchar(40) NOT NULL DEFAULT 'cheap-agg',    -- xray 入站 tag
  status           varchar(12) NOT NULL DEFAULT 'active',       -- active / inactive
  note             text,
  last_deployed_at timestamptz,                                 -- 上次 syncAggPoint 下发时间
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transit_agg_point_status_chk CHECK (status IN ('active','inactive')),
  CONSTRAINT transit_agg_point_uniq       UNIQUE (vps_instance_id, listen_port)
);
COMMENT ON TABLE  transit_agg_point IS '聚合点:一台 GCP-US VPS 的 xray 用 socks5(用户名=IP选择器)扇出到 N 个 cheap 出站,把 GoRelay 隧道从「每 IP 一条」塌缩成「每通道一条」。见 59 §11.2 + runbook §P-J。';
COMMENT ON COLUMN transit_agg_point.listen_port IS '聚合入站 0.0.0.0:port 对外可达 → 强口令必需,生产宜加源IP白名单/GCP防火墙收窄。';

-- ---------- 表 3:聚合落地映射(agg 用户 → cheap 出站;每行=一个 cheap IP 的选路)----------
CREATE TABLE IF NOT EXISTS transit_agg_landing (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agg_point_id     uuid        NOT NULL,                        -- → transit_agg_point
  ip_asset_label   text        NOT NULL,                        -- → ip_assets.label(如 US05;账密/端点现网权威在 ip_assets)
  agg_user         varchar(40) NOT NULL,                        -- 聚合 socks5 用户名(gw 消费口用它选此 IP)
  agg_pass_ref     text,                                        -- 用户口令引用(不入明文;env:// 或密管键)
  outbound_tag     varchar(40) NOT NULL,                        -- xray 出站 tag,如 cheap-us05
  route_tag        varchar(40) NOT NULL,                        -- xray routing ruleTag(★必需才随 persist 落盘,见 runbook §P-I)
  status           varchar(12) NOT NULL DEFAULT 'active',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transit_agg_landing_status_chk CHECK (status IN ('active','inactive')),
  CONSTRAINT transit_agg_landing_uniq       UNIQUE (agg_point_id, agg_user)
);
COMMENT ON TABLE  transit_agg_landing IS '聚合点内一个 cheap 落地的选路(agg_user→cheap 出站)。三聚合点应共享同一组 agg_user/口令,GoRelay 对多聚合点负载均衡时透明(runbook §P-J)。';
COMMENT ON COLUMN transit_agg_landing.route_tag IS 'xray routing ruleTag;★POST /xray/routing/ruleset 必带 ruleTag 才存 store 并随 persist 落盘,否则重启丢选路(runbook §P-I 根因)。';

-- ---------- 表 4:GoRelay 隧道(现网权威主键=gorelay_tunnel_id;对账>记忆)----------
CREATE TABLE IF NOT EXISTS transit_tunnel (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id        uuid        NOT NULL,                       -- → transit_channel(入口线路)
  gorelay_tunnel_id bigint,                                     -- GoRelay 侧 tunnel id(现网权威;对账用)
  name              text,                                       -- GoRelay tunnel name(如 cheap-agg-3way-ch1)
  listen_port       int         NOT NULL,                       -- pin 的本地口(gw 客户端在 127.0.0.1 开;passwall2 node 目标)
  mode              varchar(12) NOT NULL DEFAULT 'direct',      -- direct(→单落地) / aggregated(→聚合点组)
  forward_spec      jsonb       NOT NULL DEFAULT '[]'::jsonb,   -- direct:[{address}];aggregated:[agg_point 地址:3900,...]
  load_balance_type varchar(8)  NOT NULL DEFAULT 'round',       -- round/rand/fifo/hash/ll/lc(多 forward 时)
  status            varchar(12) NOT NULL DEFAULT 'active',      -- active / inactive
  last_synced_at    timestamptz,                                -- 上次与 GoRelay 现网对账时间
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transit_tunnel_mode_chk   CHECK (mode IN ('direct','aggregated')),
  CONSTRAINT transit_tunnel_status_chk CHECK (status IN ('active','inactive'))
);
COMMENT ON TABLE  transit_tunnel                   IS 'GoRelay 隧道声明;现网权威=GoRelay /tunnel(gorelay_tunnel_id),编排引擎对账 desired↔现网,漂移告警(59 §7 对账>记忆)。';
COMMENT ON COLUMN transit_tunnel.forward_spec      IS 'aggregated:forward_addresses=[聚合点:3900...]+load_balance(1隧道扇出N cheap);direct:单落地地址。POST /tunnel 新 schema 必填 load_balance_type/ip_type/ip_limit/max_clients/bandwidth_limit(runbook §P-B)。';
CREATE INDEX IF NOT EXISTS idx_transit_tunnel_grid ON transit_tunnel(gorelay_tunnel_id) WHERE gorelay_tunnel_id IS NOT NULL;

-- ---------- 表 5:gw 消费口(免认证 LAN socks 期望态;gw 无 agent,应用靠生成 uci 外部执行)----------
CREATE TABLE IF NOT EXISTS transit_binding (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gw               varchar(16) NOT NULL,                        -- 网关标识:gw-01/gw-02/gw-03
  consume_port     int         NOT NULL,                        -- 免认证 LAN socks 消费口(如 9350;两层端口模型见 59 §10.2)
  tunnel_id        uuid        NOT NULL,                        -- → transit_tunnel(node 目标=127.0.0.1:tunnel.listen_port)
  landing_kind     varchar(12) NOT NULL,                        -- reality(us/hk/id) / cheap-direct / cheap-agg
  landing_ref      text,                                        -- reality:node id;cheap-direct:ip_asset label;cheap-agg:同 label
  agg_user         varchar(40),                                 -- cheap-agg:选此 cheap 的聚合用户名(=transit_agg_landing.agg_user)
  node_name        varchar(40),                                 -- passwall2 node section 名(如 us1gr/cheap05/agg05)
  status           varchar(12) NOT NULL DEFAULT 'active',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transit_binding_kind_chk   CHECK (landing_kind IN ('reality','cheap-direct','cheap-agg')),
  CONSTRAINT transit_binding_status_chk CHECK (status IN ('active','inactive')),
  CONSTRAINT transit_binding_uniq       UNIQUE (gw, consume_port)
);
COMMENT ON TABLE  transit_binding                IS 'gw passwall2 消费口期望态(免认证 LAN socks,AdsPower 直填 gw_ip:port 零账密)。gw 无 jiedian-agent → 编排产出 uci 脚本供外部应用(SDD 60 §编排边界)。';
COMMENT ON COLUMN transit_binding.landing_kind   IS 'reality=vless-reality node→隧道口;cheap-direct=socks+账密(内部持有)→隧道口;cheap-agg=socks+agg_user→聚合隧道口。';

-- ---------- updated_at 触发器(每表)----------
DROP TRIGGER IF EXISTS trg_transit_channel_updated_at     ON transit_channel;
CREATE TRIGGER trg_transit_channel_updated_at     BEFORE UPDATE ON transit_channel     FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_transit_agg_point_updated_at   ON transit_agg_point;
CREATE TRIGGER trg_transit_agg_point_updated_at   BEFORE UPDATE ON transit_agg_point   FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_transit_agg_landing_updated_at ON transit_agg_landing;
CREATE TRIGGER trg_transit_agg_landing_updated_at BEFORE UPDATE ON transit_agg_landing FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_transit_tunnel_updated_at      ON transit_tunnel;
CREATE TRIGGER trg_transit_tunnel_updated_at      BEFORE UPDATE ON transit_tunnel      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_transit_binding_updated_at     ON transit_binding;
CREATE TRIGGER trg_transit_binding_updated_at     BEFORE UPDATE ON transit_binding     FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- RLS(后台仅 admin 可达;采集/编排走 service_role 绕 RLS)----------
ALTER TABLE transit_channel     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transit_agg_point   ENABLE ROW LEVEL SECURITY;
ALTER TABLE transit_agg_landing ENABLE ROW LEVEL SECURITY;
ALTER TABLE transit_tunnel      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transit_binding     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transit_channel_all_authenticated     ON transit_channel;
CREATE POLICY transit_channel_all_authenticated     ON transit_channel     FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS transit_agg_point_all_authenticated   ON transit_agg_point;
CREATE POLICY transit_agg_point_all_authenticated   ON transit_agg_point   FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS transit_agg_landing_all_authenticated ON transit_agg_landing;
CREATE POLICY transit_agg_landing_all_authenticated ON transit_agg_landing FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS transit_tunnel_all_authenticated      ON transit_tunnel;
CREATE POLICY transit_tunnel_all_authenticated      ON transit_tunnel      FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS transit_binding_all_authenticated     ON transit_binding;
CREATE POLICY transit_binding_all_authenticated     ON transit_binding     FOR ALL TO authenticated USING (true) WITH CHECK (true);
