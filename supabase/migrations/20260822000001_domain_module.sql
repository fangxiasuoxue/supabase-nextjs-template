-- ============================================================================
-- ✅ 已在生产库 vvgdwqvuxzcwkhoeavle 执行(2026-08-22,Management API /database/query,验证通过:
--    domain_state 9列 + dns_record 15列 + RLS 启用 + updated_at 触发器)。SDD 54 P0。
-- ----------------------------------------------------------------------------
-- 设计依据：docs/current/54-domain-asset-and-dns-record-management-sdd.md §5（P0 数据模型）。
--   模块 domain（域名管理），与 node 模块并列。本文件建两表：域名运行态 + 关键解析记录。
-- 分工（承 docs/current/50 三存）：
--   · 结构（注册商账号/属主/注册人邮箱/托管/到期）→ YAML `domains.registrars/portfolio`（不在此）。
--   · 备案 / Squarespace 等无 API 信息 → Notion（D5，不进本库）。
--   · 高频动态 = 域名运行态 + **仅关键**解析记录期望态 → 本库两表。
-- D2：dns_record **只登关键记录**（NS/MX/根A/52 号发布依赖/SPF/DKIM…）；海量/杂项不入库，
--   由 domain_drift 只读对账时对垃圾/孤儿抽“清理建议”让人裁（§7）。
--   解析记录**现网权威 = provider（CF/阿里云 API）**；本库 desired=期望态，observed_*=上次实测镜像。
-- 依赖（生产库已存在）：函数 public.update_updated_at_column()（复用，见 node_clients 迁移）。
--   无 FK：portfolio 结构在 YAML，故 domain 以 text 逻辑键关联，不引 console 表。
-- 幂等：全 IF NOT EXISTS / DROP ... IF EXISTS，可安全重跑。
-- 执行方式（批准后）：monitor.env 的 SUPABASE_PAT → Management API
--   POST /v1/projects/{ref}/database/query（DB 直连密码不可用；curl 发送，勿用默认 UA）。
--   批准落地：校正时间戳 → git mv 到 apps/console/supabase/migrations/。
-- ============================================================================

-- ---------- 表 1：域名运行态镜像（采集/对账写；结构指针在 YAML）----------
CREATE TABLE IF NOT EXISTS domain_state (
  domain              text        PRIMARY KEY,                 -- 域名本身（天然唯一键）
  observed_ns         text[],                                  -- 现网权威 NS（对账 dns_hosting 是否迁移半途）
  nxdomain            boolean     NOT NULL DEFAULT false,      -- ★ 失联哨兵（thinkcloud 同类：注册局撤委派）
  expires_at          date,                                    -- 实测/权威到期（YAML 声明 expires 的镜像/校验）
  days_to_expiry      int,                                     -- 倒计时（喂 expiry_audit 告警，doc 49 §2.3）
  registrant_verified boolean,                                 -- ★ ICANN 注册人邮箱验证状态（thinkcloud 教训）
  last_checked        timestamptz,                             -- 上次巡检时间
  note                text,                                    -- 采集/对账备注（人工 note 在 YAML portfolio）
  updated_at          timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE  domain_state                     IS '域名运行态镜像（现网实测）；结构 SSOT 在 assets.yaml domains.portfolio。见 docs/current/54 §5。';
COMMENT ON COLUMN domain_state.nxdomain            IS '现网解析为 NXDOMAIN=失联（域过期/被 ClientHold/撤委派）；domain_drift 红告警。';
COMMENT ON COLUMN domain_state.registrant_verified IS 'ICANN 注册人邮箱验证；false/超期即告警——thinkcloud.info 正因此被暂停。';

CREATE INDEX IF NOT EXISTS idx_domain_state_expiry   ON domain_state(days_to_expiry) WHERE days_to_expiry IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_domain_state_nxdomain ON domain_state(domain)         WHERE nxdomain;

DROP TRIGGER IF EXISTS trg_domain_state_updated_at ON domain_state;
CREATE TRIGGER trg_domain_state_updated_at
  BEFORE UPDATE ON domain_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 表 2：关键解析记录（D2 只登关键；期望态 + 实测镜像）----------
CREATE TABLE IF NOT EXISTS dns_record (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain         text        NOT NULL,                         -- 所属域（= domain_state.domain 逻辑键）
  type           varchar(10) NOT NULL,                         -- A/AAAA/CNAME/MX/TXT/NS/SRV/CAA/...
  name           text        NOT NULL,                         -- 记录名（@ 表示根；(domain,type,name) 逻辑分组）
  value          text        NOT NULL,                         -- 记录值/目标
  ttl            int,                                          -- TTL（null=auto）
  priority       int,                                          -- MX/SRV 优先级
  proxied        boolean,                                      -- CF 橙云代理（仅 cloudflare 托管有意义）
  is_key         boolean     NOT NULL DEFAULT true,            -- D2：仅关键记录入库（此处恒 true）
  desired        boolean     NOT NULL DEFAULT true,            -- 期望态：我们希望它存在（false=期望删除）
  observed_value text,                                         -- 上次从 provider 读到的现网值（对账用）
  observed_at    timestamptz,                                  -- 上次实测时间
  managed_by     varchar(30),                                  -- console / manual / 52-publish / cf-ddns
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dns_record_uniq   UNIQUE (domain, type, name, value),
  CONSTRAINT dns_record_type_check CHECK (type IN
    ('A','AAAA','CNAME','MX','TXT','NS','SRV','CAA','PTR','SOA','ALIAS'))
);
COMMENT ON TABLE  dns_record            IS '关键解析记录期望态（D2 只登关键）；现网权威=provider（CF/阿里云 API）。改解析走 47 变更事务→适配器 push。见 docs/current/54 §5-§7。';
COMMENT ON COLUMN dns_record.is_key     IS 'D2：只关键记录入库（NS/MX/根A/52发布/SPF/DKIM…）；海量杂项不入库，domain_drift 出清理建议。';
COMMENT ON COLUMN dns_record.desired    IS '期望态；与 observed_value 不一致=漂移，domain_drift 报（不自动写，改走 47）。';

CREATE INDEX IF NOT EXISTS idx_dns_record_domain ON dns_record(domain);
CREATE INDEX IF NOT EXISTS idx_dns_record_drift  ON dns_record(domain)
  WHERE observed_value IS DISTINCT FROM value;

DROP TRIGGER IF EXISTS trg_dns_record_updated_at ON dns_record;
CREATE TRIGGER trg_dns_record_updated_at
  BEFORE UPDATE ON dns_record
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- RLS：与 node 模块一致——后台管理员（authenticated，仅 admin 可达）全权；
--   采集/对账/agent-facing 写走 service_role（绕 RLS）。分域 RBAC（53，resource_assignments）留 P4。
-- ----------------------------------------------------------------------------
ALTER TABLE domain_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE dns_record   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS domain_state_all_authenticated ON domain_state;
CREATE POLICY domain_state_all_authenticated
  ON domain_state FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS dns_record_all_authenticated ON dns_record;
CREATE POLICY dns_record_all_authenticated
  ON dns_record FOR ALL TO authenticated USING (true) WITH CHECK (true);
