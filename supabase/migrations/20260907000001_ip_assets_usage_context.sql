-- IP 资产使用登记（仅管理侧展示）。
-- 用于记录自建/网关/AdsPower 等已投入使用的业务占用，例如 "AdsPower 4002/9202"。
-- 不作为普通用户展示字段，避免向用户暴露底层供应渠道或内部实现。
ALTER TABLE public.ip_assets
  ADD COLUMN IF NOT EXISTS usage_context text;

COMMENT ON COLUMN public.ip_assets.usage_context IS '管理侧使用登记/业务占用说明;不在普通用户视图展示';
