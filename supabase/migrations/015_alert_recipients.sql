-- Migration: Add alert_recipients table for targeted alert delivery
-- This table tracks which users should see which alerts based on recipient group filtering

-- Create alert_recipients table
CREATE TABLE IF NOT EXISTS alert_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(alert_id, user_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_alert_recipients_alert_id ON alert_recipients(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_recipients_user_id ON alert_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_recipients_user_unread ON alert_recipients(user_id, read_at) WHERE read_at IS NULL;

-- Enable RLS
ALTER TABLE alert_recipients ENABLE ROW LEVEL SECURITY;

-- Users can see their own alert recipients
CREATE POLICY "Users can view their own alert recipients"
  ON alert_recipients
  FOR SELECT
  USING (auth.uid() = user_id);

-- Community admins can insert alert recipients
CREATE POLICY "Admins can insert alert recipients"
  ON alert_recipients
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM alerts a
      JOIN community_members cm ON cm.community_id = a.community_id
      WHERE a.id = alert_recipients.alert_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'super_admin')
    )
  );

-- Users can update their own recipients (mark as read)
CREATE POLICY "Users can update their own alert recipients"
  ON alert_recipients
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Enable realtime for alert_recipients
ALTER PUBLICATION supabase_realtime ADD TABLE alert_recipients;

-- Add comments
COMMENT ON TABLE alert_recipients IS 'Tracks which users should receive which alerts for targeted delivery';
COMMENT ON COLUMN alert_recipients.read_at IS 'When the user read/acknowledged this alert';
