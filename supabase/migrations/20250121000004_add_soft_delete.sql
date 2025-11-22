-- Migration: Add soft delete support
-- Adds deleted_at column to resource tables for soft delete functionality

-- Add deleted_at to ip_assets
ALTER TABLE public.ip_assets 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at to ip_allocations
ALTER TABLE public.ip_allocations
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create indexes for performance (to filter out deleted records efficiently)
CREATE INDEX IF NOT EXISTS idx_ip_assets_deleted_at ON public.ip_assets(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ip_allocations_deleted_at ON public.ip_allocations(deleted_at) WHERE deleted_at IS NULL;

-- Add comments
COMMENT ON COLUMN public.ip_assets.deleted_at IS 'Timestamp when this record was soft deleted (NULL = not deleted)';
COMMENT ON COLUMN public.ip_allocations.deleted_at IS 'Timestamp when this record was soft deleted (NULL = not deleted)';

-- Update existing RLS policies to exclude soft-deleted records
-- We need to drop and recreate the policies to add the deleted_at check

-- For ip_assets
DROP POLICY IF EXISTS "Users can view IP assets based on permissions" ON public.ip_assets;
CREATE POLICY "Users can view IP assets based on permissions"
  ON public.ip_assets FOR SELECT
  USING (
    deleted_at IS NULL AND (
      -- Admin can see all
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
      )
      OR
      -- Users with read permission can see all
      EXISTS (
        SELECT 1 FROM public.module_permissions
        WHERE user_id = auth.uid() AND module = 'ip' AND can_read = true
      )
      OR
      -- Users can see their own assets
      owner = auth.uid()
      OR
      -- Users can see assigned assets
      EXISTS (
        SELECT 1 FROM public.resource_assignments
        WHERE resource_type = 'ip_asset' 
        AND resource_id = ip_assets.id 
        AND user_id = auth.uid()
      )
    )
  );

-- For ip_allocations
DROP POLICY IF EXISTS "Users can view IP allocations based on permissions" ON public.ip_allocations;
CREATE POLICY "Users can view IP allocations based on permissions"
  ON public.ip_allocations FOR SELECT
  USING (
    deleted_at IS NULL AND (
      -- Admin can see all
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
      )
      OR
      -- Users with read permission can see all
      EXISTS (
        SELECT 1 FROM public.module_permissions
        WHERE user_id = auth.uid() AND module = 'ip' AND can_read = true
      )
      OR
      -- Users can see their own allocations
      owner = auth.uid()
      OR
      -- Users can see assigned allocations
      EXISTS (
        SELECT 1 FROM public.resource_assignments
        WHERE resource_type = 'ip_allocation' 
        AND resource_id = ip_allocations.id 
        AND user_id = auth.uid()
      )
    )
  );

-- Add policy for soft delete (only owners or managers can soft delete)
CREATE POLICY "Users can soft delete their own IP assets"
  ON public.ip_assets FOR UPDATE
  USING (
    deleted_at IS NULL AND (
      -- Admin can delete all
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
      )
      OR
      -- Owners can soft delete their own
      (owner = auth.uid() AND EXISTS (
        SELECT 1 FROM public.module_permissions
        WHERE user_id = auth.uid() AND module = 'ip' AND can_write = true
      ))
      OR
      -- Managers can soft delete any
      EXISTS (
        SELECT 1 FROM public.module_permissions
        WHERE user_id = auth.uid() AND module = 'ip' AND can_manage = true
      )
    )
  );

CREATE POLICY "Users can soft delete their own IP allocations"
  ON public.ip_allocations FOR UPDATE
  USING (
    deleted_at IS NULL AND (
      -- Admin can delete all
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
      )
      OR
      -- Owners can soft delete their own
      (owner = auth.uid() AND EXISTS (
        SELECT 1 FROM public.module_permissions
        WHERE user_id = auth.uid() AND module = 'ip' AND can_write = true
      ))
      OR
      -- Managers can soft delete any
      EXISTS (
        SELECT 1 FROM public.module_permissions
        WHERE user_id = auth.uid() AND module = 'ip' AND can_manage = true
      )
    )
  );
