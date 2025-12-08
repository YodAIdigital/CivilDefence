-- Emergency Contacts System
-- This migration creates tables for customizable emergency contacts at three levels:
-- 1. Default contacts (system-wide, managed by super_admin)
-- 2. Community contacts (regional, managed by community admins)
-- 3. User contacts (personal, managed by individual users)

-- ==========================================
-- Default Emergency Contacts (system-wide)
-- ==========================================
CREATE TABLE IF NOT EXISTS default_emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact details
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'call',
  category TEXT NOT NULL DEFAULT 'emergency' CHECK (category IN ('emergency', 'health', 'utilities', 'local', 'government')),

  -- Display
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- Whether this can be hidden/customized by communities
  allow_community_override BOOLEAN DEFAULT true,

  -- Audit
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_default_emergency_contacts_category ON default_emergency_contacts(category);
CREATE INDEX IF NOT EXISTS idx_default_emergency_contacts_active ON default_emergency_contacts(is_active);
CREATE INDEX IF NOT EXISTS idx_default_emergency_contacts_order ON default_emergency_contacts(category, display_order);

-- ==========================================
-- Community Emergency Contacts (regional)
-- ==========================================
CREATE TABLE IF NOT EXISTS community_emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  -- Contact details
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'call',
  category TEXT NOT NULL DEFAULT 'local' CHECK (category IN ('emergency', 'health', 'utilities', 'local', 'government', 'community')),

  -- Display
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- Optional: link to default contact if this overrides one
  overrides_default_id UUID REFERENCES default_emergency_contacts(id) ON DELETE SET NULL,

  -- Audit
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_community_emergency_contacts_community ON community_emergency_contacts(community_id);
CREATE INDEX IF NOT EXISTS idx_community_emergency_contacts_category ON community_emergency_contacts(category);
CREATE INDEX IF NOT EXISTS idx_community_emergency_contacts_active ON community_emergency_contacts(community_id, is_active);
CREATE INDEX IF NOT EXISTS idx_community_emergency_contacts_order ON community_emergency_contacts(community_id, category, display_order);

-- ==========================================
-- User Emergency Contacts (personal)
-- Stored in profiles.notification_preferences as they already have utility_companies there
-- This table is for additional personal contacts beyond utilities
-- ==========================================
CREATE TABLE IF NOT EXISTS user_emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Contact details
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'person',
  category TEXT NOT NULL DEFAULT 'personal' CHECK (category IN ('utilities', 'personal', 'medical', 'insurance')),

  -- Display
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_emergency_contacts_user ON user_emergency_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_emergency_contacts_category ON user_emergency_contacts(user_id, category);
CREATE INDEX IF NOT EXISTS idx_user_emergency_contacts_active ON user_emergency_contacts(user_id, is_active);

-- ==========================================
-- Community Hidden Contacts (to track which defaults are hidden)
-- ==========================================
CREATE TABLE IF NOT EXISTS community_hidden_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  default_contact_id UUID NOT NULL REFERENCES default_emergency_contacts(id) ON DELETE CASCADE,

  -- Why it's hidden (optional)
  reason TEXT,

  -- Audit
  hidden_by UUID REFERENCES profiles(id),
  hidden_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique combination
  UNIQUE(community_id, default_contact_id)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_community_hidden_contacts_community ON community_hidden_contacts(community_id);

-- ==========================================
-- Enable RLS
-- ==========================================
ALTER TABLE default_emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_hidden_contacts ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS Policies for default_emergency_contacts
-- ==========================================

-- Everyone can view active default contacts
CREATE POLICY "Anyone can view active default contacts"
  ON default_emergency_contacts
  FOR SELECT
  USING (is_active = true);

-- Super admins can view all (including inactive)
CREATE POLICY "Super admins can view all default contacts"
  ON default_emergency_contacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Only super admins can insert
CREATE POLICY "Super admins can create default contacts"
  ON default_emergency_contacts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Only super admins can update
CREATE POLICY "Super admins can update default contacts"
  ON default_emergency_contacts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Only super admins can delete
CREATE POLICY "Super admins can delete default contacts"
  ON default_emergency_contacts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- ==========================================
-- RLS Policies for community_emergency_contacts
-- ==========================================

-- Community members can view their community's contacts
CREATE POLICY "Community members can view community contacts"
  ON community_emergency_contacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_emergency_contacts.community_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Community admins can insert
