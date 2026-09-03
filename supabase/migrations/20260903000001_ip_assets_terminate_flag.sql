-- IP 资产:到期后终止使用开关。
-- false(默认)=本周期后继续续用/续费; true=本周期到期后不再续费、停用。
ALTER TABLE public.ip_assets
  ADD COLUMN IF NOT EXISTS terminate_at_period_end boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ip_assets_terminate_at_period_end
  ON public.ip_assets(terminate_at_period_end)
  WHERE terminate_at_period_end = true;

COMMENT ON COLUMN public.ip_assets.terminate_at_period_end IS '到期后终止使用: true=本周期结束后不再续费/续用; false=默认继续续用';
