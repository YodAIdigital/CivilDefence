'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { useCommunity } from '@/contexts/community-context'
import {
  generateDynamicChecklist,
  getChecklistSummary,
  type ChecklistCategory,
  type ChecklistItem,
  type ResponsePlanSupplies,
} from '@/lib/dynamic-kit-generator'
import type { ProfileExtended, HouseholdMember, CommunityGuide } from '@/types/database'
import { guideTemplates } from '@/data/guide-templates'

type ItemStatus = 'ok' | 'warning' | 'overdue' | 'unchecked'

const CHECKLIST_STORAGE_KEY = 'civildefence_checklist_v2'

// Storage format for checked items
interface StoredChecklistData {
  version: number
  items: Record<string, { checked: boolean; lastChecked?: string }>
  lastUpdated: string
}

function getItemStatus(item: ChecklistItem): ItemStatus {
  if (!item.checked || !item.lastChecked) {
    return 'unchecked'
  }

  const lastChecked = new Date(item.lastChecked)
  const now = new Date()
  const daysSinceCheck = Math.floor((now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60 * 24))
  const daysUntilRecheck = item.recheckDays - daysSinceCheck

  if (daysUntilRecheck < 0) {
    return 'overdue'
  } else if (daysUntilRecheck <= 14) {
    return 'warning'
  }
  return 'ok'
}

