'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { SOPTemplate, CreateActivatedSOP, SOPTemplateTask } from '@/types/database'

interface ActivateSOPModalProps {
  communityId: string
  userId: string
  onClose: () => void
  onActivated: (sopId: string) => void
}

// Local type matching database schema (snake_case)
interface GuideFromDB {
  id: string
  community_id: string
  name: string
  description: string | null
  icon: string
  color: string
  guide_type: string
  is_active: boolean
}

interface GuideWithTemplate extends GuideFromDB {
  sop_template?: SOPTemplate
}

export function ActivateSOPModal({
  communityId,
  userId,
  onClose,
  onActivated,
}: ActivateSOPModalProps) {
  const [guides, setGuides] = useState<GuideWithTemplate[]>([])
  const [selectedGuide, setSelectedGuide] = useState<GuideWithTemplate | null>(null)
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0])
  const [isLoading, setIsLoading] = useState(true)
  const [isActivating, setIsActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch guides with SOP templates
  useEffect(() => {
    const fetchGuidesWithTemplates = async () => {
      setIsLoading(true)
      try {
        // Fetch active guides for this community
        const { data: guidesData, error: guidesError } = await supabase
          .from('community_guides')
          .select('*')
          .eq('community_id', communityId)
          .eq('is_active', true)
          .order('display_order', { ascending: true })

        if (guidesError) throw guidesError

        if (!guidesData || guidesData.length === 0) {
          setGuides([])
          setIsLoading(false)
          return
        }

        // Fetch SOP templates for these guides
        const guideIds = guidesData.map((g) => g.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: templatesData, error: templatesError } = await (supabase as any)
          .from('sop_templates')
          .select('*')
          .in('guide_id', guideIds)
          .eq('is_active', true) as { data: SOPTemplate[] | null; error: Error | null }

        if (templatesError) throw templatesError

        // Combine guides with their templates
        const guidesWithTemplates = guidesData.map((guide) => ({
          ...guide,
          sop_template: templatesData?.find((t) => t.guide_id === guide.id),
        })) as GuideWithTemplate[]

        // Filter to only show guides that have SOP templates
        const guidesWithSOPs = guidesWithTemplates.filter((g) => g.sop_template)
        setGuides(guidesWithSOPs)
      } catch (err) {
        console.error('Error fetching guides:', err)
        setError('Failed to load response plans')
      } finally {
        setIsLoading(false)
      }
    }

    fetchGuidesWithTemplates()
  }, [communityId])

  // Set default event name when guide is selected
  useEffect(() => {
    if (selectedGuide) {
      const date = new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
      setEventName(`${selectedGuide.name} - ${date}`)
    }
  }, [selectedGuide])

  const handleActivate = async () => {
    if (!selectedGuide || !selectedGuide.sop_template) {
      setError('Please select a response plan')
      return
    }

    if (!eventName.trim()) {
      setError('Please enter an event name')
      return
    }

    setIsActivating(true)
    setError(null)

    try {
      // Create activated SOP
      const activatedSopData: CreateActivatedSOP = {
        community_id: communityId,
        template_id: selectedGuide.sop_template.id,
        guide_id: selectedGuide.id,
        event_name: eventName.trim(),
        ...(eventDate && { event_date: eventDate }),
        emergency_type: selectedGuide.guide_type || 'general',
        activated_by: userId,
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: activatedSop, error: activateError } = await (supabase as any)
        .from('activated_sops')
        .insert(activatedSopData)
        .select()
        .single()

      if (activateError) throw activateError

      // Create individual tasks from template
      const tasks = (selectedGuide.sop_template.tasks as SOPTemplateTask[]) || []
      const taskInserts = tasks.map((task) => ({
        activated_sop_id: activatedSop.id,
        community_id: communityId,
        title: task.title,
        description: task.description || null,
        task_order: task.order,
        estimated_duration_minutes: task.estimated_duration_minutes || null,
        category: task.category || 'other',
        status: 'pending',
      }))

      if (taskInserts.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: tasksError } = await (supabase as any)
          .from('sop_tasks')
          .insert(taskInserts)

        if (tasksError) throw tasksError
      }

      onActivated(activatedSop.id)
    } catch (err) {
      console.error('Error activating SOP:', err)
      setError(err instanceof Error ? err.message : 'Failed to activate SOP')
    } finally {
      setIsActivating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <span className="material-icons text-red-600 dark:text-red-400">emergency</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Activate Emergency SOP</h2>
              <p className="text-sm text-muted-foreground">Start tracking emergency response tasks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-muted"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="material-icons animate-spin text-2xl text-primary">sync</span>
              <span className="ml-2 text-muted-foreground">Loading response plans...</span>
            </div>
          ) : guides.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
              <span className="material-icons text-4xl text-muted-foreground">checklist</span>
              <p className="mt-2 text-sm text-muted-foreground">
                No response plans have SOP templates defined yet.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add SOP tasks to your response plans first.
              </p>
            </div>
          ) : (
            <>
              {/* Guide Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select Emergency Type
                </label>
                <div className="grid gap-2">
                  {guides.map((guide) => (
                    <button
                      key={guide.id}
                      type="button"
                      onClick={() => setSelectedGuide(guide)}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        selectedGuide?.id === guide.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: guide.color?.startsWith('#') ? guide.color : '#3b82f6' }}
                      >
                        <span className="material-icons text-white">{guide.icon || 'description'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{guide.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(guide.sop_template?.tasks as SOPTemplateTask[])?.length || 0} tasks
                        </p>
                      </div>
                      {selectedGuide?.id === guide.id && (
                        <span className="material-icons text-primary">check_circle</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Event Details */}
              {selectedGuide && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Event Name
                    </label>
                    <input
                      type="text"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      placeholder="e.g., Earthquake Emergency - 15 Dec 2024"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Event Date
                    </label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleActivate}
            disabled={!selectedGuide || isActivating || guides.length === 0}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isActivating ? (
              <>
                <span className="material-icons animate-spin text-lg">sync</span>
                Activating...
              </>
            ) : (
              <>
                <span className="material-icons text-lg">emergency</span>
                Activate SOP
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
