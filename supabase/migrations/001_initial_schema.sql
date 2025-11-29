-- Civil Defence Expo - Initial Database Schema
-- Migration: 001_initial_schema
-- Created: 2024-11-29

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

-- User roles enum
CREATE TYPE user_role AS ENUM ('public', 'member', 'admin');

-- Alert severity levels
CREATE TYPE alert_level AS ENUM ('info', 'warning', 'danger', 'critical');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Profiles table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role user_role DEFAULT 'member' NOT NULL,
    phone TEXT,
    location TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for email lookups
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Communities table
CREATE TABLE public.communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT true NOT NULL,
    location TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    member_count INTEGER DEFAULT 0 NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for communities
CREATE INDEX idx_communities_name ON public.communities(name);
CREATE INDEX idx_communities_created_by ON public.communities(created_by);
CREATE INDEX idx_communities_is_public ON public.communities(is_public);
CREATE INDEX idx_communities_location ON public.communities USING gin(to_tsvector('english', location));

-- Community members junction table
CREATE TABLE public.community_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role user_role DEFAULT 'member' NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    -- Prevent duplicate memberships
    UNIQUE(community_id, user_id)
);

-- Create indexes for community members
CREATE INDEX idx_community_members_community ON public.community_members(community_id);
CREATE INDEX idx_community_members_user ON public.community_members(user_id);

-- Alerts table
CREATE TABLE public.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    level alert_level DEFAULT 'info' NOT NULL,
    community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT false NOT NULL,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true NOT NULL,
    read_count INTEGER DEFAULT 0 NOT NULL,
    location TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    radius_km DECIMAL(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for alerts
CREATE INDEX idx_alerts_community ON public.alerts(community_id);
CREATE INDEX idx_alerts_author ON public.alerts(author_id);
CREATE INDEX idx_alerts_level ON public.alerts(level);
CREATE INDEX idx_alerts_is_public ON public.alerts(is_public);
CREATE INDEX idx_alerts_is_active ON public.alerts(is_active);
CREATE INDEX idx_alerts_expires_at ON public.alerts(expires_at);
CREATE INDEX idx_alerts_created_at ON public.alerts(created_at DESC);

-- Alert acknowledgments table
CREATE TABLE public.alert_acknowledgments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    acknowledged_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    -- Prevent duplicate acknowledgments
    UNIQUE(alert_id, user_id)
);

-- Create indexes for acknowledgments
CREATE INDEX idx_alert_ack_alert ON public.alert_acknowledgments(alert_id);
CREATE INDEX idx_alert_ack_user ON public.alert_acknowledgments(user_id);

-- Resources table
CREATE TABLE public.resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT false NOT NULL,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    download_count INTEGER DEFAULT 0 NOT NULL,
    tags TEXT[] DEFAULT '{}',
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for resources
CREATE INDEX idx_resources_community ON public.resources(community_id);
CREATE INDEX idx_resources_author ON public.resources(author_id);
CREATE INDEX idx_resources_is_public ON public.resources(is_public);
CREATE INDEX idx_resources_category ON public.resources(category);
CREATE INDEX idx_resources_tags ON public.resources USING gin(tags);
CREATE INDEX idx_resources_title ON public.resources USING gin(to_tsvector('english', title));

-- Checklist templates table
CREATE TABLE public.checklist_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    items JSONB NOT NULL DEFAULT '[]',
    community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT false NOT NULL,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- User checklists (personal copies of templates)
CREATE TABLE public.user_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    progress INTEGER DEFAULT 0 NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for checklists
CREATE INDEX idx_checklist_templates_community ON public.checklist_templates(community_id);
CREATE INDEX idx_checklist_templates_author ON public.checklist_templates(author_id);
CREATE INDEX idx_user_checklists_user ON public.user_checklists(user_id);

-- Activity log for audit trail
CREATE TABLE public.activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for activity log
CREATE INDEX idx_activity_log_user ON public.activity_log(user_id);
CREATE INDEX idx_activity_log_entity ON public.activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_created ON public.activity_log(created_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update community member count
CREATE OR REPLACE FUNCTION update_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.communities
        SET member_count = member_count + 1
        WHERE id = NEW.community_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.communities
        SET member_count = member_count - 1
        WHERE id = OLD.community_id;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to increment alert read count
CREATE OR REPLACE FUNCTION increment_alert_read_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.alerts
    SET read_count = read_count + 1
    WHERE id = NEW.alert_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to increment resource download count
CREATE OR REPLACE FUNCTION increment_download_count(resource_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.resources
    SET download_count = download_count + 1
    WHERE id = resource_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        'member'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamps
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_communities_updated_at
    BEFORE UPDATE ON public.communities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at
    BEFORE UPDATE ON public.alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resources_updated_at
    BEFORE UPDATE ON public.resources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_checklist_templates_updated_at
    BEFORE UPDATE ON public.checklist_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_checklists_updated_at
    BEFORE UPDATE ON public.user_checklists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update community member count
CREATE TRIGGER update_member_count_on_insert
    AFTER INSERT ON public.community_members
    FOR EACH ROW EXECUTE FUNCTION update_community_member_count();

CREATE TRIGGER update_member_count_on_delete
    AFTER DELETE ON public.community_members
    FOR EACH ROW EXECUTE FUNCTION update_community_member_count();

-- Update alert read count on acknowledgment
CREATE TRIGGER update_alert_read_count
    AFTER INSERT ON public.alert_acknowledgments
    FOR EACH ROW EXECUTE FUNCTION increment_alert_read_count();

-- Create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