function getDaysUntilRecheck(item: ChecklistItem): number | null {
  if (!item.checked || !item.lastChecked) return null

  const lastChecked = new Date(item.lastChecked)
  const now = new Date()
  const daysSinceCheck = Math.floor((now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60 * 24))
  return item.recheckDays - daysSinceCheck
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ChecklistPage() {
  const { user } = useAuth()
  const { activeCommunity } = useCommunity()

  const [checklist, setChecklist] = useState<ChecklistCategory[]>([])
  const [expandedCategories, setExpandedCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([])
  const [profileExtended, setProfileExtended] = useState<ProfileExtended | null>(null)
  const [responsePlans, setResponsePlans] = useState<ResponsePlanSupplies[]>([])
  const [showPersonalizationInfo, setShowPersonalizationInfo] = useState(false)

  // Load stored checklist state from localStorage
  const loadStoredData = useCallback((): StoredChecklistData | null => {
    try {
      const stored = localStorage.getItem(CHECKLIST_STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch {
      // Ignore localStorage errors
    }
    return null
  }, [])

  // Save checklist state to localStorage
  const saveStoredData = useCallback((categories: ChecklistCategory[]) => {
    try {
      const items: Record<string, { checked: boolean; lastChecked?: string }> = {}
      for (const category of categories) {
        for (const item of category.items) {
          if (item.checked && item.lastChecked) {
            items[item.id] = {
              checked: item.checked,
              lastChecked: item.lastChecked,
            }
          }
        }
      }
      const data: StoredChecklistData = {
        version: 2,
        items,
        lastUpdated: new Date().toISOString(),
      }
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  // Apply stored data to generated checklist
  const applyStoredData = useCallback(
    (categories: ChecklistCategory[], storedData: StoredChecklistData | null): ChecklistCategory[] => {
      if (!storedData) return categories

      return categories.map(category => ({
        ...category,
        items: category.items.map(item => {
          const stored = storedData.items[item.id]
          if (stored && stored.lastChecked) {
            return {
              ...item,
              checked: stored.checked,
              lastChecked: stored.lastChecked,
            }
          }
          return item
        }),
      }))
    },
    []
  )

  // Fetch user profile and household data
  const fetchUserData = useCallback(async () => {
    if (!user) return

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', user.id)
        .single()

      if (profile?.notification_preferences) {
        const extended = profile.notification_preferences as ProfileExtended
        setProfileExtended(extended)
        setHouseholdMembers(extended.household_members || [])
      }
    } catch (err) {
      console.error('Error fetching user profile:', err)
    }
  }, [user])

  // Fetch community response plans
  const fetchResponsePlans = useCallback(async () => {
    if (!activeCommunity) {
      setResponsePlans([])
      return
    }

    try {
      const { data: guides } = await (supabase
        .from('community_guides' as 'profiles')
        .select('*')
        .eq('community_id', activeCommunity.id)
        .eq('is_active', true) as unknown as Promise<{ data: CommunityGuide[] | null }>)

      if (guides && guides.length > 0) {
        const plans: ResponsePlanSupplies[] = guides.map(guide => {
          // Get supplies from guide or fallback to template
          let supplies: string[] = []
          const guideAny = guide as unknown as { supplies?: string[]; guide_type?: string }

          if (guideAny.supplies && Array.isArray(guideAny.supplies)) {
            supplies = guideAny.supplies
          } else {
            // Get from template
            const template = guideTemplates.find(t => t.type === guideAny.guide_type)
            if (template) {
              supplies = template.supplies
            }
          }

          // Get the template for name and icon
          const template = guideTemplates.find(t => t.type === guideAny.guide_type)

          return {
            planName: template?.name || guideAny.guide_type || 'Response Plan',
            planType: guideAny.guide_type || 'general',
            planIcon: template?.icon || 'emergency',
            supplies,
          }
        })

        setResponsePlans(plans)
      }
    } catch (err) {
      console.error('Error fetching response plans:', err)
    }
  }, [activeCommunity])

  // Generate and load checklist
  useEffect(() => {
    const loadChecklist = async () => {
      setIsLoading(true)

      await Promise.all([fetchUserData(), fetchResponsePlans()])

      setIsLoading(false)
    }

    loadChecklist()
  }, [fetchUserData, fetchResponsePlans])

  // Generate checklist when data changes
  useEffect(() => {
    if (isLoading) return

    const generated = generateDynamicChecklist(householdMembers, profileExtended, responsePlans)
    const storedData = loadStoredData()
    const withStoredData = applyStoredData(generated, storedData)

    setChecklist(withStoredData)

    // Expand all categories by default
    setExpandedCategories(generated.map(c => c.id))
  }, [isLoading, householdMembers, profileExtended, responsePlans, loadStoredData, applyStoredData])

  // Save when checklist changes
  useEffect(() => {
    if (checklist.length > 0) {
      saveStoredData(checklist)
    }
  }, [checklist, saveStoredData])

  const toggleItem = (categoryId: string, itemId: string) => {
    setChecklist(prev =>
      prev.map(category =>
        category.id === categoryId
          ? {
              ...category,
              items: category.items.map(item => {
                if (item.id !== itemId) return item
                const newChecked = !item.checked
                if (newChecked) {
                  return {
                    ...item,
                    checked: true,
                    lastChecked: new Date().toISOString(),
                  }
                }
                // When unchecking, remove lastChecked
                const { lastChecked: _, ...rest } = item
                return { ...rest, checked: false }
              }),
            }
          : category
      )
    )
  }

  const recheckItem = (categoryId: string, itemId: string) => {
    setChecklist(prev =>
      prev.map(category =>
        category.id === categoryId
          ? {
              ...category,
              items: category.items.map(item => {
                if (item.id !== itemId) return item
                return {
                  ...item,
                  lastChecked: new Date().toISOString(),
                }
              }),
            }
          : category
      )
    )
  }

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const getTotalProgress = () => {
    const allItems = checklist.flatMap(c => c.items)
    const checkedItems = allItems.filter(item => item.checked)
    return { checked: checkedItems.length, total: allItems.length }
  }

  const getCategoryProgress = (category: ChecklistCategory) => {
    const checkedItems = category.items.filter(item => item.checked)
    return { checked: checkedItems.length, total: category.items.length }
  }

  const getAlertCounts = () => {
    const allItems = checklist.flatMap(c => c.items)
    let warnings = 0
    let overdue = 0

    allItems.forEach(item => {
      const status = getItemStatus(item)
      if (status === 'warning') warnings++
      if (status === 'overdue') overdue++
    })

    return { warnings, overdue }
  }

  const getCategoryAlertCounts = (category: ChecklistCategory) => {
    let warnings = 0
    let overdue = 0

    category.items.forEach(item => {
      const status = getItemStatus(item)
      if (status === 'warning') warnings++
      if (status === 'overdue') overdue++
    })

    return { warnings, overdue }
  }

  // Get personalization summary
  const summary = getChecklistSummary(householdMembers, profileExtended, responsePlans)

  const progress = getTotalProgress()
  const progressPercent = progress.total > 0 ? Math.round((progress.checked / progress.total) * 100) : 0
  const alerts = getAlertCounts()

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="material-icons animate-spin text-4xl text-primary">sync</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Emergency Kit Checklist</h1>
        <p className="mt-1 text-muted-foreground">
          Track your emergency supplies and ensure your household is prepared.
        </p>
      </div>

      {/* Personalization Banner */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-icons text-xl text-primary">auto_awesome</span>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Personalized for Your Household</h3>
              <p className="text-sm text-muted-foreground">
                This checklist is customized based on {summary.householdAnalysis.totalPeople} household member{summary.householdAnalysis.totalPeople !== 1 ? 's' : ''}
                {summary.responsePlanCount > 0 && `, ${summary.responsePlanCount} active response plan${summary.responsePlanCount !== 1 ? 's' : ''}`}
                {summary.hasSpecialNeeds && ', and special needs requirements'}.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowPersonalizationInfo(!showPersonalizationInfo)}
            className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
          >
            <span className="material-icons text-lg">{showPersonalizationInfo ? 'expand_less' : 'expand_more'}</span>
            Details
          </button>
        </div>

        {showPersonalizationInfo && (
          <div className="mt-4 pt-4 border-t border-primary/20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Household breakdown */}
            <div className="rounded-lg bg-background/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-icons text-lg text-primary">family_restroom</span>
                <span className="font-medium text-sm">Household</span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {summary.householdAnalysis.adultCount > 0 && (
                  <p>{summary.householdAnalysis.adultCount} adult{summary.householdAnalysis.adultCount !== 1 ? 's' : ''}</p>
                )}
                {summary.householdAnalysis.elderlyCount > 0 && (
                  <p>{summary.householdAnalysis.elderlyCount} elderly (65+)</p>
                )}
                {summary.householdAnalysis.teenCount > 0 && (
                  <p>{summary.householdAnalysis.teenCount} teen{summary.householdAnalysis.teenCount !== 1 ? 's' : ''}</p>
                )}
                {summary.householdAnalysis.childCount > 0 && (
                  <p>{summary.householdAnalysis.childCount} child{summary.householdAnalysis.childCount !== 1 ? 'ren' : ''} (5-12)</p>
                )}
                {summary.householdAnalysis.toddlerCount > 0 && (
                  <p>{summary.householdAnalysis.toddlerCount} toddler{summary.householdAnalysis.toddlerCount !== 1 ? 's' : ''}</p>
                )}
                {summary.householdAnalysis.infantCount > 0 && (
                  <p>{summary.householdAnalysis.infantCount} infant{summary.householdAnalysis.infantCount !== 1 ? 's' : ''}</p>
                )}
              </div>
            </div>

            {/* Response plans */}
            <div className="rounded-lg bg-background/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-icons text-lg text-orange-500">emergency</span>
                <span className="font-medium text-sm">Response Plans</span>
              </div>
              {responsePlans.length > 0 ? (
                <div className="space-y-1 text-xs text-muted-foreground">
                  {responsePlans.map((plan, i) => (
                    <p key={i} className="flex items-center gap-1">
                      <span className="material-icons text-xs">{plan.planIcon}</span>
                      {plan.planName}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No active response plans.
                  {activeCommunity ? ' Check your community guides.' : ' Join a community to see response plans.'}
                </p>
              )}
            </div>

            {/* Special needs */}
            <div className="rounded-lg bg-background/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-icons text-lg text-blue-500">accessible</span>
                <span className="font-medium text-sm">Special Needs</span>
              </div>
              {summary.hasSpecialNeeds ? (
                <p className="text-xs text-muted-foreground">
                  Items added based on your profile&apos;s accessibility settings.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No special needs items. Update your profile to add accessibility requirements.
                </p>
              )}
            </div>

            {/* Item counts */}
            <div className="rounded-lg bg-background/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-icons text-lg text-green-500">inventory_2</span>
                <span className="font-medium text-sm">Total Items</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>{summary.totalItems} total items</p>
                <p>{summary.personalizedItems} personalized items</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Alert Summary */}
      {(alerts.overdue > 0 || alerts.warnings > 0) && (
        <div className="flex flex-wrap gap-3">
          {alerts.overdue > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2">
              <span className="material-icons text-red-500">error</span>
              <span className="text-sm font-medium text-red-700 dark:text-red-300">
                {alerts.overdue} item{alerts.overdue !== 1 ? 's' : ''} overdue for recheck
              </span>
            </div>
          )}
          {alerts.warnings > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-2">
              <span className="material-icons text-amber-500">warning</span>
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {alerts.warnings} item{alerts.warnings !== 1 ? 's' : ''} due for recheck soon
              </span>
            </div>
          )}
        </div>
      )}

      {/* Progress Overview */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <span className="material-icons text-2xl text-primary">inventory_2</span>
            </div>
            <div>
              <h2 className="font-semibold">Overall Progress</h2>
              <p className="text-sm text-muted-foreground">
                {progress.checked} of {progress.total} items collected
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold text-primary">{progressPercent}%</span>
          </div>
        </div>
        <div className="h-3 w-full rounded-full bg-muted">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Checklist Categories */}
      <div className="space-y-4">
        {checklist.map(category => {
          const categoryProgress = getCategoryProgress(category)
          const categoryAlerts = getCategoryAlertCounts(category)
          const isExpanded = expandedCategories.includes(category.id)
          const isComplete = categoryProgress.checked === categoryProgress.total

          return (
            <div
              key={category.id}
              className={`rounded-xl border bg-card transition-all ${
                categoryAlerts.overdue > 0
                  ? 'border-red-500/50'
                  : categoryAlerts.warnings > 0
                    ? 'border-amber-500/50'
                    : isComplete
                      ? 'border-green-500/50'
                      : 'border-border'
              }`}
            >
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="flex w-full items-center justify-between p-4"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      categoryAlerts.overdue > 0
                        ? 'bg-red-500/10'
                        : categoryAlerts.warnings > 0
                          ? 'bg-amber-500/10'
                          : isComplete
                            ? 'bg-green-500/10'
                            : 'bg-primary/10'
                    }`}
                  >
                    <span
                      className={`material-icons text-xl ${
                        categoryAlerts.overdue > 0
                          ? 'text-red-500'
                          : categoryAlerts.warnings > 0
                            ? 'text-amber-500'
                            : isComplete
                              ? 'text-green-500'
                              : 'text-primary'
                      }`}
                    >
                      {categoryAlerts.overdue > 0
                        ? 'error'
                        : categoryAlerts.warnings > 0
                          ? 'warning'
                          : isComplete
                            ? 'check_circle'
                            : category.icon}
                    </span>
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {categoryProgress.checked} of {categoryProgress.total} items
                      {(categoryAlerts.overdue > 0 || categoryAlerts.warnings > 0) && (
                        <span className="ml-2">
                          {categoryAlerts.overdue > 0 && (
                            <span className="text-red-500">({categoryAlerts.overdue} overdue)</span>
                          )}
                          {categoryAlerts.warnings > 0 && categoryAlerts.overdue === 0 && (
                            <span className="text-amber-500">({categoryAlerts.warnings} due soon)</span>
                          )}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <span className="material-icons text-muted-foreground">
                  {isExpanded ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {/* Category Items */}
              {isExpanded && (
                <div className="border-t border-border px-4 pb-4">
                  <div className="mt-3 space-y-2">
                    {category.items.map(item => {
                      const status = getItemStatus(item)
                      const daysUntil = getDaysUntilRecheck(item)

                      return (
                        <div
                          key={item.id}
                          className={`flex items-start gap-3 rounded-lg p-3 transition-colors ${
                            status === 'overdue'
                              ? 'bg-red-50 dark:bg-red-900/10'
                              : status === 'warning'
                                ? 'bg-amber-50 dark:bg-amber-900/10'
                                : item.checked
                                  ? 'bg-green-500/5'
                                  : 'hover:bg-muted'
                          }`}
                        >
                          <label className="flex cursor-pointer items-start gap-3 flex-1">
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={() => toggleItem(category.id, item.id)}
                              className="mt-0.5 h-5 w-5 rounded border-border text-primary focus:ring-primary"
                            />
                            <div className="flex-1">
                              <div className="flex items-start gap-2">
                                <span
                                  className={`text-sm ${
                                    !item.checked ? 'text-foreground' : 'text-foreground'
                                  }`}
                                >
                                  {item.name}
                                </span>
                                {item.priority === 'essential' && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                    Essential
                                  </span>
                                )}
                                {item.source === 'household' && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                    Household
                                  </span>
                                )}
                                {item.source === 'special_needs' && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                    Special Needs
                                  </span>
                                )}
                                {item.source === 'response_plan' && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                                    Response Plan
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {item.description}
                                </p>
                              )}
                              {item.checked && item.lastChecked && (
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                  <span className="text-muted-foreground">
                                    Checked: {formatDate(item.lastChecked)}
                                  </span>
                                  {daysUntil !== null && (
                                    <span className={`font-medium ${
                                      status === 'overdue'
                                        ? 'text-red-600 dark:text-red-400'
                                        : status === 'warning'
                                          ? 'text-amber-600 dark:text-amber-400'
                                          : 'text-green-600 dark:text-green-400'
                                    }`}>
                                      {status === 'overdue'
                                        ? `${Math.abs(daysUntil)} days overdue`
                                        : `Recheck in ${daysUntil} days`}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </label>
                          {item.checked && (
                            <div className="flex items-center gap-2">
                              {(status === 'overdue' || status === 'warning') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    recheckItem(category.id, item.id)
                                  }}
                                  className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                                    status === 'overdue'
                                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                                  }`}
                                >
                                  Mark Rechecked
                                </button>
                              )}
                              <span className={`material-icons text-lg ${
                                status === 'overdue'
                                  ? 'text-red-500'
                                  : status === 'warning'
                                    ? 'text-amber-500'
                                    : 'text-green-500'
                              }`}>
                                {status === 'overdue' ? 'error' : status === 'warning' ? 'warning' : 'check'}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Tips Section */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <span className="material-icons text-xl text-[#FEB100]">lightbulb</span>
          Tips for Your Emergency Kit
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="material-icons text-sm text-primary">arrow_right</span>
            Store your kit in an easily accessible location that all family members know about.
          </li>
          <li className="flex items-start gap-2">
            <span className="material-icons text-sm text-primary">arrow_right</span>
            Items will show amber warnings 2 weeks before recheck is due, and red alerts when overdue.
          </li>
          <li className="flex items-start gap-2">
            <span className="material-icons text-sm text-primary">arrow_right</span>
            Consider having a smaller &quot;grab bag&quot; ready for quick evacuation.
          </li>
          <li className="flex items-start gap-2">
            <span className="material-icons text-sm text-primary">arrow_right</span>
            Keep a basic kit in your car as well as at home.
          </li>
          <li className="flex items-start gap-2">
            <span className="material-icons text-sm text-primary">arrow_right</span>
            Update your <a href="/profile" className="text-primary hover:underline">profile</a> and <a href="/profile" className="text-primary hover:underline">household members</a> to keep this checklist personalized.
          </li>
        </ul>
      </div>
    </div>
  )
}
