-- Civil Defence Expo - Row Level Security Policies
-- Migration: 002_row_level_security
-- Created: 2024-11-29

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Check if user is an admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_uuid AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is a community admin
CREATE OR REPLACE FUNCTION is_community_admin(user_uuid UUID, community_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.community_members
        WHERE user_id = user_uuid
        AND community_id = community_uuid
        AND role = 'admin'
    ) OR EXISTS (
        SELECT 1 FROM public.communities
        WHERE id = community_uuid
        AND created_by = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is a community member
CREATE OR REPLACE FUNCTION is_community_member(user_uuid UUID, community_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.community_members
        WHERE user_id = user_uuid
        AND community_id = community_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

-- Users can view all profiles (public info)
CREATE POLICY "Profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
    ON public.profiles FOR UPDATE
    USING (is_admin(auth.uid()));

-- Users can delete their own profile
CREATE POLICY "Users can delete own profile"
    ON public.profiles FOR DELETE
    USING (auth.uid() = id);

-- ============================================================================
-- COMMUNITIES POLICIES
-- ============================================================================

-- Public communities are viewable by everyone, private only by members
CREATE POLICY "Public communities are viewable by everyone"
    ON public.communities FOR SELECT
    USING (
        is_public = true
        OR created_by = auth.uid()
        OR is_community_member(auth.uid(), id)
        OR is_admin(auth.uid())
    );

-- Authenticated users can create communities
CREATE POLICY "Authenticated users can create communities"
    ON public.communities FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

-- Community creators and admins can update their communities
CREATE POLICY "Community admins can update communities"
    ON public.communities FOR UPDATE
    USING (
        created_by = auth.uid()
        OR is_community_admin(auth.uid(), id)
        OR is_admin(auth.uid())
    );

-- Only community creators and admins can delete communities
CREATE POLICY "Community creators can delete communities"
    ON public.communities FOR DELETE
    USING (
        created_by = auth.uid()
        OR is_admin(auth.uid())
    );

-- ============================================================================
-- COMMUNITY MEMBERS POLICIES
-- ============================================================================

-- Members can view memberships of communities they belong to
CREATE POLICY "Members can view community memberships"
    ON public.community_members FOR SELECT
    USING (
        user_id = auth.uid()
        OR is_community_member(auth.uid(), community_id)
        OR is_admin(auth.uid())
    );

-- Users can join public communities
CREATE POLICY "Users can join public communities"
    ON public.community_members FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND (
            EXISTS (
                SELECT 1 FROM public.communities
                WHERE id = community_id AND is_public = true
            )
            OR is_admin(auth.uid())
        )
    );

-- Community admins can add members
CREATE POLICY "Community admins can add members"
    ON public.community_members FOR INSERT
    WITH CHECK (
        is_community_admin(auth.uid(), community_id)
        OR is_admin(auth.uid())
    );

-- Users can leave communities (delete their own membership)
CREATE POLICY "Users can leave communities"
    ON public.community_members FOR DELETE
    USING (
        user_id = auth.uid()
        OR is_community_admin(auth.uid(), community_id)
        OR is_admin(auth.uid())
    );

-- Community admins can update member roles
CREATE POLICY "Community admins can update member roles"
    ON public.community_members FOR UPDATE
    USING (
        is_community_admin(auth.uid(), community_id)
        OR is_admin(auth.uid())
    );

-- ============================================================================
-- ALERTS POLICIES
-- ============================================================================

-- Public alerts are viewable by everyone, community alerts by members
CREATE POLICY "Alerts are viewable based on access"
    ON public.alerts FOR SELECT
    USING (
        is_public = true
        OR author_id = auth.uid()
        OR (community_id IS NOT NULL AND is_community_member(auth.uid(), community_id))
        OR is_admin(auth.uid())
    );

-- Community admins and app admins can create alerts
CREATE POLICY "Authorized users can create alerts"
    ON public.alerts FOR INSERT
    WITH CHECK (
        auth.uid() = author_id
        AND (
            -- Public alerts require admin role
            (is_public = true AND is_admin(auth.uid()))
            -- Community alerts require community admin role
            OR (community_id IS NOT NULL AND is_community_admin(auth.uid(), community_id))
            -- App admins can create any alert
            OR is_admin(auth.uid())
        )
    );

-- Alert authors and admins can update alerts
CREATE POLICY "Alert authors can update alerts"
    ON public.alerts FOR UPDATE
    USING (
        author_id = auth.uid()
        OR (community_id IS NOT NULL AND is_community_admin(auth.uid(), community_id))
        OR is_admin(auth.uid())
    );

-- Alert authors and admins can delete alerts
CREATE POLICY "Alert authors can delete alerts"
    ON public.alerts FOR DELETE
    USING (
        author_id = auth.uid()
        OR (community_id IS NOT NULL AND is_community_admin(auth.uid(), community_id))
        OR is_admin(auth.uid())
    );

-- ============================================================================
-- ALERT ACKNOWLEDGMENTS POLICIES
-- ============================================================================

-- Users can view their own acknowledgments
CREATE POLICY "Users can view own acknowledgments"
    ON public.alert_acknowledgments FOR SELECT
    USING (
        user_id = auth.uid()
        OR is_admin(auth.uid())
    );

-- Users can acknowledge alerts they can view
CREATE POLICY "Users can acknowledge viewable alerts"
    ON public.alert_acknowledgments FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.alerts
            WHERE id = alert_id
            AND (
                is_public = true
                OR (community_id IS NOT NULL AND is_community_member(auth.uid(), community_id))
            )
        )
    );

