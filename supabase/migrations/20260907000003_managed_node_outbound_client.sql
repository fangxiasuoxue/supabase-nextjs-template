-- SDD64: a managed VLESS :443 landing uses one dedicated internal client credential.
ALTER TABLE public.node_clients
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'user';

ALTER TABLE public.node_clients
  DROP CONSTRAINT IF EXISTS node_clients_purpose_check;
ALTER TABLE public.node_clients
  ADD CONSTRAINT node_clients_purpose_check
  CHECK (purpose IN ('user','outbound_landing'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_node_clients_one_outbound_landing
  ON public.node_clients(node_id)
  WHERE purpose = 'outbound_landing';

CREATE INDEX IF NOT EXISTS idx_node_clients_purpose
  ON public.node_clients(node_id, purpose);

COMMENT ON COLUMN public.node_clients.purpose IS
  'user=customer seat; outbound_landing=internal credential dedicated to managed-node egress, never user-authorized.';
