-- Migration: Add menu permission to module_permissions table
-- This allows controlling whether users can see menu items and access routes

-- First ensure the module_permissions table exists (in case it wasn't created yet)
CREATE TABLE IF NOT EXISTS public.module_permissions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module IN ('vps','nodes','ip','orders')),
  can_read boolean DEFAULT false,
  can_write boolean DEFAULT false,
  can_manage boolean DEFAULT false,
  UNIQUE(user_id, module)
);

-- Add can_menu column if it doesn't exist
ALTER TABLE public.module_permissions
ADD COLUMN IF NOT EXISTS can_menu BOOLEAN DEFAULT false;

-- Migrate existing data: users with any permission should get menu permission
UPDATE public.module_permissions 
SET can_menu = true
WHERE can_read = true OR can_write = true OR can_manage = true;

COMMENT ON COLUMN public.module_permissions.can_menu IS 'Whether user can see menu item and access module routes';
