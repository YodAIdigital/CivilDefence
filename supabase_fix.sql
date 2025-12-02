-- ====================================
-- SUPABASE FIX SQL
-- This file contains all missing tables and updates
-- Run this in your Supabase SQL Editor
-- ====================================

-- ====================================
-- 1. USER CHECKLISTS TABLE
-- ====================================

CREATE TABLE IF NOT EXISTS user_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id TEXT,
  name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  progress NUMERIC DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_checklists_user_id ON user_checklists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_checklists_template_id ON user_checklists(template_id);

-- Enable RLS
ALTER TABLE user_checklists ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own checklists" ON user_checklists;
DROP POLICY IF EXISTS "Users can create own checklists" ON user_checklists;
DROP POLICY IF EXISTS "Users can update own checklists" ON user_checklists;
DROP POLICY IF EXISTS "Users can delete own checklists" ON user_checklists;

-- RLS Policies
CREATE POLICY "Users can view own checklists"
  ON user_checklists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own checklists"
  ON user_checklists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checklists"
  ON user_checklists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own checklists"
  ON user_checklists FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_checklists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_checklists_updated_at ON user_checklists;
CREATE TRIGGER update_user_checklists_updated_at
  BEFORE UPDATE ON user_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_user_checklists_updated_at();

-- ====================================
-- 2. COMMUNITY ALERT RULES TABLE
-- ====================================

CREATE TABLE IF NOT EXISTS community_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('webhook', 'email')),
  webhook_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  trigger_email TEXT,
  alert_title TEXT NOT NULL,
  alert_message TEXT NOT NULL,
  alert_level TEXT NOT NULL DEFAULT 'info' CHECK (alert_level IN ('info', 'warning', 'danger')),
  recipient_group TEXT NOT NULL DEFAULT 'members' CHECK (recipient_group IN ('admin', 'team', 'members', 'groups', 'specific')),
  specific_member_ids UUID[],
  target_group_ids UUID[],
  send_email BOOLEAN DEFAULT true,
  send_sms BOOLEAN DEFAULT false,
  send_app_notification BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  trigger_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_alert_rules_community_id ON community_alert_rules(community_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_webhook_token ON community_alert_rules(webhook_token);
CREATE INDEX IF NOT EXISTS idx_alert_rules_trigger_email ON community_alert_rules(trigger_email);
CREATE INDEX IF NOT EXISTS idx_alert_rules_is_active ON community_alert_rules(is_active);

-- Enable RLS
ALTER TABLE community_alert_rules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Community admins can view rules" ON community_alert_rules;
DROP POLICY IF EXISTS "Community admins can create rules" ON community_alert_rules;
DROP POLICY IF EXISTS "Community admins can update rules" ON community_alert_rules;
DROP POLICY IF EXISTS "Community admins can delete rules" ON community_alert_rules;

-- RLS Policies
CREATE POLICY "Community admins can view rules"
  ON community_alert_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_alert_rules.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.role IN ('admin', 'super_admin')
    )
    OR EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = community_alert_rules.community_id
        AND communities.created_by = auth.uid()
    )
  );

CREATE POLICY "Community admins can create rules"
  ON community_alert_rules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_alert_rules.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.role IN ('admin', 'super_admin')
    )
    OR EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = community_alert_rules.community_id
        AND communities.created_by = auth.uid()
    )
  );

CREATE POLICY "Community admins can update rules"
  ON community_alert_rules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_alert_rules.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.role IN ('admin', 'super_admin')
    )
    OR EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = community_alert_rules.community_id
        AND communities.created_by = auth.uid()
    )
  );

CREATE POLICY "Community admins can delete rules"
  ON community_alert_rules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_alert_rules.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.role IN ('admin', 'super_admin')
    )
    OR EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = community_alert_rules.community_id
        AND communities.created_by = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_alert_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_alert_rules_updated_at ON community_alert_rules;
CREATE TRIGGER update_alert_rules_updated_at
  BEFORE UPDATE ON community_alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_alert_rules_updated_at();

-- ====================================
-- 3. COMMUNITY GROUPS TABLE
-- ====================================

