-- Add AI Chat settings for community data queries
-- This allows super admins to configure the AI chat prompt and model

-- Add the community_chat function type to ai_prompt_configs if not exists
-- The ai_prompt_configs table already exists, we just need to add a new entry for community_chat

-- Create a table for storing AI chat history (optional, for audit purposes)
CREATE TABLE IF NOT EXISTS community_ai_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  model_used TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_community_ai_chat_history_community
  ON community_ai_chat_history(community_id);
CREATE INDEX IF NOT EXISTS idx_community_ai_chat_history_user
  ON community_ai_chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_community_ai_chat_history_created
  ON community_ai_chat_history(created_at DESC);

-- Enable RLS
ALTER TABLE community_ai_chat_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for community_ai_chat_history
-- Users can view their own chat history
CREATE POLICY "Users can view own chat history"
  ON community_ai_chat_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own chat messages
CREATE POLICY "Users can insert own chat messages"
  ON community_ai_chat_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Community admins can view all chat history for their community
CREATE POLICY "Community admins can view community chat history"
  ON community_ai_chat_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_ai_chat_history.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'super_admin')
    )
  );

-- Super admins can view all chat history
CREATE POLICY "Super admins can view all chat history"
  ON community_ai_chat_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Add comment to document the table
COMMENT ON TABLE community_ai_chat_history IS 'Stores AI chat history for community data queries';
COMMENT ON COLUMN community_ai_chat_history.community_id IS 'The community being queried';
COMMENT ON COLUMN community_ai_chat_history.user_id IS 'The user who made the query';
COMMENT ON COLUMN community_ai_chat_history.user_message IS 'The user question/query';
COMMENT ON COLUMN community_ai_chat_history.ai_response IS 'The AI generated response';
COMMENT ON COLUMN community_ai_chat_history.model_used IS 'The Gemini model used for the response';
COMMENT ON COLUMN community_ai_chat_history.tokens_used IS 'Approximate token count for the request';
