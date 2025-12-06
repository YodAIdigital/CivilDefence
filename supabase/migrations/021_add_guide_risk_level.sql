-- Add risk_level column to community_guides table
-- This stores the AI-analyzed risk severity for each response plan

-- Add the risk_level column
ALTER TABLE community_guides
ADD COLUMN IF NOT EXISTS risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high'));

-- Add a comment to document the column
COMMENT ON COLUMN community_guides.risk_level IS 'Risk severity level from AI analysis: low, medium, or high';
