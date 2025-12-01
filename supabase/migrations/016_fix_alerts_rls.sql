-- Migration: Fix alerts RLS to allow access via alert_recipients
-- Users should be able to see alerts they're recipients of

-- Drop the existing select policy
DROP POLICY IF EXISTS "Users can read alerts for their communities" ON alerts;

-- Create a new policy that allows access via alert_recipients OR community membership
CREATE POLICY "Users can read alerts they have access to"
  ON alerts FOR SELECT
  USING (
    is_active = true AND (
      -- Public alerts
      is_public = true OR
      -- User is a member of the community
      community_id IN (
        SELECT community_id FROM community_members WHERE user_id = auth.uid()
      ) OR
      -- User is a recipient of this alert
      id IN (
        SELECT alert_id FROM alert_recipients WHERE user_id = auth.uid()
      )
    )
  );

-- Add comment
COMMENT ON POLICY "Users can read alerts they have access to" ON alerts IS
  'Users can see alerts if: public, in their community, or they are a recipient';
