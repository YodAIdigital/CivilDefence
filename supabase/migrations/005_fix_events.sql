-- Fix script for community_events migration
-- Run this in Supabase SQL Editor if you encountered errors with 005_add_community_events.sql

-- ============================================================================
-- STEP 1: Drop existing event policies and tables (if they exist)
-- ============================================================================

-- Drop policies on community_events (if they exist)
DROP POLICY IF EXISTS "Members can view community events" ON public.community_events;
DROP POLICY IF EXISTS "Admins can create events" ON public.community_events;
DROP POLICY IF EXISTS "Admins can update events" ON public.community_events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.community_events;

-- Drop policies on event_invites (if they exist)
DROP POLICY IF EXISTS "Admins can view event invites" ON public.event_invites;
DROP POLICY IF EXISTS "Admins can create invites" ON public.event_invites;
DROP POLICY IF EXISTS "Can update invites" ON public.event_invites;
DROP POLICY IF EXISTS "Admins can delete invites" ON public.event_invites;

-- Drop policies on event_rsvps (if they exist)
DROP POLICY IF EXISTS "Members can view event RSVPs" ON public.event_rsvps;
DROP POLICY IF EXISTS "Members can RSVP to events" ON public.event_rsvps;
DROP POLICY IF EXISTS "Members can update own RSVPs" ON public.event_rsvps;
DROP POLICY IF EXISTS "Members can delete own RSVPs" ON public.event_rsvps;

-- Drop new helper functions (these are safe to drop - they're only used by event policies)
DROP FUNCTION IF EXISTS public.is_event_invitee(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_event_admin(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_event_member(UUID, UUID);

-- Drop tables in correct order (children first due to foreign keys)
DROP TABLE IF EXISTS public.event_rsvps;
DROP TABLE IF EXISTS public.event_invites;
DROP TABLE IF EXISTS public.community_events;

-- ============================================================================
-- STEP 2: Create tables
-- ============================================================================

-- Community events table
CREATE TABLE public.community_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    -- Event timing
    start_time TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    all_day BOOLEAN DEFAULT false NOT NULL,
    -- Recurrence
    recurrence_rule TEXT,
    recurrence_end_date TIMESTAMPTZ,
    -- Location
    location_name TEXT,
    location_address TEXT,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    use_meeting_point BOOLEAN DEFAULT false NOT NULL,
    -- Event type
    event_type TEXT DEFAULT 'general' NOT NULL,
    -- Visibility
    visibility TEXT DEFAULT 'all_members' NOT NULL,
    -- Metadata
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_cancelled BOOLEAN DEFAULT false NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    -- Constraints
    CONSTRAINT valid_event_type CHECK (event_type IN ('general', 'training', 'drill', 'meeting', 'social')),
    CONSTRAINT valid_visibility CHECK (visibility IN ('admin_only', 'team_only', 'all_members', 'invite_only')),
    CONSTRAINT valid_duration CHECK (duration_minutes > 0)
);

-- Event invites table
CREATE TABLE public.event_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    external_name TEXT,
    external_email TEXT,
    external_phone TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    invited_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    responded_at TIMESTAMPTZ,
    CONSTRAINT valid_invite_status CHECK (status IN ('pending', 'accepted', 'declined')),
    CONSTRAINT has_invitee CHECK (user_id IS NOT NULL OR external_name IS NOT NULL)
);

-- Event RSVPs table
CREATE TABLE public.event_rsvps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'going' NOT NULL,
    responded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(event_id, user_id),
    CONSTRAINT valid_rsvp_status CHECK (status IN ('going', 'maybe', 'not_going'))
);

-- ============================================================================
-- STEP 3: Create indexes
-- ============================================================================

CREATE INDEX idx_community_events_community ON public.community_events(community_id);
CREATE INDEX idx_community_events_start_time ON public.community_events(start_time);
CREATE INDEX idx_community_events_created_by ON public.community_events(created_by);
CREATE INDEX idx_community_events_type ON public.community_events(event_type);
CREATE INDEX idx_community_events_visibility ON public.community_events(visibility);
CREATE INDEX idx_community_events_active ON public.community_events(community_id, start_time)
    WHERE is_cancelled = false;

