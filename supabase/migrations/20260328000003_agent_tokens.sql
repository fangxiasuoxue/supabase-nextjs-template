-- Migration: agent_tokens
-- Description: Create agent_tokens table for VPS Agent authentication

CREATE TABLE IF NOT EXISTS agent_tokens (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id uuid        NOT NULL REFERENCES vps_instances(id),
    token_hash  varchar(64) NOT NULL,    -- SHA256(raw_token)
    status      varchar(20) NOT NULL DEFAULT 'active',
    issued_at   timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz,
    revoked_at  timestamptz
);

-- Ensure only one active token per instance
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_tokens_unique_active_instance 
ON agent_tokens (instance_id) WHERE status = 'active';
