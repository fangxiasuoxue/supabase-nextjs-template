-- Migration: orders
-- Description: Create orders table for node resource purchase

CREATE TABLE IF NOT EXISTS orders (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES auth.users(id),
    plan_name   varchar(100) NOT NULL,
    amount      numeric(10,2) NOT NULL DEFAULT 0,
    currency    varchar(10)  NOT NULL DEFAULT 'USD',
    status      varchar(20) NOT NULL DEFAULT 'pending', -- pending, paid, active, suspended, expired, cancelled
    payment_id  varchar(100),                         -- Stripe/external ID
    billing_cycle varchar(20) NOT NULL DEFAULT 'monthly', -- monthly, quarterly, yearly
    expires_at  timestamptz,
    paid_at     timestamptz,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
