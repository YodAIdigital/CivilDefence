-- AI Prompt Configurations Table
-- Stores customizable AI prompt configurations for various functions

-- Create the ai_prompt_configs table
CREATE TABLE IF NOT EXISTS ai_prompt_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_type TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  prompt_template TEXT NOT NULL,
  model_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on function_type for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_prompt_configs_function_type ON ai_prompt_configs(function_type);

-- Enable Row Level Security
ALTER TABLE ai_prompt_configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Super admins can view AI prompts" ON ai_prompt_configs;
DROP POLICY IF EXISTS "Super admins can insert AI prompts" ON ai_prompt_configs;
DROP POLICY IF EXISTS "Super admins can update AI prompts" ON ai_prompt_configs;
DROP POLICY IF EXISTS "Super admins can delete AI prompts" ON ai_prompt_configs;
DROP POLICY IF EXISTS "Service role can manage AI prompts" ON ai_prompt_configs;

-- Policy: Only super_admins can view AI prompts
CREATE POLICY "Super admins can view AI prompts"
  ON ai_prompt_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Policy: Only super_admins can insert AI prompts
CREATE POLICY "Super admins can insert AI prompts"
  ON ai_prompt_configs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Policy: Only super_admins can update AI prompts
CREATE POLICY "Super admins can update AI prompts"
  ON ai_prompt_configs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Policy: Only super_admins can delete AI prompts
CREATE POLICY "Super admins can delete AI prompts"
  ON ai_prompt_configs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_prompt_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_prompt_configs_updated_at ON ai_prompt_configs;
CREATE TRIGGER ai_prompt_configs_updated_at
  BEFORE UPDATE ON ai_prompt_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_prompt_configs_updated_at();

-- Grant usage on the table
GRANT ALL ON ai_prompt_configs TO authenticated;
GRANT ALL ON ai_prompt_configs TO service_role;