CREATE TABLE IF NOT EXISTS community_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT DEFAULT 'group',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  member_count INTEGER DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(community_id, name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_community_groups_community_id ON community_groups(community_id);
CREATE INDEX IF NOT EXISTS idx_community_groups_is_active ON community_groups(is_active);
CREATE INDEX IF NOT EXISTS idx_community_groups_display_order ON community_groups(display_order);

-- Enable RLS
ALTER TABLE community_groups ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Community members can view groups" ON community_groups;
DROP POLICY IF EXISTS "Community admins can create groups" ON community_groups;
DROP POLICY IF EXISTS "Community admins can update groups" ON community_groups;
DROP POLICY IF EXISTS "Community admins can delete groups" ON community_groups;

-- RLS Policies
CREATE POLICY "Community members can view groups"
  ON community_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_groups.community_id
        AND community_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Community admins can create groups"
  ON community_groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_groups.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.role IN ('admin', 'super_admin')
    )
    OR EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = community_groups.community_id
        AND communities.created_by = auth.uid()
    )
  );

CREATE POLICY "Community admins can update groups"
  ON community_groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_groups.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.role IN ('admin', 'super_admin')
    )
    OR EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = community_groups.community_id
        AND communities.created_by = auth.uid()
    )
  );

CREATE POLICY "Community admins can delete groups"
  ON community_groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_groups.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.role IN ('admin', 'super_admin')
    )
    OR EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = community_groups.community_id
        AND communities.created_by = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_community_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_community_groups_updated_at ON community_groups;
CREATE TRIGGER update_community_groups_updated_at
  BEFORE UPDATE ON community_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_community_groups_updated_at();

-- ====================================
-- 4. COMMUNITY GROUP MEMBERS TABLE
-- ====================================

CREATE TABLE IF NOT EXISTS community_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON community_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON community_group_members(user_id);

-- Enable RLS
ALTER TABLE community_group_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Community members can view group members" ON community_group_members;
DROP POLICY IF EXISTS "Community admins can add group members" ON community_group_members;
DROP POLICY IF EXISTS "Community admins can remove group members" ON community_group_members;

-- RLS Policies
CREATE POLICY "Community members can view group members"
  ON community_group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_groups cg
      JOIN community_members cm ON cm.community_id = cg.community_id
      WHERE cg.id = community_group_members.group_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Community admins can add group members"
  ON community_group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_groups cg
      JOIN community_members cm ON cm.community_id = cg.community_id
      WHERE cg.id = community_group_members.group_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'super_admin')
    )
    OR EXISTS (
      SELECT 1 FROM community_groups cg
      JOIN communities c ON c.id = cg.community_id
      WHERE cg.id = community_group_members.group_id
        AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Community admins can remove group members"
  ON community_group_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM community_groups cg
      JOIN community_members cm ON cm.community_id = cg.community_id
      WHERE cg.id = community_group_members.group_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'super_admin')
    )
    OR EXISTS (
      SELECT 1 FROM community_groups cg
      JOIN communities c ON c.id = cg.community_id
      WHERE cg.id = community_group_members.group_id
        AND c.created_by = auth.uid()
    )
  );

-- ====================================
-- 5. UPDATE ALERTS TABLE (Add target_group_ids)
-- ====================================

-- Add target_group_ids column to alerts table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'target_group_ids'
  ) THEN
    ALTER TABLE alerts ADD COLUMN target_group_ids UUID[];
    CREATE INDEX idx_alerts_target_group_ids ON alerts USING GIN(target_group_ids);
  END IF;
END $$;

-- ====================================
-- 6. TRIGGER TO UPDATE GROUP MEMBER COUNT
-- ====================================

CREATE OR REPLACE FUNCTION update_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_groups
    SET member_count = member_count + 1
    WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_groups
    SET member_count = GREATEST(0, member_count - 1)
    WHERE id = OLD.group_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_group_member_count_trigger ON community_group_members;
CREATE TRIGGER update_group_member_count_trigger
  AFTER INSERT OR DELETE ON community_group_members
  FOR EACH ROW
  EXECUTE FUNCTION update_group_member_count();

-- ====================================
-- 7. REFRESH MEMBER COUNTS FOR EXISTING GROUPS
-- ====================================

UPDATE community_groups
SET member_count = (
  SELECT COUNT(*)
  FROM community_group_members
  WHERE community_group_members.group_id = community_groups.id
);

-- ====================================
-- COMPLETED!
-- ====================================
-- All tables have been created with proper RLS policies
-- You can now use the app without 406 errors
