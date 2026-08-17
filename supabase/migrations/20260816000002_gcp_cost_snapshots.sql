-- GCP cost snapshots table for BigQuery billing export data
-- Created: 2026-08-16
-- Purpose: Store monthly cost data per billing account from BQ billing export

CREATE TABLE IF NOT EXISTS public.gcp_cost_snapshots (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_name TEXT NOT NULL,
    billing_account_id TEXT NOT NULL,
    period TEXT NOT NULL,  -- YYYYMM format (invoice.month)
    total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    regular_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    credit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying latest snapshot per account
CREATE INDEX IF NOT EXISTS idx_gcp_cost_snapshots_account_period
    ON public.gcp_cost_snapshots(account_name, period DESC);

-- RLS
ALTER TABLE public.gcp_cost_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage cost snapshots"
    ON public.gcp_cost_snapshots FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Comment
COMMENT ON TABLE public.gcp_cost_snapshots IS 'GCP billing cost snapshots from BigQuery billing export. Populated by gcp_cost monitoring check.';
