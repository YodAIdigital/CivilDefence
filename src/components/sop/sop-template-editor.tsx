'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import type { SOPTemplateTask, SOPTaskCategory, SOPDefaultAssigneeRole } from '@/types/database'
import { SOP_TASK_CATEGORY_CONFIG, SOP_DEFAULT_ASSIGNEE_OPTIONS } from '@/types/database'

interface TeamMemberOption {
  id: string
  full_name: string | null
  email: string
  role: 'admin' | 'team_member'
}

interface SOPTemplateEditorProps {
  tasks: SOPTemplateTask[]
  onChange: (tasks: SOPTemplateTask[]) => void
  onGenerateWithAI?: () => void
  isGenerating?: boolean
  readOnly?: boolean
  teamMembers?: TeamMemberOption[]
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

const CATEGORY_OPTIONS: { value: SOPTaskCategory; label: string }[] = [
  { value: 'immediate', label: 'Immediate Action' },
  { value: 'communication', label: 'Communication' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'safety', label: 'Safety' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'other', label: 'Other' },
]

export function SOPTemplateEditor({
  tasks,
  onChange,
  onGenerateWithAI,
  isGenerating = false,
  readOnly = false,
  teamMembers = [],
}: SOPTemplateEditorProps) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [localTasks, setLocalTasks] = useState<SOPTemplateTask[]>(tasks)

