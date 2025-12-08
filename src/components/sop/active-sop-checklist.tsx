'use client'

import { useState, useEffect, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { supabase } from '@/lib/supabase/client'
import type {
  ActivatedSOP,
  SOPTask,
  SOPTaskStatus,
  SOPTaskCategory,
  ProfileExtended,
  FieldVisibility,
} from '@/types/database'
import { SOP_TASK_STATUS_CONFIG, SOP_TASK_CATEGORY_CONFIG, SKILL_OPTIONS } from '@/types/database'

// Status colours for display: pending=red, in_progress=amber, completed/skipped=green
const STATUS_COLORS = {
  pending: { bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-500', text: 'text-red-600 dark:text-red-400', color: '#dc2626' },
  in_progress: { bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-500', text: 'text-amber-600 dark:text-amber-400', color: '#d97706' },
  completed: { bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-500', text: 'text-green-600 dark:text-green-400', color: '#16a34a' },
  skipped: { bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-500', text: 'text-green-600 dark:text-green-400', color: '#16a34a' },
}

interface ActiveSOPChecklistProps {
  activatedSopId: string
  communityId: string
  userId: string
  onComplete?: () => void
  onArchive?: () => void
}

interface TeamMember {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  phone: string | null
  notification_preferences: ProfileExtended | null
}

// Helper to get extended profile data
function getExtendedProfile(member: TeamMember | null): ProfileExtended | null {
  if (!member) return null
  return member.notification_preferences || null
}

// Helper to check if a field is visible based on privacy settings
function isFieldVisible(
  extended: ProfileExtended | null,
  fieldGroup: keyof NonNullable<ProfileExtended['visibility']>
): boolean {
  if (!extended?.visibility) return true // Default to visible if no privacy settings
  const visibility = extended.visibility[fieldGroup] as FieldVisibility | undefined
  // For SOP context, show if 'community' or 'civil_defence_only' (team members/admins can see)
  if (!visibility || visibility === 'community' || visibility === 'civil_defence_only') return true
  return false // 'private'
}

interface TaskWithAssignments extends SOPTask {
  team_lead_profile?: TeamMember | null
  assigned_to_profile?: TeamMember | null
  completed_by_profile?: TeamMember | null
}

export function ActiveSOPChecklist({
  activatedSopId,
  communityId,
  userId,
  onComplete,
  onArchive,
}: ActiveSOPChecklistProps) {
  const [activatedSop, setActivatedSop] = useState<ActivatedSOP | null>(null)
  const [tasks, setTasks] = useState<TaskWithAssignments[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteValue, setNoteValue] = useState('')
  const [selectedPerson, setSelectedPerson] = useState<TeamMember | null>(null)
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<string | null>(null)

  // Fetch activated SOP and tasks
  const fetchData = useCallback(async () => {
    try {
      // Fetch activated SOP
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sopData, error: sopError } = await (supabase as any)
        .from('activated_sops')
        .select(`
          *,
          guide:community_guides(id, name, icon, color, guide_type)
        `)
        .eq('id', activatedSopId)
        .single()

      if (sopError) throw sopError
      setActivatedSop(sopData as ActivatedSOP)

      // Fetch tasks with profile joins
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tasksData, error: tasksError } = await (supabase as any)
        .from('sop_tasks')
        .select(`
          *,
          team_lead_profile:profiles!sop_tasks_team_lead_id_fkey(id, full_name, email, avatar_url, phone, notification_preferences),
          assigned_to_profile:profiles!sop_tasks_assigned_to_id_fkey(id, full_name, email, avatar_url, phone, notification_preferences),
          completed_by_profile:profiles!sop_tasks_completed_by_fkey(id, full_name, email, avatar_url, phone, notification_preferences)
        `)
        .eq('activated_sop_id', activatedSopId)
        .order('task_order', { ascending: true })

      if (tasksError) throw tasksError
      setTasks((tasksData as TaskWithAssignments[]) || [])

      // Fetch team members (admins and team_members)
      const { data: membersData, error: membersError } = await supabase
        .from('community_members')
        .select('user_id, profiles:profiles(id, full_name, email, avatar_url, phone, notification_preferences)')
        .eq('community_id', communityId)
        .in('role', ['admin', 'team_member'])

      if (membersError) throw membersError

      const members = membersData
        ?.map((m) => m.profiles as unknown as TeamMember)
        .filter(Boolean) || []
      setTeamMembers(members)
    } catch (err) {
      console.error('Error fetching SOP data:', err)
      setError('Failed to load SOP data')
    } finally {
      setIsLoading(false)
    }
  }, [activatedSopId, communityId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Set up real-time subscription for tasks
  useEffect(() => {
    const channel = supabase
      .channel(`sop-tasks-${activatedSopId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sop_tasks',
          filter: `activated_sop_id=eq.${activatedSopId}`,
        },
        () => {
          // Refetch tasks on any change
          fetchData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activatedSopId, fetchData])

  // Update task status
  const updateTaskStatus = async (taskId: string, newStatus: SOPTaskStatus) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const updates: Partial<SOPTask> = { status: newStatus }
    if (newStatus === 'completed') {
      updates.completed_at = new Date().toISOString()
      updates.completed_by = userId
    } else if (newStatus === 'pending' || newStatus === 'in_progress') {
      updates.completed_at = null
      updates.completed_by = null
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('sop_tasks')
        .update(updates)
        .eq('id', taskId)

      if (error) throw error

      // Log activity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('sop_task_activity').insert({
        task_id: taskId,
        activated_sop_id: activatedSopId,
        action: 'status_change',
        old_value: task.status,
        new_value: newStatus,
        performed_by: userId,
      })
    } catch (err) {
      console.error('Error updating task status:', err)
      setError('Failed to update task')
    }
  }

  // Assign task to team member
  const assignTask = async (taskId: string, assigneeId: string | null) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('sop_tasks')
        .update({ assigned_to_id: assigneeId })
        .eq('id', taskId)

      if (error) throw error

      // Log activity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('sop_task_activity').insert({
        task_id: taskId,
        activated_sop_id: activatedSopId,
        action: 'assignment_change',
        old_value: task.assigned_to_id || 'unassigned',
        new_value: assigneeId || 'unassigned',
        performed_by: userId,
      })
    } catch (err) {
      console.error('Error assigning task:', err)
      setError('Failed to assign task')
    }
  }

  // Set team lead for task
  const setTeamLead = async (taskId: string, leadId: string | null) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('sop_tasks')
        .update({ team_lead_id: leadId })
        .eq('id', taskId)

      if (error) throw error

      // Log activity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('sop_task_activity').insert({
        task_id: taskId,
        activated_sop_id: activatedSopId,
        action: 'team_lead_change',
        old_value: task.team_lead_id || 'none',
        new_value: leadId || 'none',
        performed_by: userId,
      })
    } catch (err) {
      console.error('Error setting team lead:', err)
      setError('Failed to set team lead')
    }
  }

  // Add note to task
  const addNote = async (taskId: string) => {
    if (!noteValue.trim()) return

    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    // Get current user's name for the note
    const currentUser = teamMembers.find((m) => m.id === userId)
    const authorName = currentUser?.full_name || currentUser?.email || 'Unknown'

    const existingNotes = task.notes || ''
    const timestamp = new Date().toLocaleString('en-GB')
    const newNote = existingNotes
      ? `${existingNotes}\n\n${noteValue.trim()}\n${timestamp} - ${authorName}`
      : `${noteValue.trim()}\n${timestamp} - ${authorName}`

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('sop_tasks')
        .update({ notes: newNote })
        .eq('id', taskId)

      if (error) throw error

      // Log activity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('sop_task_activity').insert({
        task_id: taskId,
        activated_sop_id: activatedSopId,
        action: 'note_added',
        old_value: null,
        new_value: noteValue.trim(),
        performed_by: userId,
      })

      setNoteValue('')
      setEditingNote(null)
    } catch (err) {
      console.error('Error adding note:', err)
      setError('Failed to add note')
    }
  }

  // Complete SOP
  const completeSOP = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('activated_sops')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: userId,
        })
        .eq('id', activatedSopId)

      if (error) throw error
      onComplete?.()
    } catch (err) {
      console.error('Error completing SOP:', err)
      setError('Failed to complete SOP')
    }
  }

  // Archive SOP
  const archiveSOP = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('activated_sops')
        .update({
          status: 'archived',
          archived_at: new Date().toISOString(),
          archived_by: userId,
        })
        .eq('id', activatedSopId)

      if (error) throw error
      onArchive?.()
    } catch (err) {
      console.error('Error archiving SOP:', err)
      setError('Failed to archive SOP')
    }
  }

  // Add new task
  const addTask = async () => {
    if (!newTaskTitle.trim()) return

    const newOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.task_order)) + 1 : 1

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('sop_tasks')
        .insert({
          activated_sop_id: activatedSopId,
          community_id: communityId,
          title: newTaskTitle.trim(),
          task_order: newOrder,
          category: 'other',
          status: 'pending',
        })

      if (error) throw error

      setNewTaskTitle('')
      setIsAddingTask(false)
      // Real-time subscription will refresh the task list
    } catch (err) {
      console.error('Error adding task:', err)
      setError('Failed to add task')
    }
  }

  // Delete task from active SOP only (not the template)
  const deleteTask = async (taskId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('sop_tasks')
        .delete()
        .eq('id', taskId)

      if (error) throw error

      setDeleteConfirmTask(null)
      // Force refresh task list
      await fetchData()
    } catch (err) {
      console.error('Error deleting task:', err)
      setError('Failed to delete task')
    }
  }

  // Handle drag and drop reorder
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return

    const sourceIndex = result.source.index
    const destIndex = result.destination.index

    if (sourceIndex === destIndex) return

    // Reorder locally first for instant feedback
    const reorderedTasks = Array.from(tasks)
    const [movedTask] = reorderedTasks.splice(sourceIndex, 1)
    if (movedTask) {
      reorderedTasks.splice(destIndex, 0, movedTask)
    }

    // Update order numbers
    const updatedTasks = reorderedTasks.map((task, index) => ({
      ...task,
      task_order: index + 1,
    }))

    setTasks(updatedTasks)

    // Update in database
    try {
      // Update each task's order
      await Promise.all(
        updatedTasks.map((task) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any)
            .from('sop_tasks')
            .update({ task_order: task.task_order })
            .eq('id', task.id)
        )
      )
    } catch (err) {
      console.error('Error reordering tasks:', err)
      setError('Failed to reorder tasks')
      // Refetch to restore correct order on error
      fetchData()
    }
  }

  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const totalCount = tasks.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const getCategoryConfig = (category: SOPTaskCategory | null) => {
    return SOP_TASK_CATEGORY_CONFIG[category || 'other']
  }

  const getStatusConfig = (status: SOPTaskStatus) => {
    return SOP_TASK_STATUS_CONFIG[status]
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="material-icons animate-spin text-2xl text-primary">sync</span>
        <span className="ml-2 text-muted-foreground">Loading SOP...</span>
      </div>
    )
  }

  if (!activatedSop) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        SOP not found
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
            <span className="material-icons text-2xl text-red-600 dark:text-red-400">emergency</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">{activatedSop.event_name}</h2>
            <p className="text-sm text-muted-foreground">
              {activatedSop.emergency_type} - {new Date(activatedSop.event_date).toLocaleDateString('en-GB')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activatedSop.status === 'active' && (
            <>
              <button
                onClick={completeSOP}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
              >
                <span className="material-icons text-lg">check_circle</span>
                Complete
              </button>
            </>
          )}
          {activatedSop.status === 'completed' && (
            <button
              onClick={archiveSOP}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <span className="material-icons text-lg">archive</span>
              Archive
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Progress</span>
          <span className="text-sm text-muted-foreground">
            {completedCount} / {totalCount} tasks ({progressPercent}%)
          </span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Team Lead Section - Above All Tasks */}
      <div className="rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <span className="material-icons text-blue-600 dark:text-blue-400">supervisor_account</span>
            </div>
            <div>
              <label className="text-sm font-medium">Team Lead</label>
              <p className="text-xs text-muted-foreground">Overall coordinator for this emergency response</p>
            </div>
          </div>
          <select
            value={tasks[0]?.team_lead_id || ''}
            onChange={(e) => {
              // Update team lead for all tasks
              const leadId = e.target.value || null
              tasks.forEach((task) => {
                setTeamLead(task.id, leadId)
              })
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm min-w-[180px]"
          >
            <option value="">Select Team Lead</option>
            {teamMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name || member.email}
              </option>
            ))}
          </select>
        </div>
        {(() => {
          const teamLead = tasks[0]?.team_lead_profile
          if (!teamLead) return null
          return (
            <button
              onClick={() => setSelectedPerson(teamLead as TeamMember)}
              className="mt-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              title="View team lead details"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                {teamLead.avatar_url ? (
                  <img
                    src={teamLead.avatar_url}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="material-icons text-sm">person</span>
                )}
              </div>
              <span>{teamLead.full_name || teamLead.email}</span>
              <span className="material-icons text-sm">info</span>
            </button>
          )
        })()}
      </div>

      {/* Task List */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="sop-tasks">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-2"
            >
              {tasks.map((task, index) => {
                const categoryConfig = getCategoryConfig(task.category)
                const statusConfig = getStatusConfig(task.status)
                const statusColors = STATUS_COLORS[task.status]
                const isExpanded = expandedTask === task.id

                return (
                  <Draggable key={task.id} draggableId={task.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`rounded-lg border border-border bg-card overflow-hidden transition-shadow ${
                          task.status === 'completed' ? 'opacity-75' : ''
                        } ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                      >
                        {/* Task Header */}
                        <div
                          className="flex items-center gap-3 p-3 cursor-pointer"
                          onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                        >
                          {/* Drag Handle + Status Icon - drag the entire icon area */}
                          <div
                            {...provided.dragHandleProps}
                            onClick={(e) => {
                              e.stopPropagation()
                              const nextStatus: Record<SOPTaskStatus, SOPTaskStatus> = {
                                pending: 'in_progress',
                                in_progress: 'completed',
                                completed: 'pending',
                                skipped: 'pending',
                              }
                              updateTaskStatus(task.id, nextStatus[task.status])
                            }}
                            className={`flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-grab active:cursor-grabbing ${statusColors.bg}`}
                            title={`${statusConfig.label} - Click to change status, drag to reorder`}
                          >
                            <span
                              className="material-icons text-lg pointer-events-none"
                              style={{ color: statusColors.color }}
                            >
                              {statusConfig.icon}
                            </span>
                          </div>

                          {/* Category badge shown in subtitle instead */}

                          {/* Task Info */}
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate text-gray-900 dark:text-gray-100 ${task.status === 'completed' ? 'line-through' : ''}`}>
                              {task.title}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {/* Category label only, no icon */}
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs -ml-1.5"
                                style={{ backgroundColor: categoryConfig.bgColor.replace('bg-', ''), color: categoryConfig.color }}
                              >
                                {categoryConfig.label}
                              </span>
                              {task.assigned_to_profile && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedPerson(task.assigned_to_profile as TeamMember)
                                  }}
                                  className="flex items-center gap-1 hover:text-primary transition-colors"
                                  title="View person details"
                                >
                                  <span className="material-icons text-xs">person</span>
                                  {task.assigned_to_profile.full_name || task.assigned_to_profile.email}
                                  <span className="material-icons text-xs">info</span>
                                </button>
                              )}
                              {task.completed_at && (
                                <span className="flex items-center gap-1 text-green-600">
                                  <span className="material-icons text-xs">check</span>
                                  {new Date(task.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Expand Icon */}
                          <span className="material-icons text-muted-foreground">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="p-3 space-y-3 bg-white dark:bg-gray-900">
                  {/* Description */}
                  {task.description && (
                    <div>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{task.description}</p>
                    </div>
                  )}

                  {/* Assignment & Status Controls */}
                  <div className="space-y-3">
                    {/* Assigned To with Status Buttons inline */}
                    <div>
                      <label className="block text-xs font-medium mb-1">Assigned To</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={task.assigned_to_id || ''}
                          onChange={(e) => assignTask(task.id, e.target.value || null)}
                          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm min-w-[224px]"
                        >
                          <option value="">Unassigned</option>
                          {teamMembers.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.full_name || member.email}
                            </option>
                          ))}
                        </select>

                        {/* Status Buttons - inline with Assigned To */}
                        <div className="flex gap-1">
                          {(['pending', 'in_progress', 'completed'] as const).map((status) => {
                            const config = getStatusConfig(status)
                            const isActive = task.status === status
                            // Define colors: pending=red, in_progress=amber, completed=green
                            const statusColors = {
                              pending: { bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-600', text: 'text-red-600 dark:text-red-400' },
                              in_progress: { bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-600', text: 'text-amber-600 dark:text-amber-400' },
                              completed: { bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-600', text: 'text-green-600 dark:text-green-400' },
                            }
                            const colors = statusColors[status]
                            return (
                              <button
                                key={status}
                                onClick={() => updateTaskStatus(task.id, status)}
                                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                                  isActive
                                    ? `${colors.bg} border-2 ${colors.border}`
                                    : 'bg-muted hover:bg-muted/80'
                                }`}
                                title={config.label}
                              >
                                <span className={`material-icons text-sm ${colors.text}`}>
                                  {config.icon}
                                </span>
                                <span className="hidden sm:inline">{config.label}</span>
                              </button>
                            )
                          })}
                          {/* Delete Button */}
                          <button
                            onClick={() => setDeleteConfirmTask(task.id)}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors bg-muted hover:bg-destructive/10 hover:text-destructive"
                            title="Delete task"
                          >
                            <span className="material-icons text-sm">delete</span>
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium mb-1">Notes</label>
                    {task.notes && (
                      <div className="rounded-lg bg-background border border-border p-2 mb-2 text-sm">
                        {/* Parse notes into individual entries and display note text above timestamp */}
                        {task.notes.split('\n\n').map((entry, entryIdx) => {
                          const lines = entry.split('\n').filter(line => line.trim())
                          // Check which line is the timestamp
                          const timestampRegex = /^\[?\d{1,2}\/\d{1,2}\/\d{4},?\s+\d{1,2}:\d{2}(:\d{2})?\s*-\s*.+\]?$/
                          const timestampLineIdx = lines.findIndex(line => timestampRegex.test(line.trim()))

                          // Reorder: note text first, timestamp second
                          let noteLines: string[] = []
                          let timestampLine: string | null = null

                          if (timestampLineIdx !== -1) {
                            timestampLine = lines[timestampLineIdx].replace(/^\[|\]$/g, '') // Remove brackets
                            noteLines = lines.filter((_, idx) => idx !== timestampLineIdx)
                          } else {
                            noteLines = lines
                          }

                          return (
                            <div key={entryIdx} className={entryIdx > 0 ? 'mt-3 pt-3 border-t border-border/50' : ''}>
                              {noteLines.map((line, lineIdx) => (
                                <p key={lineIdx} className="text-gray-900 dark:text-gray-100">{line}</p>
                              ))}
                              {timestampLine && (
                                <p className="text-muted-foreground/70 text-xs mt-1">{timestampLine}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {editingNote === task.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={noteValue}
                          onChange={(e) => setNoteValue(e.target.value)}
                          placeholder="Add a note..."
                          className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              addNote(task.id)
                            }
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => addNote(task.id)}
                          className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setEditingNote(null)
                            setNoteValue('')
                          }}
                          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingNote(task.id)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <span className="material-icons text-sm">add</span>
                        Add note
                      </button>
                    )}
                  </div>
                </div>
              )}
                      </div>
                    )}
                  </Draggable>
                )
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add Task Button/Form */}
      {activatedSop?.status === 'active' && (
        <div className="mt-2">
          {isAddingTask ? (
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Enter task title..."
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      addTask()
                    }
                    if (e.key === 'Escape') {
                      setIsAddingTask(false)
                      setNewTaskTitle('')
                    }
                  }}
                  autoFocus
                />
                <button
                  onClick={addTask}
                  disabled={!newTaskTitle.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setIsAddingTask(false)
                    setNewTaskTitle('')
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingTask(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary p-3 text-sm font-medium text-primary hover:bg-primary hover:border-solid hover:text-primary-foreground transition-all"
            >
              <span className="material-icons text-lg">add</span>
              Add Task
            </button>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDeleteConfirmTask(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <span className="material-icons text-destructive">delete</span>
              </div>
              <div>
                <h3 className="font-semibold">Delete Task</h3>
                <p className="text-sm text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete this task from the active SOP? This will only remove it from this emergency response, not from the original template.
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-border p-4">
              <button
                onClick={() => setDeleteConfirmTask(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTask(deleteConfirmTask)}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Person Details Popup */}
      {selectedPerson && (() => {
        const extended = getExtendedProfile(selectedPerson)
        const displayPhone = extended?.mobile_number || selectedPerson.phone
        const hasPersonalInfo = isFieldVisible(extended, 'personal_info') && (extended?.address || displayPhone)
        const hasSkills = isFieldVisible(extended, 'skills') && extended?.skills && extended.skills.length > 0

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setSelectedPerson(null)}
          >
            <div
              className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border p-4">
                <h3 className="font-semibold">Team Member Details</h3>
                <button
                  onClick={() => setSelectedPerson(null)}
                  className="rounded-lg p-1.5 hover:bg-muted"
                >
                  <span className="material-icons">close</span>
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Avatar and Name */}
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent overflow-hidden">
                    {selectedPerson.avatar_url ? (
                      <img
                        src={selectedPerson.avatar_url}
                        alt={selectedPerson.full_name || ''}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-white">
                        {(selectedPerson.full_name || selectedPerson.email || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold">
                      {selectedPerson.full_name || 'No name provided'}
                    </h4>
                    <p className="text-sm text-muted-foreground">{selectedPerson.email}</p>
                  </div>
                </div>

                {/* Contact Information */}
                {hasPersonalInfo && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium flex items-center gap-2">
                      <span className="material-icons text-base text-primary">contact_phone</span>
                      Contact Information
                    </h5>
                    <div className="text-sm text-muted-foreground space-y-1 pl-6">
                      {displayPhone && (
                        <p className="flex items-center gap-2">
                          <span className="material-icons text-xs">phone</span>
                          <a href={`tel:${displayPhone}`} className="hover:text-primary">
                            {displayPhone}
                          </a>
                        </p>
                      )}
                      {extended?.address && (
                        <p className="flex items-start gap-2">
                          <span className="material-icons text-xs mt-0.5">home</span>
                          {extended.address}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Skills & Qualifications */}
                {hasSkills && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium flex items-center gap-2">
                      <span className="material-icons text-base text-green-500">medical_services</span>
                      Skills & Qualifications
                    </h5>
                    <div className="flex flex-wrap gap-1 pl-6">
                      {extended?.skills?.map((skill) => {
                        const label = SKILL_OPTIONS.find(s => s.value === skill)?.label || skill
                        return (
                          <span
                            key={skill}
                            className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                          >
                            {label}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Contact Actions */}
                <div className="flex gap-2">
                  <a
                    href={`mailto:${selectedPerson.email}`}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    <span className="material-icons text-lg">email</span>
                    Email
                  </a>
                  {displayPhone && (
                    <a
                      href={`tel:${displayPhone}`}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                    >
                      <span className="material-icons text-lg">phone</span>
                      Call
                    </a>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end border-t border-border p-4">
                <button
                  onClick={() => setSelectedPerson(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
