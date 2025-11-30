-- Migration: Add community alerts system
-- Allows admins to send alerts to community members via app and email

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  level VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'danger', 'critical')),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  read_count INTEGER DEFAULT 0,
  location VARCHAR(255),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  radius_km DECIMAL(10, 2),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create alert_acknowledgments table for tracking who has read/dismissed alerts
CREATE TABLE IF NOT EXISTS alert_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(alert_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_alerts_community_id ON alerts(community_id);
CREATE INDEX IF NOT EXISTS idx_alerts_author_id ON alerts(author_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_active ON alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_alerts_level ON alerts(level);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_acknowledgments_alert_id ON alert_acknowledgments(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_acknowledgments_user_id ON alert_acknowledgments(user_id);

-- Enable RLS
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_acknowledgments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for alerts

-- Anyone can read active alerts for communities they belong to
CREATE POLICY "Users can read alerts for their communities"
  ON alerts FOR SELECT
  USING (
    is_active = true AND (
      is_public = true OR
      community_id IN (
        SELECT community_id FROM community_members WHERE user_id = auth.uid()
      )
    )
  );

-- Only admins can create alerts
CREATE POLICY "Admins can create alerts"
  ON alerts FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = alerts.community_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Admins can update their own community's alerts
CREATE POLICY "Admins can update alerts"
  ON alerts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = alerts.community_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Admins can delete alerts
CREATE POLICY "Admins can delete alerts"
  ON alerts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = alerts.community_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for alert_acknowledgments

-- Users can read their own acknowledgments
CREATE POLICY "Users can read own acknowledgments"
  ON alert_acknowledgments FOR SELECT
  USING (user_id = auth.uid());

-- Users can create their own acknowledgments
CREATE POLICY "Users can create own acknowledgments"
  ON alert_acknowledgments FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Add comments for documentation
COMMENT ON TABLE alerts IS 'Community alerts sent by admins to members';
COMMENT ON COLUMN alerts.level IS 'Alert severity: info (green), warning (amber), danger (red), critical (red pulsing)';
COMMENT ON COLUMN alerts.is_public IS 'If true, visible to all users, not just community members';
COMMENT ON COLUMN alerts.is_active IS 'If false, alert is hidden/archived';
COMMENT ON TABLE alert_acknowledgments IS 'Tracks which users have acknowledged/dismissed alerts';