CREATE POLICY "Community admins can create community contacts"
  ON community_emergency_contacts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_emergency_contacts.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Community admins can update
CREATE POLICY "Community admins can update community contacts"
  ON community_emergency_contacts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_emergency_contacts.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Community admins can delete
CREATE POLICY "Community admins can delete community contacts"
  ON community_emergency_contacts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_emergency_contacts.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- ==========================================
-- RLS Policies for user_emergency_contacts
-- ==========================================

-- Users can only view their own contacts
CREATE POLICY "Users can view own contacts"
  ON user_emergency_contacts
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own contacts
CREATE POLICY "Users can create own contacts"
  ON user_emergency_contacts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own contacts
CREATE POLICY "Users can update own contacts"
  ON user_emergency_contacts
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own contacts
CREATE POLICY "Users can delete own contacts"
  ON user_emergency_contacts
  FOR DELETE
  USING (user_id = auth.uid());

-- ==========================================
-- RLS Policies for community_hidden_contacts
-- ==========================================

-- Community members can view hidden contacts list
CREATE POLICY "Community members can view hidden contacts"
  ON community_hidden_contacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_hidden_contacts.community_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Community admins can hide/unhide contacts
CREATE POLICY "Community admins can manage hidden contacts"
  ON community_hidden_contacts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_hidden_contacts.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

CREATE POLICY "Community admins can delete hidden contacts"
  ON community_hidden_contacts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_hidden_contacts.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- ==========================================
-- Triggers for updated_at timestamps
-- ==========================================

CREATE TRIGGER update_default_emergency_contacts_updated_at
  BEFORE UPDATE ON default_emergency_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_emergency_contacts_updated_at
  BEFORE UPDATE ON community_emergency_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_emergency_contacts_updated_at
  BEFORE UPDATE ON user_emergency_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- Seed default NZ emergency contacts
-- ==========================================
INSERT INTO default_emergency_contacts (name, phone, description, icon, category, display_order, allow_community_override) VALUES
  -- Emergency Services (category: emergency)
  ('Emergency Services', '111', 'Police, Fire, Ambulance - Life threatening emergencies', 'emergency', 'emergency', 1, false),
  ('Police (Non-urgent)', '105', 'Report non-urgent crimes and incidents', 'local_police', 'emergency', 2, true),
  ('Civil Defence Emergency', '0800 22 22 00', 'National Emergency Management Agency', 'shield', 'emergency', 3, true),

  -- Health Services (category: health)
  ('Healthline', '0800 611 116', '24/7 free health advice from registered nurses', 'health_and_safety', 'health', 1, true),
  ('Poison Control', '0800 764 766', 'National Poisons Centre - 24/7 advice', 'science', 'health', 2, true),
  ('Mental Health Crisis', '1737', 'Free call or text - 24/7 mental health support', 'psychology', 'health', 3, true),
  ('Lifeline', '0800 543 354', '24/7 counselling and support', 'support', 'health', 4, true),

  -- Utilities (category: utilities)
  ('Gas Emergency', '0800 111 323', '24/7 gas emergency line', 'local_fire_department', 'utilities', 1, true),

  -- Information (category: local)
  ('MetService Weather', '0900 999 99', 'Weather forecasts and warnings', 'cloud', 'local', 1, true),
  ('Road Conditions', '0800 44 44 49', 'NZTA road information and updates', 'directions_car', 'local', 2, true)
ON CONFLICT DO NOTHING;

-- ==========================================
-- Comments for documentation
-- ==========================================
COMMENT ON TABLE default_emergency_contacts IS 'System-wide default emergency contacts managed by super admins';
COMMENT ON TABLE community_emergency_contacts IS 'Community-specific emergency contacts (local council, regional services)';
COMMENT ON TABLE user_emergency_contacts IS 'Personal emergency contacts (utilities, medical, insurance)';
COMMENT ON TABLE community_hidden_contacts IS 'Tracks which default contacts are hidden for specific communities';

COMMENT ON COLUMN default_emergency_contacts.allow_community_override IS 'If false, communities cannot hide this contact (e.g., 111 emergency line)';
COMMENT ON COLUMN community_emergency_contacts.overrides_default_id IS 'If set, this contact replaces the default one (e.g., regional power company)';
