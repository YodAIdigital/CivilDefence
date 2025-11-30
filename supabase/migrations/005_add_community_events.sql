-- Civil Defence Expo - Community Events Schema
-- Migration: 005_add_community_events
-- Created: 2024-11-30

-- ============================================================================
-- TABLES
-- ============================================================================

-- Community events table
CREATE TABLE public.community_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    -- Event timing
    start_time TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60, -- Duration in minutes
    all_day BOOLEAN DEFAULT false NOT NULL,
    -- Recurrence (null means single event)
    recurrence_rule TEXT, -- iCal RRULE format (e.g., 'FREQ=WEEKLY;BYDAY=MO')
    recurrence_end_date TIMESTAMPTZ,
    -- Location
    location_name TEXT,
    location_address TEXT,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    use_meeting_point BOOLEAN DEFAULT false NOT NULL, -- Use community's meeting point
    -- Event type for categorization and styling
    event_type TEXT DEFAULT 'general' NOT NULL, -- 'general', 'training', 'drill', 'meeting', 'social'
    -- Visibility / Access control
    visibility TEXT DEFAULT 'all_members' NOT NULL, -- 'admin_only', 'team_only', 'all_members', 'invite_only'
    -- Metadata
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_cancelled BOOLEAN DEFAULT false NOT NULL,
    notes TEXT, -- Internal notes for organizers
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    -- Constraints
    CONSTRAINT valid_event_type CHECK (event_type IN ('general', 'training', 'drill', 'meeting', 'social')),
    CONSTRAINT valid_visibility CHECK (visibility IN ('admin_only', 'team_only', 'all_members', 'invite_only')),
    CONSTRAINT valid_duration CHECK (duration_minutes > 0)
);

-- Event invites table (for invite_only events)
CREATE TABLE public.event_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
    -- Either a member or an external invite
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    -- External invite details (when user_id is null)
    external_name TEXT,
    external_email TEXT,
    external_phone TEXT,
    -- Invite status
    status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'accepted', 'declined'
    invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    invited_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    responded_at TIMESTAMPTZ,
    -- Constraints
    CONSTRAINT valid_invite_status CHECK (status IN ('pending', 'accepted', 'declined')),
    CONSTRAINT has_invitee CHECK (user_id IS NOT NULL OR external_name IS NOT NULL)
);

-- Event RSVPs / attendance tracking (for non-invite events)
CREATE TABLE public.event_rsvps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'going' NOT NULL, -- 'going', 'maybe', 'not_going'
    responded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    -- Prevent duplicate RSVPs
    UNIQUE(event_id, user_id),
    CONSTRAINT valid_rsvp_status CHECK (status IN ('going', 'maybe', 'not_going'))
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Events indexes
CREATE INDEX idx_community_events_community ON public.community_events(community_id);
CREATE INDEX idx_community_events_start_time ON public.community_events(start_time);
CREATE INDEX idx_community_events_created_by ON public.community_events(created_by);
CREATE INDEX idx_community_events_type ON public.community_events(event_type);
CREATE INDEX idx_community_events_visibility ON public.community_events(visibility);
CREATE INDEX idx_community_events_active ON public.community_events(community_id, start_time)
    WHERE is_cancelled = false;

-- Invite indexes
CREATE INDEX idx_event_invites_event ON public.event_invites(event_id);
CREATE INDEX idx_event_invites_user ON public.event_invites(user_id);
CREATE INDEX idx_event_invites_status ON public.event_invites(status);

-- RSVP indexes
CREATE INDEX idx_event_rsvps_event ON public.event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_user ON public.event_rsvps(user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE TRIGGER update_community_events_updated_at
    BEFORE UPDATE ON public.community_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS (to avoid RLS recursion)
-- ============================================================================

-- NOTE: is_community_member and is_community_admin are already defined in 002_row_level_security.sql
-- with signature: is_community_member(user_uuid UUID, community_uuid UUID)
-- We keep the same signatures to avoid breaking existing policies.

-- Function to check if user is invited to an event (bypasses RLS)
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

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Events policies
-- Members can view events based on visibility settings
CREATE POLICY "Members can view community events"
    ON public.community_events
    FOR SELECT
    USING (
        -- Admin can see all events
        is_community_admin(auth.uid(), community_id)
        OR
        -- All members visibility
        (
            visibility = 'all_members'
            AND is_community_member(auth.uid(), community_id)
        )
        OR
        -- Invite only - user must be invited
        (
            visibility = 'invite_only'
            AND public.is_event_invitee(id, auth.uid())
        )
    );

-- Community admins can create events
CREATE POLICY "Admins can create events"
    ON public.community_events
    FOR INSERT
    WITH CHECK (
        is_community_admin(auth.uid(), community_id)
    );

-- Community admins can update events
CREATE POLICY "Admins can update events"
    ON public.community_events
    FOR UPDATE
    USING (
        is_community_admin(auth.uid(), community_id)
    );

-- Community admins can delete events
CREATE POLICY "Admins can delete events"
    ON public.community_events
    FOR DELETE
    USING (
        is_community_admin(auth.uid(), community_id)
    );

-- Helper function to check if user is admin of an event's community
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

    -- Use existing function with correct parameter order (user_uuid, community_uuid)
    RETURN is_community_admin(p_user_id, v_community_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is member of an event's community
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

    -- Use existing function with correct parameter order (user_uuid, community_uuid)
    RETURN is_community_member(p_user_id, v_community_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Invite policies
-- Admins can view all invites for their events
CREATE POLICY "Admins can view event invites"
    ON public.event_invites
    FOR SELECT
    USING (
        public.is_event_admin(event_id, auth.uid())
        OR
        user_id = auth.uid()
    );

-- Admins can create invites
CREATE POLICY "Admins can create invites"
    ON public.event_invites
    FOR INSERT
    WITH CHECK (
        public.is_event_admin(event_id, auth.uid())
    );

-- Admins can update invites, users can update their own
CREATE POLICY "Can update invites"
    ON public.event_invites
    FOR UPDATE
    USING (
        user_id = auth.uid()
        OR
        public.is_event_admin(event_id, auth.uid())
    );

-- Admins can delete invites
CREATE POLICY "Admins can delete invites"
    ON public.event_invites
    FOR DELETE
    USING (
        public.is_event_admin(event_id, auth.uid())
    );

-- RSVP policies
-- Members can view RSVPs for events they can see
CREATE POLICY "Members can view event RSVPs"
    ON public.event_rsvps
    FOR SELECT
    USING (
        public.is_event_member(event_id, auth.uid())
    );

-- Members can RSVP to events
CREATE POLICY "Members can RSVP to events"
    ON public.event_rsvps
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND public.is_event_member(event_id, auth.uid())
    );

-- Members can update their own RSVPs
CREATE POLICY "Members can update own RSVPs"
    ON public.event_rsvps
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Members can delete their own RSVPs
CREATE POLICY "Members can delete own RSVPs"
    ON public.event_rsvps
    FOR DELETE
    USING (auth.uid() = user_id);
