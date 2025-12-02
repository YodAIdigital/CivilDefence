-- Community Alert Rules Migration
-- Allows communities to create rules that trigger alerts from webhooks or emails

-- Create enum for trigger types
DO $$ BEGIN
  CREATE TYPE alert_trigger_type AS ENUM ('webhook', 'email');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create enum for recipient groups (reuse logic from alerts)
-- Already have: 'admin', 'team', 'members', 'specific'

-- Create the community_alert_rules table
CREATE TABLE IF NOT EXISTS community_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  -- Rule identification
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,

  -- Trigger configuration
  trigger_type alert_trigger_type NOT NULL,
  -- For webhooks: unique token/key for authentication
  webhook_token UUID DEFAULT gen_random_uuid(),
  -- For emails: the email address to receive triggers (will be generated)
  trigger_email VARCHAR(255),

  -- Alert configuration (the alert that will be sent when triggered)
  alert_title VARCHAR(255) NOT NULL,
  alert_message TEXT NOT NULL,
  alert_level VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (alert_level IN ('info', 'warning', 'danger')),

  -- Recipient configuration
  recipient_group VARCHAR(20) NOT NULL DEFAULT 'members' CHECK (recipient_group IN ('admin', 'team', 'members', 'specific')),
  -- For 'specific' recipient group, store selected member IDs
  specific_member_ids UUID[] DEFAULT ARRAY[]::UUID[],

  -- Delivery options
  send_email BOOLEAN DEFAULT true,
  send_sms BOOLEAN DEFAULT false,
  send_app_notification BOOLEAN DEFAULT true,

  -- Tracking
  trigger_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,

  -- Audit
  created_by UUID NOT NULL REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_alert_rules_community ON community_alert_rules(community_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_webhook_token ON community_alert_rules(webhook_token) WHERE trigger_type = 'webhook';
CREATE INDEX IF NOT EXISTS idx_alert_rules_trigger_email ON community_alert_rules(trigger_email) WHERE trigger_type = 'email';
CREATE INDEX IF NOT EXISTS idx_alert_rules_active ON community_alert_rules(is_active) WHERE is_active = true;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_alert_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_alert_rules_updated_at ON community_alert_rules;
CREATE TRIGGER trigger_alert_rules_updated_at
  BEFORE UPDATE ON community_alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_alert_rules_updated_at();

-- Create a table to track rule trigger history
CREATE TABLE IF NOT EXISTS alert_rule_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES community_alert_rules(id) ON DELETE CASCADE,
  alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,

  -- Trigger details
  trigger_source VARCHAR(50) NOT NULL, -- 'webhook' or 'email'
  trigger_payload JSONB, -- Store the incoming data for debugging

  -- Status
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  -- Delivery stats
  recipient_count INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  sms_sent INTEGER DEFAULT 0,
  push_sent INTEGER DEFAULT 0,

  -- Audit
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for rule trigger history
CREATE INDEX IF NOT EXISTS idx_rule_triggers_rule ON alert_rule_triggers(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_triggers_triggered_at ON alert_rule_triggers(triggered_at DESC);

-- Enable RLS
ALTER TABLE community_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rule_triggers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for community_alert_rules

-- Admins can read rules for their communities
CREATE POLICY "Community admins can view alert rules"
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

-- Admins can create rules for their communities
CREATE POLICY "Community admins can create alert rules"
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

-- Admins can update rules for their communities
CREATE POLICY "Community admins can update alert rules"
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

-- Admins can delete rules for their communities
CREATE POLICY "Community admins can delete alert rules"
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

-- RLS Policies for alert_rule_triggers

-- Admins can view trigger history for their community's rules
CREATE POLICY "Community admins can view rule triggers"
  ON alert_rule_triggers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_alert_rules
      JOIN community_members ON community_members.community_id = community_alert_rules.community_id
      WHERE community_alert_rules.id = alert_rule_triggers.rule_id
      AND community_members.user_id = auth.uid()
      AND community_members.role IN ('admin', 'super_admin')
    )
    OR EXISTS (
      SELECT 1 FROM community_alert_rules
      JOIN communities ON communities.id = community_alert_rules.community_id
      WHERE community_alert_rules.id = alert_rule_triggers.rule_id
      AND communities.created_by = auth.uid()
    )
  );

-- Service role can insert triggers (for API routes)
-- Note: INSERT is handled by service role in API routes, not through RLS

-- Add comment for documentation
COMMENT ON TABLE community_alert_rules IS 'Stores rules that can trigger alerts from external sources (webhooks or emails)';
COMMENT ON TABLE alert_rule_triggers IS 'Logs each time a rule is triggered for audit and debugging purposes';
COMMENT ON COLUMN community_alert_rules.webhook_token IS 'Unique token used to authenticate webhook requests';
COMMENT ON COLUMN community_alert_rules.trigger_email IS 'Email address that triggers this rule when received';
