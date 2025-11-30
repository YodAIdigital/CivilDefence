-- Migration: Add delivery tracking fields to alerts table
-- Tracks how alerts were sent and to how many recipients

-- Add delivery tracking columns to alerts table
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS sent_via_email BOOLEAN DEFAULT FALSE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS sent_via_sms BOOLEAN DEFAULT FALSE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS sent_via_app BOOLEAN DEFAULT FALSE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS recipient_count INTEGER DEFAULT 0;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS email_sent_count INTEGER DEFAULT 0;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS sms_sent_count INTEGER DEFAULT 0;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS recipient_group VARCHAR(20);

-- Add comments for documentation
COMMENT ON COLUMN alerts.sent_via_email IS 'Whether the alert was sent via email';
COMMENT ON COLUMN alerts.sent_via_sms IS 'Whether the alert was sent via SMS';
COMMENT ON COLUMN alerts.sent_via_app IS 'Whether the alert was sent via app notification';
COMMENT ON COLUMN alerts.recipient_count IS 'Total number of recipients';
COMMENT ON COLUMN alerts.email_sent_count IS 'Number of emails successfully sent';
COMMENT ON COLUMN alerts.sms_sent_count IS 'Number of SMS messages successfully sent';
COMMENT ON COLUMN alerts.recipient_group IS 'Target group: admin, team, members, or specific';