CREATE INDEX idx_event_invites_event ON public.event_invites(event_id);
CREATE INDEX idx_event_invites_user ON public.event_invites(user_id);
CREATE INDEX idx_event_invites_status ON public.event_invites(status);

CREATE INDEX idx_event_rsvps_event ON public.event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_user ON public.event_rsvps(user_id);

-- ============================================================================
-- STEP 4: Create trigger
-- ============================================================================

DROP TRIGGER IF EXISTS update_community_events_updated_at ON public.community_events;
CREATE TRIGGER update_community_events_updated_at
    BEFORE UPDATE ON public.community_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 5: Create helper functions
-- ============================================================================

-- Function to check if user is invited to an event
CREATE OR REPLACE FUNCTION public.is_event_invitee(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.event_invites
        WHERE event_id = p_event_id
        AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin of an event's community
CREATE OR REPLACE FUNCTION public.is_event_admin(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_community_id UUID;
BEGIN
    SELECT community_id INTO v_community_id
    FROM public.community_events
    WHERE id = p_event_id;

    IF v_community_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Use existing is_community_admin with correct parameter order (user_uuid, community_uuid)
    RETURN is_community_admin(p_user_id, v_community_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is member of an event's community
CREATE OR REPLACE FUNCTION public.is_event_member(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_community_id UUID;
BEGIN
    SELECT community_id INTO v_community_id
    FROM public.community_events
    WHERE id = p_event_id;

    IF v_community_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Use existing is_community_member with correct parameter order (user_uuid, community_uuid)
    RETURN is_community_member(p_user_id, v_community_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 6: Enable RLS
-- ============================================================================

ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 7: Create RLS policies
-- ============================================================================

-- Events policies
CREATE POLICY "Members can view community events"
    ON public.community_events
    FOR SELECT
    USING (
        is_community_admin(auth.uid(), community_id)
        OR (visibility = 'all_members' AND is_community_member(auth.uid(), community_id))
        OR (visibility = 'invite_only' AND public.is_event_invitee(id, auth.uid()))
    );

CREATE POLICY "Admins can create events"
    ON public.community_events
    FOR INSERT
    WITH CHECK (is_community_admin(auth.uid(), community_id));

CREATE POLICY "Admins can update events"
    ON public.community_events
    FOR UPDATE
    USING (is_community_admin(auth.uid(), community_id));

CREATE POLICY "Admins can delete events"
    ON public.community_events
    FOR DELETE
    USING (is_community_admin(auth.uid(), community_id));

-- Invite policies
CREATE POLICY "Admins can view event invites"
    ON public.event_invites
    FOR SELECT
    USING (public.is_event_admin(event_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Admins can create invites"
    ON public.event_invites
    FOR INSERT
    WITH CHECK (public.is_event_admin(event_id, auth.uid()));

CREATE POLICY "Can update invites"
    ON public.event_invites
    FOR UPDATE
    USING (user_id = auth.uid() OR public.is_event_admin(event_id, auth.uid()));

CREATE POLICY "Admins can delete invites"
    ON public.event_invites
    FOR DELETE
    USING (public.is_event_admin(event_id, auth.uid()));

-- RSVP policies
CREATE POLICY "Members can view event RSVPs"
    ON public.event_rsvps
    FOR SELECT
    USING (public.is_event_member(event_id, auth.uid()));

CREATE POLICY "Members can RSVP to events"
    ON public.event_rsvps
    FOR INSERT
    WITH CHECK (auth.uid() = user_id AND public.is_event_member(event_id, auth.uid()));

CREATE POLICY "Members can update own RSVPs"
    ON public.event_rsvps
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Members can delete own RSVPs"
    ON public.event_rsvps
    FOR DELETE
    USING (auth.uid() = user_id);
