-- ============================================================================
-- ✅ 已在生产库 vvgdwqvuxzcwkhoeavle 执行(2026-08-23)。SDD 54:domain_state 补 status 列。
-- ----------------------------------------------------------------------------
-- 背景:provider 适配器(阿里云,列归属 expires_at/status)写 domain_state.status
--   (active/expiring/expired/hold),但初版建表(20260822000001)漏了该列 → PGRST204。
--   status 属域名运行态(SDD 54 §3 domain.status),归 provider 适配器所有。
-- 幂等:ADD COLUMN IF NOT EXISTS,可安全重跑。
-- ============================================================================
ALTER TABLE domain_state ADD COLUMN IF NOT EXISTS status text;
COMMENT ON COLUMN domain_state.status IS
  '域名运行态:active/expiring(30d内)/expired/hold;由 provider 适配器按到期日推。SDD 54 §3。';
