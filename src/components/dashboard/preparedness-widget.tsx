'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase/client'
import type { ProfileExtended, ChecklistItem } from '@/types/database'
import Link from 'next/link'

interface PreparednessCategory {
  id: string
  label: string
  icon: string
  weight: number
  completed: number
  total: number
}

const CHECKLIST_STORAGE_KEY = 'civildefence_checklist'

export function PreparednessWidget() {
  const { profile } = useAuth()
  const [categories, setCategories] = useState<PreparednessCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [overallScore, setOverallScore] = useState(0)

  const calculatePreparedness = useCallback(async () => {
    if (!profile) {
      setIsLoading(false)
      return
    }

    const extendedData = profile.notification_preferences as ProfileExtended | null
    const newCategories: PreparednessCategory[] = []

    // 1. Profile Information (weight: 25%)
    // Fields to check (excluding disabilities as per requirement)
    let profileCompleted = 0
    let profileTotal = 0

    // Required fields
    profileTotal += 1 // full_name
    if (profile.full_name) profileCompleted += 1

    profileTotal += 1 // address
    if (extendedData?.address && extendedData?.address_lat) profileCompleted += 1

    profileTotal += 1 // mobile_number
    if (extendedData?.mobile_number || profile.phone) profileCompleted += 1

    // Optional but valuable fields
    profileTotal += 1 // emergency contacts
    if (extendedData?.emergency_contacts && extendedData.emergency_contacts.length > 0) {
      profileCompleted += 1
    }

    newCategories.push({
      id: 'profile',
      label: 'Profile Info',
      icon: 'person',
      weight: 25,
      completed: profileCompleted,
      total: profileTotal,
    })

    // 2. Emergency Supplies (profile preparedness fields) (weight: 25%)
    let suppliesCompleted = 0
    const suppliesTotal = 3

    if (extendedData?.has_backup_power) suppliesCompleted += 1
    if (extendedData?.has_backup_water) suppliesCompleted += 1
    if (extendedData?.has_food_supply) suppliesCompleted += 1

    newCategories.push({
      id: 'supplies',
      label: 'Emergency Supplies',
      icon: 'inventory_2',
      weight: 25,
      completed: suppliesCompleted,
      total: suppliesTotal,
    })

    // 3. Emergency Kit Checklist (weight: 35%)
    let checklistCompleted = 0
    let checklistTotal = 0

    // First try to get from database
    try {
      const { data: userChecklists } = await supabase
        .from('user_checklists')
        .select('*')
        .eq('user_id', profile.id)
        .single()

      if (userChecklists) {
        const items = userChecklists.items as unknown as ChecklistItem[]
        if (Array.isArray(items)) {
          checklistTotal = items.length
          checklistCompleted = items.filter(item => item.completed).length
        }
      }
    } catch {
      // Ignore database errors
    }

    // Also check localStorage for checklist data
    if (typeof window !== 'undefined' && checklistTotal === 0) {
      try {
        const stored = localStorage.getItem(CHECKLIST_STORAGE_KEY)
        if (stored) {
          const checklistData = JSON.parse(stored)
          if (Array.isArray(checklistData)) {
            checklistData.forEach((category: { items: { checked: boolean }[] }) => {
              if (category.items && Array.isArray(category.items)) {
                category.items.forEach((item: { checked: boolean }) => {
                  checklistTotal += 1
                  if (item.checked) checklistCompleted += 1
                })
              }
            })
          }
        }
      } catch {
        // Ignore localStorage errors
      }
    }

    // If no checklist data, use default total of 43 items (from checklist page)
    if (checklistTotal === 0) {
      checklistTotal = 43
    }

    newCategories.push({
      id: 'checklist',
      label: 'Emergency Kit',
      icon: 'checklist',
      weight: 35,
      completed: checklistCompleted,
      total: checklistTotal,
    })

    // 4. Community Membership (weight: 15%)
    let communityCompleted = 0
    const communityTotal = 1 // At least one community

    try {
      const { count } = await supabase
        .from('community_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)

      if (count && count > 0) {
        communityCompleted = 1
      }
    } catch {
      // Ignore errors
    }

    newCategories.push({
      id: 'community',
      label: 'Community',
      icon: 'groups',
      weight: 15,
      completed: communityCompleted,
      total: communityTotal,
    })

    setCategories(newCategories)

    // Calculate overall weighted score
    const totalScore = newCategories.reduce((acc, cat) => {
      const categoryPercent = cat.total > 0 ? (cat.completed / cat.total) * 100 : 0
      return acc + (categoryPercent * cat.weight) / 100
    }, 0)

    setOverallScore(Math.round(totalScore))
    setIsLoading(false)
  }, [profile])

  useEffect(() => {
    calculatePreparedness()
  }, [calculatePreparedness])

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500'
    if (score >= 50) return 'text-amber-500'
    return 'text-red-500'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Well Prepared'
    if (score >= 50) return 'Partially Prepared'
    return 'Needs Attention'
  }

  const getProgressColor = (completed: number, total: number) => {
    const percent = total > 0 ? (completed / total) * 100 : 0
    if (percent >= 80) return 'bg-green-500'
    if (percent >= 50) return 'bg-amber-500'
    return 'bg-red-500'
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-card p-5 shadow-sm">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="material-icons text-primary">verified</span>
          Preparedness Score
        </h3>
        <div className="flex items-center justify-center py-8">
          <span className="material-icons animate-spin text-2xl text-primary">sync</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="material-icons text-primary">verified</span>
          Preparedness
        </h3>
        <span className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
          {overallScore}%
        </span>
      </div>

      {/* Overall progress bar */}
      <div className="mb-2">
        <div className="h-2.5 w-full rounded-full bg-muted">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${
              overallScore >= 80 ? 'bg-green-500' : overallScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${overallScore}%` }}
          />
        </div>
        <p className={`text-xs mt-1 ${getScoreColor(overallScore)}`}>
          {getScoreLabel(overallScore)}
        </p>
      </div>

      {/* Category breakdown */}
      <div className="mt-4 space-y-3">
        {categories.map((cat) => {
          const percent = cat.total > 0 ? Math.round((cat.completed / cat.total) * 100) : 0
          return (
            <div key={cat.id} className="group">
              <div className="flex items-center justify-between text-sm mb-1">
                <div className="flex items-center gap-2">
                  <span className="material-icons text-sm text-muted-foreground">{cat.icon}</span>
                  <span className="text-muted-foreground">{cat.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {cat.completed}/{cat.total}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${getProgressColor(cat.completed, cat.total)}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Action buttons */}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Link
          href="/profile"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          <span className="material-icons text-sm">person</span>
          Profile
        </Link>
        <Link
          href="/checklist"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          <span className="material-icons text-sm">checklist</span>
          Checklist
        </Link>
      </div>
    </div>
  )
}
