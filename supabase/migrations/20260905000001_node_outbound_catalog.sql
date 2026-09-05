-- SDD 64 P0: normalized outbound catalog + per-VPS deployment bindings.
-- Secrets never belong in these tables: store only jms://, bw://, env:// or secret_ref:// references.

CREATE TABLE IF NOT EXISTS public.outbound_sources (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  kind                text NOT NULL CHECK (kind IN ('cheap_ip','subscription','managed_node','manual')),
  provider            text,
  secret_ref          text,
  ip_asset_id         bigint REFERENCES public.ip_assets(id) ON DELETE RESTRICT,
  managed_node_id     uuid REFERENCES public.nodes(id) ON DELETE RESTRICT,
  config              jsonb NOT NULL DEFAULT '{}'::jsonb,
  status              text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','degraded','disabled','error')),
  last_discovered_at  timestamptz,
  last_error           text,
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outbound_sources_secret_ref_check CHECK (
    secret_ref IS NULL OR secret_ref ~ '^(jms|bw|env|secret_ref)://'
  ),
  CONSTRAINT outbound_sources_kind_ref_check CHECK (
    (kind <> 'cheap_ip' OR ip_asset_id IS NOT NULL)
    AND (kind <> 'subscription' OR secret_ref IS NOT NULL)
    AND (kind <> 'managed_node' OR managed_node_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.outbound_source_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id           uuid NOT NULL REFERENCES public.outbound_sources(id) ON DELETE CASCADE,
  external_key        text NOT NULL,
  display_name        text NOT NULL,
  protocol            text NOT NULL,
  region              text,
  server_hint         text,
  port_hint           int CHECK (port_hint IS NULL OR port_hint BETWEEN 1 AND 65535),
  secret_ref          text,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  compatibility       text NOT NULL DEFAULT 'unknown' CHECK (compatibility IN ('supported','unsupported','unknown')),
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','expired','error')),
  observed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, external_key),
  CONSTRAINT outbound_source_items_secret_ref_check CHECK (
    secret_ref IS NULL OR secret_ref ~ '^(jms|bw|env|secret_ref)://'
  )
);

-- A selectable outbound is a concrete endpoint plus an optional transport chain.
-- GoRelay is a transport decorator, not an endpoint type: cheap/node/subscription endpoints
-- can all be reached through direct, gorelay, or a self-hosted transit hop.
CREATE TABLE IF NOT EXISTS public.node_outbounds (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_vps_instance_id   uuid NOT NULL REFERENCES public.vps_instances(id) ON DELETE CASCADE,
  source_id                uuid REFERENCES public.outbound_sources(id) ON DELETE RESTRICT,
  source_item_id           uuid REFERENCES public.outbound_source_items(id) ON DELETE RESTRICT,
  tag                      text NOT NULL,
  display_name             text NOT NULL,
  endpoint_kind            text NOT NULL CHECK (endpoint_kind IN ('cheap_ip','subscription_node','managed_node','direct','blocked','manual')),
  transport_kind           text NOT NULL DEFAULT 'direct' CHECK (transport_kind IN ('direct','gorelay','self_transit')),
  transport_ref            text,
  desired_config           jsonb NOT NULL DEFAULT '{}'::jsonb,
  desired_state            text NOT NULL DEFAULT 'present' CHECK (desired_state IN ('present','absent')),
  deploy_state             text NOT NULL DEFAULT 'draft' CHECK (deploy_state IN ('draft','pending','applying','active','drifted','error','disabled')),
  desired_hash             text,
  observed_hash            text,
  last_applied_at          timestamptz,
  last_observed_at         timestamptz,
  last_error               text,
  created_by               uuid REFERENCES auth.users(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE(target_vps_instance_id, tag),
  CONSTRAINT node_outbounds_tag_check CHECK (tag ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$')
);

CREATE TABLE IF NOT EXISTS public.outbound_apply_runs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_vps_instance_id   uuid NOT NULL REFERENCES public.vps_instances(id) ON DELETE CASCADE,
  requested_by             uuid REFERENCES auth.users(id),
  mode                     text NOT NULL CHECK (mode IN ('plan','apply','rollback','reconcile')),
  status                   text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','succeeded','failed','rolled_back')),
  desired_hash             text,
  observed_hash            text,
  summary                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message            text,
  started_at               timestamptz,
  finished_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.node_clients ADD COLUMN IF NOT EXISTS outbound_id uuid REFERENCES public.node_outbounds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_outbound_sources_kind ON public.outbound_sources(kind, status);
CREATE INDEX IF NOT EXISTS idx_outbound_source_items_source ON public.outbound_source_items(source_id, status);
CREATE INDEX IF NOT EXISTS idx_node_outbounds_target ON public.node_outbounds(target_vps_instance_id, deploy_state);
CREATE INDEX IF NOT EXISTS idx_node_clients_outbound_id ON public.node_clients(outbound_id) WHERE outbound_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outbound_apply_runs_target ON public.outbound_apply_runs(target_vps_instance_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_outbound_sources_updated_at ON public.outbound_sources;
CREATE TRIGGER trg_outbound_sources_updated_at BEFORE UPDATE ON public.outbound_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_outbound_source_items_updated_at ON public.outbound_source_items;
CREATE TRIGGER trg_outbound_source_items_updated_at BEFORE UPDATE ON public.outbound_source_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_node_outbounds_updated_at ON public.node_outbounds;
CREATE TRIGGER trg_node_outbounds_updated_at BEFORE UPDATE ON public.node_outbounds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- All access goes through guarded server APIs using service_role. No direct authenticated policy
-- is intentionally created, preventing subscription credentials/metadata from leaking via PostgREST.
ALTER TABLE public.outbound_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_source_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_outbounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_apply_runs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.outbound_sources IS 'SDD64 outbound asset source; subscription URL and credentials are secret references only.';
COMMENT ON TABLE public.outbound_source_items IS 'Normalized discoverable endpoint metadata; never stores raw share links or credentials.';
COMMENT ON TABLE public.node_outbounds IS 'Concrete selectable Xray outbound desired/observed state scoped to one VPS runtime.';
COMMENT ON COLUMN public.node_outbounds.transport_kind IS 'Transport is compositional: direct, GoRelay accelerated, or self-hosted transit.';
COMMENT ON COLUMN public.node_clients.outbound_id IS 'Normalized outbound binding; outbound_tag remains compatibility mirror during migration.';
