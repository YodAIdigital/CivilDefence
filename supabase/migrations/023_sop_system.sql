-- SOP (Standard Operating Procedures) System for Emergency Response
-- This migration creates tables for SOP templates and activated SOPs with real-time task tracking

-- ==========================================
-- SOP Templates (attached to community_guides/response plans)
-- ==========================================
CREATE TABLE IF NOT EXISTS sop_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  guide_id UUID NOT NULL REFERENCES community_guides(id) ON DELETE CASCADE,

  -- Template details
  name TEXT NOT NULL,
  description TEXT,

  -- Tasks stored as JSONB array
  -- Each task: { id, title, description, order, estimated_duration_minutes, category }
  tasks JSONB DEFAULT '[]'::jsonb,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Audit
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one SOP template per guide
CREATE UNIQUE INDEX IF NOT EXISTS idx_sop_templates_guide_unique ON sop_templates(guide_id);

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_sop_templates_community ON sop_templates(community_id);
CREATE INDEX IF NOT EXISTS idx_sop_templates_guide ON sop_templates(guide_id);

-- ==========================================
-- Activated SOPs (instances of templates during emergencies)
-- ==========================================
CREATE TABLE IF NOT EXISTS activated_sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES sop_templates(id) ON DELETE RESTRICT,
  guide_id UUID NOT NULL REFERENCES community_guides(id) ON DELETE RESTRICT,

  -- Event details
  event_name TEXT NOT NULL, -- e.g., "Earthquake Emergency - 15 Dec 2024"
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  emergency_type TEXT NOT NULL, -- e.g., "earthquake", "flood", etc.

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),

  -- Timing
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,

  -- Notes for post-event review
  completion_notes TEXT,

  -- Copy of tasks at activation time (snapshot)
  -- Stored separately in sop_tasks table for real-time tracking

  -- Audit
  activated_by UUID NOT NULL REFERENCES profiles(id),
  completed_by UUID REFERENCES profiles(id),
  archived_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_activated_sops_community ON activated_sops(community_id);
CREATE INDEX IF NOT EXISTS idx_activated_sops_template ON activated_sops(template_id);
CREATE INDEX IF NOT EXISTS idx_activated_sops_status ON activated_sops(status);
CREATE INDEX IF NOT EXISTS idx_activated_sops_event_date ON activated_sops(event_date DESC);

-- ==========================================
-- SOP Tasks (individual tasks for activated SOPs)
-- ==========================================
CREATE TABLE IF NOT EXISTS sop_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activated_sop_id UUID NOT NULL REFERENCES activated_sops(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  -- Task details (copied from template at activation)
  title TEXT NOT NULL,
  description TEXT,
  task_order INTEGER NOT NULL DEFAULT 0,
  estimated_duration_minutes INTEGER,
  category TEXT, -- e.g., "immediate", "communication", "logistics", "safety"

  -- Assignment
  team_lead_id UUID REFERENCES profiles(id), -- Overall team lead
  assigned_to_id UUID REFERENCES profiles(id), -- Delegated to

  -- Progress tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),

  -- Completion details
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),

  -- Notes (for each task)
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for efficient querying and real-time updates
CREATE INDEX IF NOT EXISTS idx_sop_tasks_activated_sop ON sop_tasks(activated_sop_id);
CREATE INDEX IF NOT EXISTS idx_sop_tasks_community ON sop_tasks(community_id);
CREATE INDEX IF NOT EXISTS idx_sop_tasks_status ON sop_tasks(status);
CREATE INDEX IF NOT EXISTS idx_sop_tasks_assigned ON sop_tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_sop_tasks_order ON sop_tasks(activated_sop_id, task_order);

-- ==========================================
-- SOP Task Activity Log (for audit trail)
-- ==========================================
CREATE TABLE IF NOT EXISTS sop_task_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES sop_tasks(id) ON DELETE CASCADE,
  activated_sop_id UUID NOT NULL REFERENCES activated_sops(id) ON DELETE CASCADE,

  -- Activity details
  action TEXT NOT NULL, -- 'status_change', 'assignment_change', 'note_added', 'team_lead_change'
  old_value TEXT,
  new_value TEXT,

  -- Who made the change
  performed_by UUID NOT NULL REFERENCES profiles(id),

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_sop_task_activity_task ON sop_task_activity(task_id);
CREATE INDEX IF NOT EXISTS idx_sop_task_activity_sop ON sop_task_activity(activated_sop_id);
CREATE INDEX IF NOT EXISTS idx_sop_task_activity_created ON sop_task_activity(created_at DESC);

