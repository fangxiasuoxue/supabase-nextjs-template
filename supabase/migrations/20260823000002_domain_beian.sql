-- ============================================================================
-- SDD 54 P4(task B)· 域名模块 P4 数据库增补(两块,均 additive / IF NOT EXISTS,可重跑):
--   ① domain_beian —— Notion 备案(D5 录入 SSOT)在 console 的只读镜像表(供详情页显示)。
--   ② domain_grants —— 分域 RBAC 授权表(mirror docs/current/53 的 access_grants 思路)。
-- 依据:docs/current/54 §8(D5 备案 Notion)、§12 D6;docs/current/53(节点级 RBAC)。
-- 分域 RBAC 为何另起 domain_grants(不复用现有两表):
--   · resource_assignments.resource_id = BIGINT(见 20250103000001_fix_resource_id_type),存不了域名文本;
--   · access_grants.resource_id = uuid NOT NULL(见 20260821000002),存不了域名文本(域名是天然文本主键)。
--   故按 53 同套路(键类型不合就专表)建 domain_grants,以 domain 文本为资源键。
-- 依赖(生产库已存在):函数 public.update_updated_at_column()(复用,见 domain_module 迁移)。
-- 执行:monitor.env 的 SUPABASE_PAT → Management API(.venv/bin/jiedian db -f <file>,自动载 monitor.env)。
-- ============================================================================

-- ---------- ① 备案镜像表(Notion beian DB 的只读镜像;录入 SSOT 在 Notion,D5)----------
CREATE TABLE IF NOT EXISTS domain_beian (
  domain      text        PRIMARY KEY,                 -- 域名(= domain_state.domain 逻辑键;Notion「域名」)
  site_name   text,                                    -- 网站名称(Notion「网站名称」)
  icp_no      text,                                    -- 网站备案号(Notion「网站备案号」,含 -N 后缀,站点级)
  subject     text,                                    -- 备案主体(Notion「备案主体」relation → 主体名)
  updated_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE  domain_beian           IS '备案信息 console 只读镜像;录入 SSOT=Notion beian DB(147d8391…),由 sync_notion_beian.py 上行。见 docs/current/54 §8 D5。';
COMMENT ON COLUMN domain_beian.icp_no    IS '网站备案号(粤ICP备…号-N,站点级,详情页展示)。';
COMMENT ON COLUMN domain_beian.subject   IS '备案主体名(Notion relation「备案主体」解析出的主体页标题)。';

DROP TRIGGER IF EXISTS trg_domain_beian_updated_at ON domain_beian;
CREATE TRIGGER trg_domain_beian_updated_at
  BEFORE UPDATE ON domain_beian
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS:与 domain_state 一致 —— authenticated(仅有 domain 菜单权限者可达)可读;
--   同步脚本走 service_role(绕 RLS)写。分域收紧(仅授权域可见)由应用层/domain_grants 承担(见下)。
ALTER TABLE domain_beian ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS domain_beian_all_authenticated ON domain_beian;
CREATE POLICY domain_beian_all_authenticated
  ON domain_beian FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- ② 分域 RBAC 授权表(mirror access_grants;资源键=域名文本)----------
-- 语义:把某个域名授权给某(非 admin)用户 → 他登录后台域名模块只见/只详被授权的域名。
-- admin 全见(应用层判定,见 domain 页面 checkIsAdmin)。授权/撤销仅 admin(见 /api/v1/admin/domain-assign)。
CREATE TABLE IF NOT EXISTS domain_grants (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain      text        NOT NULL,                    -- 资源键(= domain_state.domain)
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, user_id)
);
COMMENT ON TABLE domain_grants IS '分域 RBAC:域名→用户 授权(mirror docs/current/53 access_grants,资源键为域名文本)。SDD 54 P4。';
CREATE INDEX IF NOT EXISTS idx_domain_grants_user   ON domain_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_domain_grants_domain ON domain_grants(domain);

-- RLS:被授权用户可读自己的授权行(供前端过滤);写/列全部走 service_role(API 层仅 admin,mirror access_grants)。
ALTER TABLE domain_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS domain_grants_select_self ON domain_grants;
CREATE POLICY domain_grants_select_self
  ON domain_grants FOR SELECT TO authenticated USING (user_id = auth.uid());
