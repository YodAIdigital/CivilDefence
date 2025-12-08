'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { ActivateSOPModal } from './activate-sop-modal'
import { ActiveSOPChecklist } from './active-sop-checklist'
import type { ActivatedSOP } from '@/types/database'

interface DashboardSOPWidgetProps {
  communityId: string
  userId: string
  userRole: 'admin' | 'team_member' | 'member'
}

interface ActivatedSOPWithDetails extends ActivatedSOP {
  guide?: {
    id: string
    name: string
    icon: string
    color: string
    guide_type: string
  }
  tasks_count?: number
  completed_tasks_count?: number
}

export function DashboardSOPWidget({
  communityId,
  userId,
  userRole,
}: DashboardSOPWidgetProps) {
  const [activatedSops, setActivatedSops] = useState<ActivatedSOPWithDetails[]>([])
  const [selectedSopId, setSelectedSopId] = useState<string | null>(null)
  const [showActivateModal, setShowActivateModal] = useState(false)
  const [showArchivedSops, setShowArchivedSops] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const canManageSOP = userRole === 'admin' || userRole === 'team_member'

  // Fetch activated SOPs
  const fetchActivatedSOPs = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('activated_sops')
        .select(`
          *,
          guide:community_guides(id, name, icon, color, guide_type)
        `)
        .eq('community_id', communityId)
        .order('activated_at', { ascending: false })

      if (error) throw error

      // Get task counts for each SOP
      const sopsWithCounts = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data || []).map(async (sop: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { count: totalCount } = await (supabase as any)
            .from('sop_tasks')
            .select('*', { count: 'exact', head: true })
            .eq('activated_sop_id', sop.id)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { count: completedCount } = await (supabase as any)
            .from('sop_tasks')
            .select('*', { count: 'exact', head: true })
            .eq('activated_sop_id', sop.id)
            .eq('status', 'completed')

          return {
            ...sop,
            tasks_count: totalCount || 0,
            completed_tasks_count: completedCount || 0,
          } as ActivatedSOPWithDetails
        })
      )

      setActivatedSops(sopsWithCounts)
    } catch (err) {
      console.error('Error fetching activated SOPs:', err)
    } finally {
      setIsLoading(false)
    }
  }, [communityId])

  useEffect(() => {
    fetchActivatedSOPs()
  }, [fetchActivatedSOPs])

  // Real-time subscription for SOP updates
  useEffect(() => {
    const channel = supabase
      .channel(`activated-sops-${communityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activated_sops',
          filter: `community_id=eq.${communityId}`,
        },
        () => {
          fetchActivatedSOPs()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sop_tasks',
          filter: `community_id=eq.${communityId}`,
        },
        () => {
          fetchActivatedSOPs()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [communityId, fetchActivatedSOPs])

  const activeSops = activatedSops.filter((s) => s.status === 'active')
  const completedSops = activatedSops.filter((s) => s.status === 'completed')
  const archivedSops = activatedSops.filter((s) => s.status === 'archived')

  const handleSOPActivated = (sopId: string) => {
    setShowActivateModal(false)
    setSelectedSopId(sopId)
    fetchActivatedSOPs()
  }

  // If an SOP is selected, show the checklist
  if (selectedSopId) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <button
          onClick={() => setSelectedSopId(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <span className="material-icons text-lg">arrow_back</span>
          Back to SOP Overview
        </button>
        <ActiveSOPChecklist
          activatedSopId={selectedSopId}
          communityId={communityId}
          userId={userId}
          onComplete={() => {
            fetchActivatedSOPs()
          }}
          onArchive={() => {
            setSelectedSopId(null)
            fetchActivatedSOPs()
          }}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-center py-8">
          <span className="material-icons animate-spin text-2xl text-primary">sync</span>
          <span className="ml-2 text-muted-foreground">Loading SOPs...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
            <span className="material-icons text-red-600 dark:text-red-400">checklist</span>
          </div>
          <div>
            <h3 className="font-semibold">Emergency SOPs</h3>
            <p className="text-sm text-muted-foreground">
              Standard Operating Procedures
            </p>
          </div>
        </div>
        {canManageSOP && (
          <button
            onClick={() => setShowActivateModal(true)}
            className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <span className="material-icons text-lg">emergency</span>
            Activate SOP
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Active SOPs */}
        {activeSops.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
              <span className="material-icons text-lg">emergency</span>
              Active Emergency ({activeSops.length})
            </h4>
            {activeSops.map((sop) => {
              const progress = sop.tasks_count
                ? Math.round(((sop.completed_tasks_count || 0) / sop.tasks_count) * 100)
                : 0

              return (
                <button
                  key={sop.id}
                  onClick={() => setSelectedSopId(sop.id)}
                  className="w-full rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-left hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: sop.guide?.color || '#ef4444' }}
                    >
                      <span className="material-icons text-white">
                        {sop.guide?.icon || 'emergency'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{sop.event_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {sop.emergency_type} - {new Date(sop.event_date).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{progress}%</p>
                      <p className="text-xs text-muted-foreground">
                        {sop.completed_tasks_count}/{sop.tasks_count} tasks
                      </p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-2 rounded-full bg-red-200 dark:bg-red-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Completed SOPs */}
        {completedSops.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-2">
              <span className="material-icons text-lg">check_circle</span>
              Completed ({completedSops.length})
            </h4>
            {completedSops.map((sop) => (
              <button
                key={sop.id}
                onClick={() => setSelectedSopId(sop.id)}
                className="w-full rounded-lg border border-border bg-card p-3 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg opacity-75"
                    style={{ backgroundColor: sop.guide?.color || '#22c55e' }}
                  >
                    <span className="material-icons text-white text-sm">
                      {sop.guide?.icon || 'check'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{sop.event_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Completed {sop.completed_at ? new Date(sop.completed_at).toLocaleDateString('en-GB') : ''}
                    </p>
                  </div>
                  <span className="material-icons text-green-500">check_circle</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Archived SOPs Toggle */}
        {archivedSops.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setShowArchivedSops(!showArchivedSops)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <span className="material-icons text-lg">
                {showArchivedSops ? 'expand_less' : 'expand_more'}
              </span>
              <span className="material-icons text-lg">archive</span>
              Archived ({archivedSops.length})
            </button>
            {showArchivedSops && (
              <div className="space-y-2 pl-2">
                {archivedSops.map((sop) => (
                  <button
                    key={sop.id}
                    onClick={() => setSelectedSopId(sop.id)}
                    className="w-full rounded-lg border border-border bg-muted/30 p-2 text-left hover:bg-muted/50 transition-colors opacity-75"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-icons text-muted-foreground text-sm">archive</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{sop.event_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {sop.emergency_type} - {new Date(sop.event_date).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {activatedSops.length === 0 && (
          <div className="text-center py-8">
            <span className="material-icons text-4xl text-muted-foreground">checklist</span>
            <p className="mt-2 text-sm text-muted-foreground">
              No SOPs have been activated yet.
            </p>
            {canManageSOP && (
              <p className="mt-1 text-sm text-muted-foreground">
                Click &quot;Activate SOP&quot; to start tracking an emergency response.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Activate Modal */}
      {showActivateModal && (
        <ActivateSOPModal
          communityId={communityId}
          userId={userId}
          onClose={() => setShowActivateModal(false)}
          onActivated={handleSOPActivated}
        />
      )}
    </div>
  )
}