-- ==========================================
-- Enable RLS
-- ==========================================
ALTER TABLE sop_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE activated_sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_task_activity ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS Policies for sop_templates
-- ==========================================

-- Community admins and team members can view templates
CREATE POLICY "Community admins and team can view SOP templates"
  ON sop_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = sop_templates.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'team_member')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Community admins can insert templates
CREATE POLICY "Community admins can create SOP templates"
  ON sop_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = sop_templates.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Community admins can update templates
CREATE POLICY "Community admins can update SOP templates"
  ON sop_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = sop_templates.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Community admins can delete templates
CREATE POLICY "Community admins can delete SOP templates"
  ON sop_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = sop_templates.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- ==========================================
-- RLS Policies for activated_sops
-- ==========================================

-- Community admins and team members can view activated SOPs
CREATE POLICY "Community admins and team can view activated SOPs"
  ON activated_sops
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = activated_sops.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'team_member')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Community admins and team members can activate SOPs
CREATE POLICY "Community admins and team can activate SOPs"
  ON activated_sops
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = activated_sops.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'team_member')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Community admins and team members can update activated SOPs
CREATE POLICY "Community admins and team can update activated SOPs"
  ON activated_sops
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = activated_sops.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'team_member')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- ==========================================
-- RLS Policies for sop_tasks
-- ==========================================

-- Community admins and team members can view tasks
CREATE POLICY "Community admins and team can view SOP tasks"
  ON sop_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = sop_tasks.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'team_member')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Community admins and team members can insert tasks (during activation)
CREATE POLICY "Community admins and team can create SOP tasks"
  ON sop_tasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = sop_tasks.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'team_member')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Community admins and team members can update tasks
CREATE POLICY "Community admins and team can update SOP tasks"
  ON sop_tasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = sop_tasks.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'team_member')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- ==========================================
-- RLS Policies for sop_task_activity
-- ==========================================

-- Community admins and team members can view activity
CREATE POLICY "Community admins and team can view SOP task activity"
  ON sop_task_activity
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM activated_sops a
      JOIN community_members cm ON cm.community_id = a.community_id
      WHERE a.id = sop_task_activity.activated_sop_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'team_member')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Community admins and team members can log activity
CREATE POLICY "Community admins and team can log SOP task activity"
  ON sop_task_activity
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM activated_sops a
      JOIN community_members cm ON cm.community_id = a.community_id
      WHERE a.id = sop_task_activity.activated_sop_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'team_member')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- ==========================================
-- Triggers for updated_at timestamps
-- ==========================================

-- Trigger for sop_templates
CREATE TRIGGER update_sop_templates_updated_at
  BEFORE UPDATE ON sop_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for activated_sops
CREATE TRIGGER update_activated_sops_updated_at
  BEFORE UPDATE ON activated_sops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for sop_tasks
CREATE TRIGGER update_sop_tasks_updated_at
  BEFORE UPDATE ON sop_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- Enable real-time subscriptions for SOP tables
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE sop_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE activated_sops;

-- ==========================================
-- Comments for documentation
-- ==========================================
COMMENT ON TABLE sop_templates IS 'SOP templates attached to response plans (community_guides)';
COMMENT ON TABLE activated_sops IS 'Active or archived SOP instances during emergency events';
COMMENT ON TABLE sop_tasks IS 'Individual tasks within an activated SOP with real-time tracking';
COMMENT ON TABLE sop_task_activity IS 'Audit log for task changes during an active SOP';

COMMENT ON COLUMN sop_templates.tasks IS 'JSONB array of template tasks: [{id, title, description, order, estimated_duration_minutes, category}]';
COMMENT ON COLUMN activated_sops.status IS 'SOP status: active (during emergency), completed (emergency resolved), archived (for historical review)';
COMMENT ON COLUMN sop_tasks.status IS 'Task status: pending, in_progress, completed, skipped';
COMMENT ON COLUMN sop_tasks.team_lead_id IS 'Overall team lead responsible for the task';
COMMENT ON COLUMN sop_tasks.assigned_to_id IS 'Specific person the task is delegated to';
