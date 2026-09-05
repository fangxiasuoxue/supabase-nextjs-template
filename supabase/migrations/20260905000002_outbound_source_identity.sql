-- SDD64 P1: one canonical source per first-party asset. Subscription sources remain independently named.
CREATE UNIQUE INDEX IF NOT EXISTS uq_outbound_sources_ip_asset
  ON public.outbound_sources(ip_asset_id) WHERE kind='cheap_ip' AND ip_asset_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_outbound_sources_managed_node
  ON public.outbound_sources(managed_node_id) WHERE kind='managed_node' AND managed_node_id IS NOT NULL;
