-- Add online event support to community_events table
ALTER TABLE community_events
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN community_events.is_online IS 'Whether the event is held online';
COMMENT ON COLUMN community_events.meeting_link IS 'URL for the online meeting (e.g., Google Meet link)';