-- ============================================================================
-- RESOURCES POLICIES
-- ============================================================================

-- Public resources are viewable by everyone, community resources by members
CREATE POLICY "Resources are viewable based on access"
    ON public.resources FOR SELECT
    USING (
        is_public = true
        OR author_id = auth.uid()
        OR (community_id IS NOT NULL AND is_community_member(auth.uid(), community_id))
        OR is_admin(auth.uid())
    );

-- Authenticated users can upload resources
CREATE POLICY "Authenticated users can create resources"
    ON public.resources FOR INSERT
    WITH CHECK (
        auth.uid() = author_id
        AND (
            -- Public resources require admin
            (is_public = true AND is_admin(auth.uid()))
            -- Community resources require membership
            OR (community_id IS NOT NULL AND is_community_member(auth.uid(), community_id))
            -- No community = personal resource
            OR (community_id IS NULL AND is_public = false)
        )
    );

-- Resource authors and admins can update
CREATE POLICY "Resource authors can update resources"
    ON public.resources FOR UPDATE
    USING (
        author_id = auth.uid()
        OR (community_id IS NOT NULL AND is_community_admin(auth.uid(), community_id))
        OR is_admin(auth.uid())
    );

-- Resource authors and admins can delete
CREATE POLICY "Resource authors can delete resources"
    ON public.resources FOR DELETE
    USING (
        author_id = auth.uid()
        OR (community_id IS NOT NULL AND is_community_admin(auth.uid(), community_id))
        OR is_admin(auth.uid())
    );

-- ============================================================================
-- CHECKLIST TEMPLATES POLICIES
-- ============================================================================

-- Public templates viewable by all, community templates by members
CREATE POLICY "Checklist templates viewable based on access"
    ON public.checklist_templates FOR SELECT
    USING (
        is_public = true
        OR author_id = auth.uid()
        OR (community_id IS NOT NULL AND is_community_member(auth.uid(), community_id))
        OR is_admin(auth.uid())
    );

-- Authors can create templates
CREATE POLICY "Users can create checklist templates"
    ON public.checklist_templates FOR INSERT
    WITH CHECK (
        auth.uid() = author_id
        AND (
            (is_public = true AND is_admin(auth.uid()))
            OR (community_id IS NOT NULL AND is_community_member(auth.uid(), community_id))
            OR (community_id IS NULL AND is_public = false)
        )
    );

-- Authors and admins can update templates
CREATE POLICY "Template authors can update templates"
    ON public.checklist_templates FOR UPDATE
    USING (
        author_id = auth.uid()
        OR (community_id IS NOT NULL AND is_community_admin(auth.uid(), community_id))
        OR is_admin(auth.uid())
    );

-- Authors and admins can delete templates
CREATE POLICY "Template authors can delete templates"
    ON public.checklist_templates FOR DELETE
    USING (
        author_id = auth.uid()
        OR (community_id IS NOT NULL AND is_community_admin(auth.uid(), community_id))
        OR is_admin(auth.uid())
    );

-- ============================================================================
-- USER CHECKLISTS POLICIES
-- ============================================================================

-- Users can only view their own checklists
CREATE POLICY "Users can view own checklists"
    ON public.user_checklists FOR SELECT
    USING (user_id = auth.uid() OR is_admin(auth.uid()));

-- Users can create their own checklists
CREATE POLICY "Users can create own checklists"
    ON public.user_checklists FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own checklists
CREATE POLICY "Users can update own checklists"
    ON public.user_checklists FOR UPDATE
    USING (user_id = auth.uid());

-- Users can delete their own checklists
CREATE POLICY "Users can delete own checklists"
    ON public.user_checklists FOR DELETE
    USING (user_id = auth.uid());

-- ============================================================================
-- ACTIVITY LOG POLICIES
-- ============================================================================

-- Users can view their own activity, admins can view all
CREATE POLICY "Users can view own activity"
    ON public.activity_log FOR SELECT
    USING (
        user_id = auth.uid()
        OR is_admin(auth.uid())
    );

-- System can insert activity logs (using service role)
CREATE POLICY "Service role can insert activity"
    ON public.activity_log FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- STORAGE BUCKET POLICIES (for Supabase Storage)
-- ============================================================================

-- Note: These policies should be created in the Supabase dashboard
-- or via the storage API. Here are the recommended policies:

/*
-- Bucket: avatars
-- Policy: Users can upload their own avatar
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
    'Avatar upload policy',
    'avatars',
    $${
        "operation": "INSERT",
        "definition": {
            "expression": "(auth.uid() = storage.objects.owner)"
        }
    }$$
);

-- Bucket: resources
-- Policy: Community members can upload resources
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
    'Resource upload policy',
    'resources',
    $${
        "operation": "INSERT",
        "definition": {
            "expression": "(auth.role() = 'authenticated')"
        }
    }$$
);

-- Bucket: community-images
-- Policy: Community admins can upload images
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
    'Community image upload policy',
    'community-images',
    $${
        "operation": "INSERT",
        "definition": {
            "expression": "(auth.role() = 'authenticated')"
        }
    }$$
);
*/
