-- Migration: pgmq_init
-- Description: Initialize pgmq extension and business queues

-- Ensure the extension is enabled
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create all required business queues
SELECT pgmq.create('provisioning');   -- GCP Instance creation/destruction
SELECT pgmq.create('deployment');     -- Protocol configuration deployment
SELECT pgmq.create('provider');       -- Supplier sync/purchase/speedtest
SELECT pgmq.create('notification');   -- Push notifications
SELECT pgmq.create('billing');        -- Order status/resource freeze
SELECT pgmq.create('agent');          -- Agent commands (if needed)
