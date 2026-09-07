-- SDD65 P0: allow an explicitly selected managed VPS to appear as an IP asset.
ALTER TABLE public.ip_assets
  ADD COLUMN IF NOT EXISTS origin_kind text,
  ADD COLUMN IF NOT EXISTS vps_instance_id uuid REFERENCES public.vps_instances(id) ON DELETE SET NULL;

ALTER TABLE public.ip_assets
  DROP CONSTRAINT IF EXISTS ip_assets_origin_kind_check;
ALTER TABLE public.ip_assets
  ADD CONSTRAINT ip_assets_origin_kind_check
  CHECK (origin_kind IS NULL OR origin_kind IN ('external_proxy','managed_vps','manual'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_assets_vps_origin_unique
  ON public.ip_assets(vps_instance_id)
  WHERE origin_kind = 'managed_vps' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ip_assets_vps_instance_id
  ON public.ip_assets(vps_instance_id)
  WHERE vps_instance_id IS NOT NULL;

COMMENT ON COLUMN public.ip_assets.origin_kind IS 'Management-only origin category; never expose to ordinary assignees.';
COMMENT ON COLUMN public.ip_assets.vps_instance_id IS 'Managed VPS source for an explicitly imported IP asset.';
