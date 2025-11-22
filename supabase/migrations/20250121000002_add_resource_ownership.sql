-- Migration: Add resource ownership tracking
-- Adds owner_id and created_by to resource tables for ownership-based access control

-- Add owner_id and created_by to ip_assets
ALTER TABLE public.ip_assets 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add owner_id and created_by to ip_allocations
ALTER TABLE public.ip_allocations
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ip_assets_owner ON public.ip_assets(owner_id);
CREATE INDEX IF NOT EXISTS idx_ip_assets_created_by ON public.ip_assets(created_by);
CREATE INDEX IF NOT EXISTS idx_ip_allocations_owner ON public.ip_allocations(owner_id);
CREATE INDEX IF NOT EXISTS idx_ip_allocations_created_by ON public.ip_allocations(created_by);

-- Add comments
COMMENT ON COLUMN public.ip_assets.owner_id IS 'User who owns this IP asset';
COMMENT ON COLUMN public.ip_assets.created_by IS 'User who created this IP asset';
COMMENT ON COLUMN public.ip_allocations.owner_id IS 'User who owns this IP allocation';
COMMENT ON COLUMN public.ip_allocations.created_by IS 'User who created this IP allocation';

-- Set owner_id for existing records (set to the user who created them if available, otherwise NULL)
-- This is a one-time migration, new records will have owner_id set automatically
UPDATE public.ip_assets 
SET owner_id = created_by 
WHERE owner_id IS NULL AND created_by IS NOT NULL;

UPDATE public.ip_allocations
SET owner_id = created_by
WHERE owner_id IS NULL AND created_by IS NOT NULL;
