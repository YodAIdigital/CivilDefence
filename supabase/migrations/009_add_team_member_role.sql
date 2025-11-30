-- Migration: Add team_member role for community-specific permissions
-- This adds an intermediate role between member and admin
-- NOTE: This migration ONLY adds the enum value. Policies that use it are in 010_team_member_policies.sql
-- This is required because PostgreSQL needs a commit before new enum values can be used.

-- Add team_member to the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'team_member' BEFORE 'admin';

-- Update comments to clarify role hierarchy
COMMENT ON TYPE user_role IS 'User roles: public (unauthenticated), member (basic community member), team_member (elevated community member with some admin capabilities), admin (community administrator), super_admin (platform administrator)';

-- Note: The community_members.role column already uses user_role enum
-- Each user can have different roles in different communities
-- For example:
-- - User A is 'admin' in Community 1
-- - User A is 'member' in Community 2
-- - User A is 'team_member' in Community 3

-- The profiles.role column is for GLOBAL platform roles only:
-- - 'member' = regular platform user (default)
-- - 'super_admin' = platform administrator with access to all communities
