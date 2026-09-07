-- Backfill one internal landing credential for every managed VLESS :443 source already in catalog.
INSERT INTO public.node_clients (
  node_id, email, cred_ref, protocol, label, purpose, enabled, subscribe_token, created_by
)
SELECT DISTINCT
  n.id,
  'outbound-landing@node',
  gen_random_uuid()::text,
  'vless',
  '内部专用 · 出口落地 443',
  'outbound_landing',
  true,
  NULL,
  s.created_by
FROM public.outbound_sources s
JOIN public.nodes n ON n.id = s.managed_node_id
WHERE s.kind = 'managed_node'
  AND s.status <> 'disabled'
  AND n.status = 'active'
  AND lower(n.protocol) = 'vless'
  AND n.port = 443
  AND NOT EXISTS (
    SELECT 1 FROM public.node_clients c
    WHERE c.node_id = n.id AND c.purpose = 'outbound_landing'
  );

UPDATE public.outbound_source_items i
SET secret_ref = 'secret_ref://node-clients/' || c.id::text || '/share',
    updated_at = now()
FROM public.outbound_sources s
JOIN public.node_clients c
  ON c.node_id = s.managed_node_id AND c.purpose = 'outbound_landing'
WHERE i.source_id = s.id
  AND s.kind = 'managed_node';

UPDATE public.node_outbounds o
SET desired_config = o.desired_config || jsonb_build_object('source_client_id', c.id),
    updated_at = now()
FROM public.outbound_sources s
JOIN public.node_clients c
  ON c.node_id = s.managed_node_id AND c.purpose = 'outbound_landing'
WHERE o.source_id = s.id
  AND s.kind = 'managed_node';