  useEffect(() => {
    setLocalTasks(tasks)
  }, [tasks])

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || readOnly) return

    const items = Array.from(localTasks)
    const [reorderedItem] = items.splice(result.source.index, 1)
    if (reorderedItem) {
      items.splice(result.destination.index, 0, reorderedItem)
    }

    // Update order numbers
    const reorderedTasks = items.map((task, index) => ({
      ...task,
      order: index + 1,
    }))

    setLocalTasks(reorderedTasks)
    onChange(reorderedTasks)
  }

  const addTask = () => {
    const newTask: SOPTemplateTask = {
      id: generateId(),
      title: '',
      description: '',
      order: localTasks.length + 1,
      category: 'other',
    }
    const updated = [...localTasks, newTask]
    setLocalTasks(updated)
    onChange(updated)
    setEditingTaskId(newTask.id)
  }

  const updateTask = (taskId: string, updates: Partial<SOPTemplateTask>) => {
    const updated = localTasks.map((task) =>
      task.id === taskId ? { ...task, ...updates } : task
    )
    setLocalTasks(updated)
    onChange(updated)
  }

  const removeTask = (taskId: string) => {
    const filtered = localTasks.filter((task) => task.id !== taskId)
    // Reorder remaining tasks
    const reordered = filtered.map((task, index) => ({
      ...task,
      order: index + 1,
    }))
    setLocalTasks(reordered)
    onChange(reordered)
    if (editingTaskId === taskId) {
      setEditingTaskId(null)
    }
  }

  const getCategoryConfig = (category: SOPTaskCategory | undefined) => {
    return SOP_TASK_CATEGORY_CONFIG[category || 'other']
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">SOP Tasks</h3>
          <p className="text-sm text-muted-foreground">
            Define the tasks that need to be completed during an emergency response.
          </p>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            {onGenerateWithAI && (
              <button
                type="button"
                onClick={onGenerateWithAI}
                disabled={isGenerating}
                className="flex items-center gap-2 rounded-lg border border-primary bg-primary/5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <span className="material-icons animate-spin text-lg">sync</span>
                    Generating...
                  </>
                ) : (
                  <>
                    <span className="material-icons text-lg">auto_awesome</span>
                    Generate with AI
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={addTask}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <span className="material-icons text-lg">add</span>
              Add Task
            </button>
          </div>
        )}
      </div>

      {/* Task List */}
      {localTasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
          <span className="material-icons text-4xl text-muted-foreground">checklist</span>
          <p className="mt-2 text-sm text-muted-foreground">
            No SOP tasks defined yet.
            {!readOnly && (
              <>
                {' '}
                Click &quot;Add Task&quot; to create tasks manually, or use &quot;Generate with AI&quot; to create
                tasks automatically based on the response plan.
              </>
            )}
          </p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="sop-tasks" isDropDisabled={readOnly}>
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-3"
              >
                {localTasks.map((task, index) => {
                  const categoryConfig = getCategoryConfig(task.category)
                  const isEditing = editingTaskId === task.id

                  return (
                    <Draggable
                      key={task.id}
                      draggableId={task.id}
                      index={index}
                      isDragDisabled={readOnly}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`rounded-lg border border-border bg-card transition-shadow ${
                            snapshot.isDragging ? 'shadow-lg' : ''
                          }`}
                        >
                          {/* Task Header */}
                          <div className="flex items-center gap-3 p-4">
                            {!readOnly && (
                              <div
                                {...provided.dragHandleProps}
                                className="cursor-grab text-muted-foreground hover:text-foreground"
                              >
                                <span className="material-icons">drag_indicator</span>
                              </div>
                            )}

                            {/* Order number */}
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                              {index + 1}
                            </div>

                            {/* Category indicator */}
                            <div
                              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${categoryConfig.bgColor}`}
                              title={categoryConfig.label}
                            >
                              <span
                                className="material-icons text-lg"
                                style={{ color: categoryConfig.color }}
                              >
                                {categoryConfig.icon}
                              </span>
                            </div>

                            {/* Task info */}
                            <div className="flex-1 min-w-0">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={task.title}
                                  onChange={(e) => updateTask(task.id, { title: e.target.value })}
                                  placeholder="Task title..."
                                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium"
                                  autoFocus
                                />
                              ) : (
                                <p className="font-medium truncate">
                                  {task.title || 'Untitled Task'}
                                </p>
                              )}
                              {!isEditing && task.description && (
                                <p className="text-sm text-muted-foreground truncate">
                                  {task.description}
                                </p>
                              )}
                            </div>

                            {/* Actions */}
                            {!readOnly && (
                              <div className="flex items-center gap-1">
                                {isEditing ? (
                                  <button
                                    type="button"
                                    onClick={() => setEditingTaskId(null)}
                                    className="p-1.5 text-primary hover:bg-primary/10 rounded-lg"
                                    title="Done editing"
                                  >
                                    <span className="material-icons text-lg">check</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setEditingTaskId(task.id)}
                                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                                    title="Edit task"
                                  >
                                    <span className="material-icons text-lg">edit</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeTask(task.id)}
                                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                  title="Remove task"
                                >
                                  <span className="material-icons text-lg">delete</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Expanded editing form */}
                          {isEditing && !readOnly && (
                            <div className="border-t border-border p-4 space-y-3 bg-muted/30">
                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  Description
                                </label>
                                <textarea
                                  value={task.description || ''}
                                  onChange={(e) =>
                                    updateTask(task.id, { description: e.target.value })
                                  }
                                  placeholder="Describe what needs to be done..."
                                  rows={2}
                                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                />
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <label className="block text-sm font-medium mb-1">
                                    Category
                                  </label>
                                  <select
                                    value={task.category || 'other'}
                                    onChange={(e) =>
                                      updateTask(task.id, {
                                        category: e.target.value as SOPTaskCategory,
                                      })
                                    }
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                  >
                                    {CATEGORY_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium mb-1">
                                    Default Assignee
                                  </label>
                                  <select
                                    value={task.default_assignee_id ? `user:${task.default_assignee_id}` : (task.default_assignee_role || 'none')}
                                    onChange={(e) => {
                                      const value = e.target.value
                                      if (value.startsWith('user:')) {
                                        // Specific user selected - clear role, set user ID
                                        const userId = value.replace('user:', '')
                                        const { default_assignee_role: _role, ...taskWithoutRole } = task
                                        const updatedTask = { ...taskWithoutRole, default_assignee_id: userId }
                                        const updated = localTasks.map((t) =>
                                          t.id === task.id ? updatedTask : t
                                        )
                                        setLocalTasks(updated)
                                        onChange(updated)
                                      } else {
                                        // Role-based selection - clear user ID, set role
                                        const { default_assignee_id: _userId, ...taskWithoutId } = task
                                        const updatedTask = { ...taskWithoutId, default_assignee_role: value as SOPDefaultAssigneeRole }
                                        const updated = localTasks.map((t) =>
                                          t.id === task.id ? updatedTask : t
                                        )
                                        setLocalTasks(updated)
                                        onChange(updated)
                                      }
                                    }}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                  >
                                    {SOP_DEFAULT_ASSIGNEE_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                    {teamMembers.length > 0 && (
                                      <>
                                        <option disabled>──────────</option>
                                        <option disabled className="font-medium">Team Members:</option>
                                      </>
                                    )}
                                    {teamMembers
                                      .filter((m) => m.role === 'admin')
                                      .map((member) => (
                                        <option key={member.id} value={`user:${member.id}`}>
                                          👑 {member.full_name || member.email} (Admin)
                                        </option>
                                      ))}
                                    {teamMembers
                                      .filter((m) => m.role === 'team_member')
                                      .map((member) => (
                                        <option key={member.id} value={`user:${member.id}`}>
                                          {member.full_name || member.email} (Team)
                                        </option>
                                      ))}
                                  </select>
                                </div>
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
      )}

      {/* Summary */}
      {localTasks.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
          <span>
            {localTasks.length} task{localTasks.length !== 1 ? 's' : ''} defined
          </span>
        </div>
      )}
    </div>
  )
}
