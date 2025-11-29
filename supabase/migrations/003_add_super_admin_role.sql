-- Civil Defence Expo - Add Super Admin Role
-- Migration: 003_add_super_admin_role
-- Created: 2024-11-29

-- ============================================================================
-- ADD SUPER_ADMIN TO USER_ROLE ENUM
-- ============================================================================

-- Add the super_admin value to the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- ============================================================================
-- UPDATE RLS HELPER FUNCTIONS
-- ============================================================================

-- Update is_admin function to include super_admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_uuid AND (role = 'admin' OR role = 'super_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create is_super_admin function
CREATE OR REPLACE FUNCTION is_super_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_uuid AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE RLS POLICIES FOR SUPER ADMIN
-- ============================================================================

-- Super admins can update any profile's role
CREATE POLICY "Super admins can update any profile role"
    ON public.profiles FOR UPDATE
    USING (is_super_admin(auth.uid()));

-- Super admins can delete any community
CREATE POLICY "Super admins can delete any community"
    ON public.communities FOR DELETE
    USING (is_super_admin(auth.uid()));

-- Super admins can manage all community members
CREATE POLICY "Super admins can manage all community members"
    ON public.community_members FOR ALL
    USING (is_super_admin(auth.uid()));
