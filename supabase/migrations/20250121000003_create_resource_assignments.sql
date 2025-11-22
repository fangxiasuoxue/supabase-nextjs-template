-- Migration: Create resource_assignments table
-- Tracks which resources are assigned to which users for fine-grained access control

-- Create resource_assignments table
CREATE TABLE IF NOT EXISTS public.resource_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL, -- 'ip_asset', 'ip_allocation', 'vps', 'node', etc.
  resource_id UUID NOT NULL,   -- ID of the actual resource
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(resource_type, resource_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_resource_assignments_user ON public.resource_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_resource_assignments_resource ON public.resource_assignments(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_assignments_type ON public.resource_assignments(resource_type);

-- Add comments
COMMENT ON TABLE public.resource_assignments IS 'Tracks resource assignments to users for fine-grained access control';
COMMENT ON COLUMN public.resource_assignments.resource_type IS 'Type of resource (ip_asset, vps, etc.)';
COMMENT ON COLUMN public.resource_assignments.resource_id IS 'ID of the actual resource';
COMMENT ON COLUMN public.resource_assignments.user_id IS 'User who has been assigned this resource';
COMMENT ON COLUMN public.resource_assignments.assigned_by IS 'User who made the assignment';

-- Enable RLS
ALTER TABLE public.resource_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own assignments
CREATE POLICY "Users can view their assignments"
  ON public.resource_assignments FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Admins can view all assignments
CREATE POLICY "Admins can view all assignments"
  ON public.resource_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policy: Users with manage permission can create assignments
CREATE POLICY "Managers can create assignments"
  ON public.resource_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.module_permissions
      WHERE user_id = auth.uid() 
      AND module = resource_type 
      AND can_manage = true
    )
  );

-- RLS Policy: Users with manage permission can delete assignments
CREATE POLICY "Managers can delete assignments"
  ON public.resource_assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.module_permissions
      WHERE user_id = auth.uid() 
      AND module = resource_type 
      AND can_manage = true
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_resource_assignments_updated_at
  BEFORE UPDATE ON public.resource_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
