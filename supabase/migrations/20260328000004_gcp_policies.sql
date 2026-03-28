-- Migration: gcp_policies
-- Description: Create gcp_instance_policies table for GCP resource constraints

CREATE TABLE IF NOT EXISTS gcp_instance_policies (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_type    varchar(20) NOT NULL DEFAULT 'e2-micro'
                    CHECK (machine_type = 'e2-micro'),
    disk_type       varchar(20) NOT NULL DEFAULT 'pd-standard'
                    CHECK (disk_type = 'pd-standard'),
    max_disk_gb     int         NOT NULL DEFAULT 30
                    CHECK (max_disk_gb <= 30),
    network_tier    varchar(20) NOT NULL DEFAULT 'STANDARD'
                    CHECK (network_tier = 'STANDARD'),
    allowed_regions jsonb       NOT NULL DEFAULT '["us-west1","us-central1","us-east1"]',
    is_active       boolean     NOT NULL DEFAULT true,
    updated_by      uuid        REFERENCES auth.users(id),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Guarantee only one active policy
CREATE UNIQUE INDEX IF NOT EXISTS idx_gcp_instance_policies_active_unique 
ON gcp_instance_policies (is_active) WHERE is_active = true;
