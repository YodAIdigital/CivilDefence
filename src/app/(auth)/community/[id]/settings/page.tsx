'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { CommunityLocationsManager } from '@/components/maps/community-locations-manager'
import { RegionEditor } from '@/components/maps/region-editor'
import { Mail, Bell, AlertTriangle, AlertCircle, Info, CheckCircle, MessageSquare, ChevronDown, Webhook, Copy, Trash2, Edit2, ToggleLeft, ToggleRight, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Community, Profile, CommunityRole, CommunityMapPoint, CreateCommunityMapPoint, UpdateCommunityMapPoint, Json, RegionPolygon, CommunityAlertRule, RuleRecipientGroup, CommunityGroup } from '@/types/database'
import { ALERT_RULE_LEVEL_CONFIG, RULE_RECIPIENT_CONFIG } from '@/types/database'

interface CommunityMemberWithProfile {
  id: string
  user_id: string
  community_id: string
  role: CommunityRole
  joined_at: string
  profile: Profile | null
}

type AlertLevel = 'info' | 'warning' | 'danger'

const ALERT_LEVEL_CONFIG = {
  info: {
    label: 'General Announcement',
    description: 'Shown as a green alert',
    color: '#22c55e',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    icon: Info,
  },
  warning: {
    label: 'Warning',
    description: 'Shown as an amber alert',
    color: '#f59e0b',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    icon: AlertTriangle,
  },
  danger: {
    label: 'Emergency',
    description: 'Shown as a red alert',
    color: '#ef4444',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: AlertCircle,
  },
} as const

export default function CommunitySettingsPage() {
  const params = useParams()
  const communityId = params?.id as string
  const { user } = useAuth()

  const [community, setCommunity] = useState<Community | null>(null)
  const [members, setMembers] = useState<CommunityMemberWithProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [mapPoints, setMapPoints] = useState<CommunityMapPoint[]>([])
  const [isSavingMapPoints, setIsSavingMapPoints] = useState(false)
  const [isSavingRegion, setIsSavingRegion] = useState(false)

  // Alert history state
  interface AlertHistoryItem {
    id: string
    title: string
    content: string
    level: string
    created_at: string
    author_id: string
    sent_via_email: boolean
    sent_via_sms: boolean
    sent_via_app: boolean
    recipient_count: number
    email_sent_count: number
    sms_sent_count: number
    recipient_group: string
    author?: {
      full_name: string | null
      email: string | null
    }
  }
  const [alertHistory, setAlertHistory] = useState<AlertHistoryItem[]>([])

  // Community editing state
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editedDescription, setEditedDescription] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)
  const [isSavingDescription, setIsSavingDescription] = useState(false)

  // Alert rules state
  const [alertRules, setAlertRules] = useState<CommunityAlertRule[]>([])
  const [isLoadingRules, setIsLoadingRules] = useState(false)
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [editingRule, setEditingRule] = useState<CommunityAlertRule | null>(null)
  const [isSavingRule, setIsSavingRule] = useState(false)

  // Rule form state
  const [ruleName, setRuleName] = useState('')
  const [ruleDescription, setRuleDescription] = useState('')
  const [ruleAlertTitle, setRuleAlertTitle] = useState('')
  const [ruleAlertMessage, setRuleAlertMessage] = useState('')
  const [ruleAlertLevel, setRuleAlertLevel] = useState<'info' | 'warning' | 'danger'>('info')
  const [ruleRecipientGroup, setRuleRecipientGroup] = useState<RuleRecipientGroup>('members')
  const [ruleSelectedMembers, setRuleSelectedMembers] = useState<string[]>([])
  const [ruleSelectedGroups, setRuleSelectedGroups] = useState<string[]>([])
  const [ruleSendEmail, setRuleSendEmail] = useState(true)
  const [ruleSendSms, setRuleSendSms] = useState(false)
  const [ruleSendAppNotification, setRuleSendAppNotification] = useState(true)
  const [communityGroups, setCommunityGroups] = useState<CommunityGroup[]>([])

  // Collapsible section states - all collapsed by default
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    'alert-rules': true,
    'alert-history': true,
    'community-details': true,
    'region': true,
    'locations': true,
    'create-rule': true,
    'rules-list': true,
  })

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  const fetchData = useCallback(async () => {
    if (!user || !communityId) return

    try {
      setIsLoading(true)

      // Fetch community details
      const { data: communityData, error: communityError } = await supabase
        .from('communities')
        .select('*')
        .eq('id', communityId)
        .single()

      if (communityError) throw communityError
      setCommunity(communityData)

      // Fetch map points
      const { data: mapPointsData } = await (supabase
        .from('community_map_points' as 'profiles')
        .select('*')
        .eq('community_id', communityId)
        .order('display_order', { ascending: true }) as unknown as Promise<{ data: CommunityMapPoint[] | null; error: Error | null }>)

      if (mapPointsData) {
        setMapPoints(mapPointsData)
      }

      // Check if current user is admin of this community
      const { data: membershipData, error: membershipError } = await supabase
        .from('community_members')
        .select('role')
        .eq('community_id', communityId)
        .eq('user_id', user.id)
        .single()

      if (membershipError) {
        setIsAdmin(false)
        return
      }

      const userIsAdmin = membershipData.role === 'admin' || membershipData.role === 'super_admin'
      setIsAdmin(userIsAdmin)

      if (!userIsAdmin) return

      // Fetch all community members with their profiles
      const { data: membersData, error: membersError } = await supabase
        .from('community_members')
        .select(`
          id,
          user_id,
          community_id,
          role,
          joined_at
        `)
        .eq('community_id', communityId)
        .order('joined_at', { ascending: true })

      if (membersError) throw membersError

      // Fetch profiles for all members
      const userIds = membersData.map(m => m.user_id)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)

      if (profilesError) throw profilesError

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || [])

      const membersWithProfiles: CommunityMemberWithProfile[] = membersData.map(m => ({
        ...m,
        role: m.role as CommunityRole,
        profile: profilesMap.get(m.user_id) || null
      }))

      setMembers(membersWithProfiles)

      // Fetch alert history
      try {
        const { data: alertsData } = await supabase
          .from('alerts')
          .select(`
            id,
            title,
            content,
            level,
            created_at,
            author_id,
            sent_via_email,
            sent_via_sms,
            sent_via_app,
            recipient_count,
            email_sent_count,
            sms_sent_count,
            recipient_group
          `)
          .eq('community_id', communityId)
          .order('created_at', { ascending: false })
          .limit(50)

        if (alertsData && alertsData.length > 0) {
          // Fetch author profiles
          const authorIds = Array.from(new Set(alertsData.map(a => a.author_id)))
          const { data: authorsData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', authorIds)

          const authorsMap = new Map(authorsData?.map(a => [a.id, a]) || [])

          const alertsWithAuthors = alertsData.map(alert => ({
            ...alert,
            sent_via_email: alert.sent_via_email ?? false,
            sent_via_sms: alert.sent_via_sms ?? false,
            sent_via_app: alert.sent_via_app ?? true,
            recipient_count: alert.recipient_count ?? 0,
            email_sent_count: alert.email_sent_count ?? 0,
            sms_sent_count: alert.sms_sent_count ?? 0,
            recipient_group: alert.recipient_group ?? 'members',
            author: authorsMap.get(alert.author_id) || null,
          }))

          setAlertHistory(alertsWithAuthors as AlertHistoryItem[])
        }
      } catch {
        console.log('Could not fetch alert history')
      }

      // Fetch community groups
      try {
        const { data: groupsData } = await supabase
          .from('community_groups')
          .select('*')
          .eq('community_id', communityId)
          .order('name', { ascending: true })

        if (groupsData) {
          setCommunityGroups(groupsData as CommunityGroup[])
        }
      } catch {
        console.log('Could not fetch groups')
      }
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load community data')
    } finally {
      setIsLoading(false)
    }
  }, [user, communityId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Fetch alert rules
  const fetchAlertRules = useCallback(async () => {
    if (!user || !communityId) return

    try {
      setIsLoadingRules(true)
      const response = await fetch(`/api/alert-rules?communityId=${communityId}&userId=${user.id}`)

      if (!response.ok) {
        return
      }

      const data = await response.json()

      if (data.rules) {
        setAlertRules(data.rules)
      }
    } catch (err) {
      console.error('Error fetching alert rules:', err)
    } finally {
      setIsLoadingRules(false)
    }
  }, [user, communityId])

  useEffect(() => {
    if (alertRules.length === 0) {
      fetchAlertRules()
    }
  }, [alertRules.length, fetchAlertRules])

  // Reset rule form
  const resetRuleForm = () => {
    setRuleName('')
    setRuleDescription('')
    setRuleAlertTitle('')
    setRuleAlertMessage('')
    setRuleAlertLevel('info')
    setRuleRecipientGroup('members')
    setRuleSelectedMembers([])
    setRuleSelectedGroups([])
    setRuleSendEmail(true)
    setRuleSendSms(false)
    setRuleSendAppNotification(true)
    setEditingRule(null)
  }

  // Open rule modal for editing
  const openEditRuleModal = (rule: CommunityAlertRule) => {
    setEditingRule(rule)
    setRuleName(rule.name)
    setRuleDescription(rule.description || '')
    setRuleAlertTitle(rule.alert_title)
    setRuleAlertMessage(rule.alert_message)
    setRuleAlertLevel(rule.alert_level)
    setRuleRecipientGroup(rule.recipient_group)
    setRuleSelectedMembers(rule.specific_member_ids || [])
    setRuleSelectedGroups((rule as unknown as { target_group_ids?: string[] }).target_group_ids || [])
    setRuleSendEmail(rule.send_email)
    setRuleSendSms(rule.send_sms)
    setRuleSendAppNotification(rule.send_app_notification)
    setShowRuleModal(true)
  }

  // Save rule (create or update)
  const handleSaveRule = async () => {
    if (!ruleName.trim() || !ruleAlertTitle.trim() || !ruleAlertMessage.trim()) {
      setError('Please fill in all required fields')
      return
    }

    if (ruleRecipientGroup === 'specific' && ruleSelectedMembers.length === 0) {
      setError('Please select at least one member')
      return
    }

    try {
      setIsSavingRule(true)
      setError(null)

      if (editingRule) {
        const response = await fetch(`/api/alert-rules/${editingRule.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id,
            name: ruleName,
            description: ruleDescription,
            alertTitle: ruleAlertTitle,
            alertMessage: ruleAlertMessage,
            alertLevel: ruleAlertLevel,
            recipientGroup: ruleRecipientGroup,
            specificMemberIds: ruleRecipientGroup === 'specific' ? ruleSelectedMembers : [],
            targetGroupIds: ruleRecipientGroup === 'groups' ? ruleSelectedGroups : [],
            sendEmail: ruleSendEmail,
            sendSms: ruleSendSms,
            sendAppNotification: ruleSendAppNotification,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to update rule')
        }

        setSuccess('Rule updated successfully')
      } else {
        const response = await fetch('/api/alert-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            communityId,
            userId: user?.id,
            name: ruleName,
            description: ruleDescription,
            alertTitle: ruleAlertTitle,
            alertMessage: ruleAlertMessage,
            alertLevel: ruleAlertLevel,
            recipientGroup: ruleRecipientGroup,
            specificMemberIds: ruleRecipientGroup === 'specific' ? ruleSelectedMembers : [],
            targetGroupIds: ruleRecipientGroup === 'groups' ? ruleSelectedGroups : [],
            sendEmail: ruleSendEmail,
            sendSms: ruleSendSms,
            sendAppNotification: ruleSendAppNotification,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to create rule')
        }

        setSuccess('Rule created successfully')
      }

      setShowRuleModal(false)
      resetRuleForm()
      await fetchAlertRules()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error saving rule:', err)
      setError(err instanceof Error ? err.message : 'Failed to save rule')
    } finally {
      setIsSavingRule(false)
    }
  }

  // Toggle rule active status
  const toggleRuleActive = async (rule: CommunityAlertRule) => {
    try {
      setError(null)
      const response = await fetch(`/api/alert-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          isActive: !rule.is_active,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update rule')
      }

      setSuccess(`Rule ${rule.is_active ? 'disabled' : 'enabled'}`)
      await fetchAlertRules()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error toggling rule:', err)
      setError(err instanceof Error ? err.message : 'Failed to update rule')
    }
  }

  // Delete rule
  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule? This action cannot be undone.')) return

    try {
      setError(null)
      const response = await fetch(`/api/alert-rules/${ruleId}?userId=${user?.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete rule')
      }

      setSuccess('Rule deleted successfully')
      await fetchAlertRules()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error deleting rule:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete rule')
    }
  }

  // Copy webhook URL to clipboard
  const copyWebhookUrl = async (token: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const webhookUrl = `${baseUrl}/api/alert-rules/trigger/webhook?token=${token}`

    try {
      await navigator.clipboard.writeText(webhookUrl)
      setSuccess('Webhook URL copied to clipboard')
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setError('Failed to copy to clipboard')
    }
  }

  // Toggle member selection for rules
  const toggleRuleMemberSelection = (userId: string) => {
    setRuleSelectedMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const toggleRuleGroupSelection = (groupId: string) => {
    setRuleSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
  }

  const toggleVisibility = async () => {
    if (!community) return

    try {
      setError(null)

      const { error } = await supabase
        .from('communities')
        .update({ is_public: !community.is_public })
        .eq('id', community.id)

      if (error) throw error

      setCommunity({ ...community, is_public: !community.is_public })
      setSuccess(`Community is now ${!community.is_public ? 'public' : 'private'}`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error updating visibility:', err)
      setError('Failed to update community visibility')
    }
  }

  const saveCommunityName = async () => {
    if (!community || !editedName.trim()) return

    try {
      setIsSavingName(true)
      setError(null)

      const { error } = await supabase
        .from('communities')
        .update({ name: editedName.trim() })
        .eq('id', community.id)

      if (error) throw error

      setCommunity({ ...community, name: editedName.trim() })
      setIsEditingName(false)
      setSuccess('Community name updated successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error updating community name:', err)
      setError('Failed to update community name')
    } finally {
      setIsSavingName(false)
    }
  }

  const saveCommunityDescription = async () => {
    if (!community) return

    try {
      setIsSavingDescription(true)
      setError(null)

      const { error } = await supabase
        .from('communities')
        .update({ description: editedDescription.trim() || null })
        .eq('id', community.id)

      if (error) throw error

      setCommunity({ ...community, description: editedDescription.trim() || null })
      setIsEditingDescription(false)
      setSuccess('Community description updated successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error updating community description:', err)
      setError('Failed to update community description')
    } finally {
      setIsSavingDescription(false)
    }
  }

  const saveRegion = async (polygon: RegionPolygon | null, color: string, opacity: number) => {
    if (!community) return

    try {
      setIsSavingRegion(true)
      setError(null)

      const { error } = await supabase
        .from('communities')
        .update({
          region_polygon: polygon as unknown as Json,
          region_color: color,
          region_opacity: opacity,
        })
        .eq('id', community.id)

      if (error) throw error

      setCommunity({
        ...community,
        region_polygon: polygon as unknown as Json,
        region_color: color,
        region_opacity: opacity,
      } as Community)
      setSuccess(polygon ? 'Community region saved successfully' : 'Community region cleared')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error saving region:', err)
      setError('Failed to save community region')
    } finally {
      setIsSavingRegion(false)
    }
  }

  const addMapPoint = async (point: CreateCommunityMapPoint) => {
    try {
      setIsSavingMapPoints(true)
      setError(null)

      const pointData = { ...point }

      const supabaseAny = supabase as unknown as { from: (table: string) => { insert: (data: unknown) => { select: () => { single: () => Promise<{ data: CommunityMapPoint | null; error: { message: string; code?: string } | null }> } } } }
      const { data, error } = await supabaseAny
        .from('community_map_points')
        .insert(pointData)
        .select()
        .single()

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(error.message || 'Database error')
      }
      if (data) {
        setMapPoints(prev => [...prev, data])
      }

      setSuccess('Map point added successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error adding map point:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to add map point'
      setError(errorMessage)
    } finally {
      setIsSavingMapPoints(false)
    }
  }

  const updateMapPoint = async (id: string, point: UpdateCommunityMapPoint) => {
    try {
      setIsSavingMapPoints(true)
      setError(null)

      const supabaseAny = supabase as unknown as { from: (table: string) => { update: (data: unknown) => { eq: (col: string, val: string) => { select: () => { single: () => Promise<{ data: CommunityMapPoint | null; error: Error | null }> } } } } }
      const { data, error } = await supabaseAny
        .from('community_map_points')
        .update(point)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      if (data) {
        setMapPoints(prev => prev.map(p => p.id === id ? data : p))
      }

      setSuccess('Map point updated successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error updating map point:', err)
      setError('Failed to update map point')
    } finally {
      setIsSavingMapPoints(false)
    }
  }

  const deleteMapPoint = async (id: string) => {
    try {
      setIsSavingMapPoints(true)
      setError(null)

      const supabaseAny = supabase as unknown as { from: (table: string) => { delete: () => { eq: (col: string, val: string) => Promise<{ error: Error | null }> } } }
      const { error } = await supabaseAny
        .from('community_map_points')
        .delete()
        .eq('id', id)

      if (error) throw error

      setMapPoints(prev => prev.filter(p => p.id !== id))
      setSuccess('Map point deleted successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error deleting map point:', err)
      setError('Failed to delete map point')
    } finally {
      setIsSavingMapPoints(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="material-icons animate-spin text-4xl text-primary">sync</span>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center">
        <span className="material-icons text-6xl text-destructive">block</span>
        <h1 className="mt-4 text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">
          You must be a community admin to access this page.
        </p>
        <Link
          href="/community"
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Back to Communities
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/community" className="hover:text-foreground">Communities</Link>
          <span className="material-icons text-sm">chevron_right</span>
          <Link href={`/community/${communityId}/manage`} className="hover:text-foreground">{community?.name}</Link>
          <span className="material-icons text-sm">chevron_right</span>
          <span>Settings</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Community Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Configure alert rules, community details, and map settings.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-500/30 bg-green-50 p-4 text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Alert Rules Section */}
      <div className="rounded-xl border border-border bg-card">
        <button
          onClick={() => toggleSection('alert-rules')}
          className="w-full border-b border-border p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="text-left">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className="material-icons text-purple-500">bolt</span>
              Alert Rules
            </h2>
            <p className="text-sm text-muted-foreground">
              Set up automated alerts triggered by webhooks or emails
            </p>
          </div>
          <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${collapsedSections['alert-rules'] ? '-rotate-90' : ''}`} />
        </button>
        <div className={`overflow-hidden transition-all duration-300 ${collapsedSections['alert-rules'] ? 'max-h-0' : 'max-h-[5000px]'}`}>
          <div className="p-4 space-y-6">
            {/* Create New Rule Sub-Section */}
            <div className="rounded-lg border border-border bg-muted/30">
              <button
                onClick={() => toggleSection('create-rule')}
                className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-lg"
              >
                <div className="flex items-center gap-2 text-left">
                  <span className="material-icons text-[#FEB100]">add_circle</span>
                  <span className="font-medium">Create New Rule</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${collapsedSections['create-rule'] ? '-rotate-90' : ''}`} />
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${collapsedSections['create-rule'] ? 'max-h-0' : 'max-h-[2500px]'}`}>
                <div className="p-4 pt-0 space-y-4">
                  {/* Rule Name */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Rule Name *</label>
                    <Input
                      placeholder="e.g., Weather Alert, System Notification"
                      value={ruleName}
                      onChange={(e) => setRuleName(e.target.value)}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      placeholder="Describe what triggers this rule..."
                      value={ruleDescription}
                      onChange={(e) => setRuleDescription(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                  </div>

                  {/* Alert Level */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Alert Level</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['info', 'warning', 'danger'] as const).map((level) => {
                        const config = ALERT_RULE_LEVEL_CONFIG[level]
                        const isSelected = ruleAlertLevel === level
                        return (
                          <button
                            key={level}
                            onClick={() => setRuleAlertLevel(level)}
                            className={`p-2 rounded-lg border text-left transition-all ${
                              isSelected
                                ? `${config.bgColor} ${config.borderColor}`
                                : 'border-border hover:border-primary/30'
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              {level === 'info' && <Info className="h-3 w-3" style={{ color: config.color }} />}
                              {level === 'warning' && <AlertTriangle className="h-3 w-3" style={{ color: config.color }} />}
                              {level === 'danger' && <AlertCircle className="h-3 w-3" style={{ color: config.color }} />}
                              <span className="font-medium text-xs">{config.label}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Alert Title */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Alert Title *</label>
                    <Input
                      placeholder="Title of the alert that will be sent"
                      value={ruleAlertTitle}
                      onChange={(e) => setRuleAlertTitle(e.target.value)}
                    />
                  </div>

                  {/* Alert Message */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Alert Message *</label>
                    <textarea
                      placeholder="The message content that will be sent to recipients..."
                      value={ruleAlertMessage}
                      onChange={(e) => setRuleAlertMessage(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                  </div>

                  {/* Recipients */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Send To</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['admin', 'team', 'members', 'groups', 'specific'] as RuleRecipientGroup[]).map((group) => {
                        const config = RULE_RECIPIENT_CONFIG[group]
                        const isSelected = ruleRecipientGroup === group
                        return (
                          <button
                            key={group}
                            onClick={() => setRuleRecipientGroup(group)}
                            className={`p-2 rounded-lg border text-left transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/30'
                            }`}
                          >
                            <span className="font-medium text-xs">{config.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Group Selection for 'groups' */}
                  {ruleRecipientGroup === 'groups' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Select Groups ({ruleSelectedGroups.length} selected)
                      </label>
                      {communityGroups.filter(g => g.is_active && g.member_count > 0).length === 0 ? (
                        <div className="border border-border rounded-lg p-3 text-center text-muted-foreground text-xs">
                          <Users className="h-6 w-6 mx-auto mb-1 opacity-50" />
                          <p>No groups with members available.</p>
                        </div>
                      ) : (
                        <div className="border border-border rounded-lg max-h-32 overflow-y-auto">
                          {communityGroups.filter(g => g.is_active && g.member_count > 0).map((group) => {
                            const isSelected = ruleSelectedGroups.includes(group.id)
                            return (
                              <button
                                key={group.id}
                                onClick={() => toggleRuleGroupSelection(group.id)}
                                className={`w-full flex items-center gap-2 p-2 text-left hover:bg-muted/50 border-b border-border last:border-b-0 ${
                                  isSelected ? 'bg-primary/5' : ''
                                }`}
                              >
                                <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                                  isSelected ? 'bg-primary border-primary' : 'border-border'
                                }`}>
                                  {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                                </div>
                                <span className="material-icons text-sm" style={{ color: group.color }}>
                                  {group.icon}
                                </span>
                                <span className="text-sm truncate flex-1">{group.name}</span>
                                <span className="text-xs text-muted-foreground">{group.member_count}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Member Selection for 'specific' */}
                  {ruleRecipientGroup === 'specific' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Select Members ({ruleSelectedMembers.length} selected)
                      </label>
                      <div className="border border-border rounded-lg max-h-32 overflow-y-auto">
                        {members.map((member) => {
                          const isSelected = ruleSelectedMembers.includes(member.user_id)
                          return (
                            <button
                              key={member.id}
                              onClick={() => toggleRuleMemberSelection(member.user_id)}
                              className={`w-full flex items-center gap-2 p-2 text-left hover:bg-muted/50 border-b border-border last:border-b-0 ${
                                isSelected ? 'bg-primary/5' : ''
                              }`}
                            >
                              <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                                isSelected ? 'bg-primary border-primary' : 'border-border'
                              }`}>
                                {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                              </div>
                              <span className="text-sm truncate">
                                {member.profile?.full_name || member.profile?.email || 'Unknown'}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Delivery Options */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Delivery Methods</label>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ruleSendAppNotification}
                          onChange={(e) => setRuleSendAppNotification(e.target.checked)}
                          className="h-4 w-4 rounded border-border"
                        />
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">App</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ruleSendEmail}
                          onChange={(e) => setRuleSendEmail(e.target.checked)}
                          className="h-4 w-4 rounded border-border"
                        />
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Email</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ruleSendSms}
                          onChange={(e) => setRuleSendSms(e.target.checked)}
                          className="h-4 w-4 rounded border-border"
                        />
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">SMS</span>
                      </label>
                    </div>
                  </div>

                  {/* Create Button */}
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleSaveRule}
                      disabled={isSavingRule || !ruleName.trim() || !ruleAlertTitle.trim() || !ruleAlertMessage.trim()}
                      size="sm"
                      className="gap-2"
                    >
                      {isSavingRule ? (
                        <>
                          <span className="material-icons animate-spin text-lg">sync</span>
                          Creating...
                        </>
                      ) : (
                        <>
                          <span className="material-icons text-lg">add</span>
                          Create Rule
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Rules Sub-Section */}
            <div className="rounded-lg border border-border bg-muted/30">
              <button
                onClick={() => toggleSection('rules-list')}
                className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-lg"
              >
                <div className="flex items-center gap-2 text-left">
                  <span className="material-icons text-muted-foreground">rule</span>
                  <span className="font-medium">Active Rules ({alertRules.length})</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${collapsedSections['rules-list'] ? '-rotate-90' : ''}`} />
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${collapsedSections['rules-list'] ? 'max-h-0' : 'max-h-[2000px]'}`}>
                <div className="divide-y divide-border">
                  {isLoadingRules ? (
                    <div className="p-6 text-center">
                      <span className="material-icons animate-spin text-3xl text-muted-foreground">sync</span>
                      <p className="mt-2 text-sm text-muted-foreground">Loading rules...</p>
                    </div>
                  ) : alertRules.length === 0 ? (
                    <div className="p-6 text-center">
                      <span className="material-icons text-3xl text-muted-foreground">bolt</span>
                      <p className="mt-2 text-sm text-muted-foreground">No rules created yet.</p>
                    </div>
                  ) : (
                    alertRules.map((rule) => {
                      const levelConfig = ALERT_RULE_LEVEL_CONFIG[rule.alert_level as keyof typeof ALERT_RULE_LEVEL_CONFIG] || ALERT_RULE_LEVEL_CONFIG.info
                      const recipientConfig = RULE_RECIPIENT_CONFIG[rule.recipient_group as keyof typeof RULE_RECIPIENT_CONFIG] || RULE_RECIPIENT_CONFIG.members

                      return (
                        <div key={rule.id} className={`p-3 ${!rule.is_active ? 'opacity-60' : ''}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-sm truncate">{rule.name}</h4>
                                {!rule.is_active && (
                                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                    Disabled
                                  </span>
                                )}
                              </div>

                              {/* Alert Preview */}
                              <div className={`rounded-md p-2 mb-2 ${levelConfig.bgColor} ${levelConfig.borderColor} border`}>
                                <div className="flex items-center gap-1 mb-0.5">
                                  {rule.alert_level === 'info' && <Info className="h-3 w-3" style={{ color: levelConfig.color }} />}
                                  {rule.alert_level === 'warning' && <AlertTriangle className="h-3 w-3" style={{ color: levelConfig.color }} />}
                                  {rule.alert_level === 'danger' && <AlertCircle className="h-3 w-3" style={{ color: levelConfig.color }} />}
                                  <span className="font-medium text-xs" style={{ color: levelConfig.color }}>
                                    {rule.alert_title}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-1">{rule.alert_message}</p>
                              </div>

                              {/* Rule Info */}
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <span className="material-icons text-xs">group</span>
                                  {recipientConfig.label}
                                </span>
                                <span>•</span>
                                <span>{rule.trigger_count} triggers</span>
                              </div>

                              {/* Triggers */}
                              <div className="mt-2 space-y-2">
                                {/* Webhook URL */}
                                <div className="flex items-center gap-2">
                                  <Webhook className="h-3 w-3 text-purple-500 shrink-0" />
                                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate max-w-[200px]">
                                    ...?token={rule.webhook_token.substring(0, 8)}...
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyWebhookUrl(rule.webhook_token)}
                                    className="h-6 px-2"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>

                                {/* Email Trigger */}
                                {rule.trigger_email && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-3 w-3 text-blue-500 shrink-0" />
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate max-w-[200px]">{rule.trigger_email}</code>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        navigator.clipboard.writeText(rule.trigger_email || '')
                                        setSuccess('Email address copied!')
                                        setTimeout(() => setSuccess(null), 2000)
                                      }}
                                      className="h-6 px-2"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={() => toggleRuleActive(rule)}
                                className="p-1.5 hover:bg-muted rounded transition-colors"
                                title={rule.is_active ? 'Disable rule' : 'Enable rule'}
                              >
                                {rule.is_active ? (
                                  <ToggleRight className="h-4 w-4 text-green-500" />
                                ) : (
                                  <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                                )}
                              </button>
                              <button
                                onClick={() => openEditRuleModal(rule)}
                                className="p-1.5 hover:bg-muted rounded transition-colors"
                                title="Edit rule"
                              >
                                <Edit2 className="h-3 w-3 text-muted-foreground" />
                              </button>
                              <button
                                onClick={() => deleteRule(rule.id)}
                                className="p-1.5 hover:bg-muted rounded transition-colors"
                                title="Delete rule"
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Help Text */}
            <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">How Alert Rules Work</p>
              <p>Each rule provides both webhook and email trigger options:</p>
              <p className="mt-1"><strong>Webhook:</strong> Send a POST request to the webhook URL to trigger the alert.</p>
              <p className="mt-1"><strong>Email:</strong> Forward emails to the trigger address @civildefence.pro. Use <code className="px-1 py-0.5 rounded bg-muted">[WARNING]</code> or <code className="px-1 py-0.5 rounded bg-muted">[EMERGENCY]</code> in the subject to set alert level.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alert History Section */}
      <div className="rounded-xl border border-border bg-card">
        <button
          onClick={() => toggleSection('alert-history')}
          className="w-full border-b border-border p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="text-left">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className="material-icons text-muted-foreground">history</span>
              Alert History
            </h2>
            <p className="text-sm text-muted-foreground">
              Previously sent alerts to this community.
            </p>
          </div>
          <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${collapsedSections['alert-history'] ? '-rotate-90' : ''}`} />
        </button>
        <div className={`overflow-hidden transition-all duration-300 ${collapsedSections['alert-history'] ? 'max-h-0' : 'max-h-[2000px]'}`}>
          <div className="divide-y divide-border">
            {alertHistory.length === 0 ? (
              <div className="p-8 text-center">
                <span className="material-icons text-4xl text-muted-foreground">notifications_none</span>
                <p className="mt-2 text-muted-foreground">No alerts have been sent yet.</p>
              </div>
            ) : (
              alertHistory.map((alert) => {
                const config = ALERT_LEVEL_CONFIG[alert.level as AlertLevel] || ALERT_LEVEL_CONFIG.info
                const IconComponent = config.icon
                const alertDate = new Date(alert.created_at)

                return (
                  <div key={alert.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.bgColor}`}>
                        <IconComponent className="h-5 w-5" style={{ color: config.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold">{alert.title}</h4>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {alertDate.toLocaleDateString()} {alertDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{alert.content}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                          <span className="text-muted-foreground">
                            Sent by: <span className="font-medium text-foreground">{alert.author?.full_name || alert.author?.email || 'Unknown'}</span>
                          </span>
                          <span className="text-muted-foreground">
                            To: <span className="font-medium text-foreground">{alert.recipient_count} recipient{alert.recipient_count !== 1 ? 's' : ''}</span>
                          </span>
                          <div className="flex items-center gap-2">
                            {alert.sent_via_app && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                <Bell className="h-3 w-3" />
                                App
                              </span>
                            )}
                            {alert.sent_via_email && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                <Mail className="h-3 w-3" />
                                {alert.email_sent_count > 0 ? `${alert.email_sent_count} emails` : 'Email'}
                              </span>
                            )}
                            {alert.sent_via_sms && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                <MessageSquare className="h-3 w-3" />
                                {alert.sms_sent_count > 0 ? `${alert.sms_sent_count} SMS` : 'SMS'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Community Details Section */}
      <div className="rounded-xl border border-border bg-card">
        <button
          onClick={() => toggleSection('community-details')}
          className="w-full border-b border-border p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="text-left">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className="material-icons text-[#FEB100]">edit</span>
              Community Details
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage your community&apos;s name, description, and visibility
            </p>
          </div>
          <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${collapsedSections['community-details'] ? '-rotate-90' : ''}`} />
        </button>
        <div className={`overflow-hidden transition-all duration-300 ${collapsedSections['community-details'] ? 'max-h-0' : 'max-h-[1000px]'}`}>
          <div className="p-4 space-y-4">
            {/* Community Name */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <span className="material-icons text-2xl text-primary">groups</span>
              </div>
              <div className="flex-1">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      placeholder="Enter community name"
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editedName.trim()) {
                          saveCommunityName()
                        } else if (e.key === 'Escape') {
                          setIsEditingName(false)
                          setEditedName(community?.name || '')
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      onClick={saveCommunityName}
                      disabled={isSavingName || !editedName.trim()}
                      size="sm"
                    >
                      {isSavingName ? (
                        <span className="material-icons animate-spin text-lg">sync</span>
                      ) : (
                        'Save'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditingName(false)
                        setEditedName(community?.name || '')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Name</p>
                    <h3 className="font-semibold">{community?.name}</h3>
                  </>
                )}
              </div>
              {!isEditingName && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditedName(community?.name || '')
                    setIsEditingName(true)
                  }}
                >
                  Edit
                </Button>
              )}
            </div>

            {/* Community Description */}
            <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                <span className="material-icons text-2xl text-blue-500">description</span>
              </div>
              <div className="flex-1">
                {isEditingDescription ? (
                  <div className="space-y-2">
                    <textarea
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      placeholder="Enter a description for your community..."
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={saveCommunityDescription}
                        disabled={isSavingDescription}
                        size="sm"
                      >
                        {isSavingDescription ? (
                          <span className="material-icons animate-spin text-lg">sync</span>
                        ) : (
                          'Save'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditingDescription(false)
                          setEditedDescription(community?.description || '')
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Description</p>
                    <p className="text-sm mt-1">
                      {community?.description || <span className="text-muted-foreground italic">No description set</span>}
                    </p>
                  </>
                )}
              </div>
              {!isEditingDescription && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditedDescription(community?.description || '')
                    setIsEditingDescription(true)
                  }}
                >
                  Edit
                </Button>
              )}
            </div>

            {/* Visibility Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  community?.is_public ? 'bg-green-500/10' : 'bg-amber-500/10'
                }`}>
                  <span className={`material-icons text-2xl ${
                    community?.is_public ? 'text-green-500' : 'text-amber-500'
                  }`}>
                    {community?.is_public ? 'public' : 'lock'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Visibility</p>
                  <h3 className="font-semibold">{community?.is_public ? 'Public' : 'Private'}</h3>
                  <p className="text-sm text-muted-foreground">
                    {community?.is_public
                      ? 'Anyone can find and request to join'
                      : 'Only invited users can join'}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={toggleVisibility}
              >
                {community?.is_public ? 'Make Private' : 'Make Public'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Community Region Section */}
      <div className="rounded-xl border border-border bg-card">
        <button
          onClick={() => toggleSection('region')}
          className="w-full border-b border-border p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="text-left">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className="material-icons text-blue-500">polyline</span>
              Community Region
            </h2>
            <p className="text-sm text-muted-foreground">
              Draw the area covered by your community. This region will be shown as an overlay on maps.
            </p>
          </div>
          <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${collapsedSections['region'] ? '-rotate-90' : ''}`} />
        </button>
        <div className={`overflow-hidden transition-all duration-300 ${collapsedSections['region'] ? 'max-h-0' : 'max-h-[1500px]'}`}>
          <div className="p-4">
            <RegionEditor
              initialPolygon={(community as Record<string, unknown>)?.region_polygon as RegionPolygon | null}
              center={community?.latitude && community?.longitude
                ? { lat: community.latitude, lng: community.longitude }
                : undefined
              }
              onSave={saveRegion}
              isSaving={isSavingRegion}
            />
          </div>
        </div>
      </div>

      {/* Locations Section */}
      <div className="rounded-xl border border-border bg-card">
        <button
          onClick={() => toggleSection('locations')}
          className="w-full border-b border-border p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="text-left">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className="material-icons text-green-500">map</span>
              Community Locations
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage meeting points and key reference locations for your community. Control who can see each location.
            </p>
          </div>
          <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${collapsedSections['locations'] ? '-rotate-90' : ''}`} />
        </button>
        <div className={`overflow-hidden transition-all duration-300 ${collapsedSections['locations'] ? 'max-h-0' : 'max-h-[2000px]'}`}>
          <div className="p-4">
            {user && (
              <CommunityLocationsManager
                communityId={communityId}
                userId={user.id}
                points={mapPoints}
                onAdd={addMapPoint}
                onUpdate={updateMapPoint}
                onDelete={deleteMapPoint}
                isSaving={isSavingMapPoints}
              />
            )}
          </div>
        </div>
      </div>

      {/* Edit Rule Modal */}
      {showRuleModal && editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
          <div className="w-full max-w-2xl rounded-xl bg-card border border-border p-6 mx-4 my-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Rule</h2>
              <button
                onClick={() => {
                  setShowRuleModal(false)
                  resetRuleForm()
                }}
                className="p-1 hover:bg-muted rounded"
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {/* Rule Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Rule Name *</label>
                <Input
                  placeholder="e.g., Weather Alert, System Notification"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  placeholder="Describe what triggers this rule..."
                  value={ruleDescription}
                  onChange={(e) => setRuleDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>

              {/* Alert Level */}
              <div>
                <label className="block text-sm font-medium mb-2">Alert Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['info', 'warning', 'danger'] as const).map((level) => {
                    const config = ALERT_RULE_LEVEL_CONFIG[level]
                    const isSelected = ruleAlertLevel === level
                    return (
                      <button
                        key={level}
                        onClick={() => setRuleAlertLevel(level)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          isSelected
                            ? `${config.bgColor} ${config.borderColor}`
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          {level === 'info' && <Info className="h-4 w-4" style={{ color: config.color }} />}
                          {level === 'warning' && <AlertTriangle className="h-4 w-4" style={{ color: config.color }} />}
                          {level === 'danger' && <AlertCircle className="h-4 w-4" style={{ color: config.color }} />}
                          <span className="font-medium text-sm">{config.label}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Alert Title */}
              <div>
                <label className="block text-sm font-medium mb-1">Alert Title *</label>
                <Input
                  placeholder="Title of the alert that will be sent"
                  value={ruleAlertTitle}
                  onChange={(e) => setRuleAlertTitle(e.target.value)}
                />
              </div>

              {/* Alert Message */}
              <div>
                <label className="block text-sm font-medium mb-1">Alert Message *</label>
                <textarea
                  placeholder="The message content that will be sent to recipients..."
                  value={ruleAlertMessage}
                  onChange={(e) => setRuleAlertMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>

              {/* Recipients */}
              <div>
                <label className="block text-sm font-medium mb-2">Send To</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['admin', 'team', 'members', 'groups', 'specific'] as RuleRecipientGroup[]).map((group) => {
                    const config = RULE_RECIPIENT_CONFIG[group]
                    const isSelected = ruleRecipientGroup === group
                    return (
                      <button
                        key={group}
                        onClick={() => setRuleRecipientGroup(group)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <span className="font-medium text-xs">{config.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Member Selection for 'specific' */}
              {ruleRecipientGroup === 'specific' && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Select Members ({ruleSelectedMembers.length} selected)
                  </label>
                  <div className="border border-border rounded-lg max-h-32 overflow-y-auto">
                    {members.map((member) => {
                      const isSelected = ruleSelectedMembers.includes(member.user_id)
                      return (
                        <button
                          key={member.id}
                          onClick={() => toggleRuleMemberSelection(member.user_id)}
                          className={`w-full flex items-center gap-2 p-2 text-left hover:bg-muted/50 border-b border-border last:border-b-0 ${
                            isSelected ? 'bg-primary/5' : ''
                          }`}
                        >
                          <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                            isSelected ? 'bg-primary border-primary' : 'border-border'
                          }`}>
                            {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <span className="text-sm truncate">
                            {member.profile?.full_name || member.profile?.email || 'Unknown'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Delivery Options */}
              <div>
                <label className="block text-sm font-medium mb-2">Delivery Methods</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ruleSendAppNotification}
                      onChange={(e) => setRuleSendAppNotification(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">App</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ruleSendEmail}
                      onChange={(e) => setRuleSendEmail(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ruleSendSms}
                      onChange={(e) => setRuleSendSms(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">SMS</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 mt-4 border-t border-border">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowRuleModal(false)
                  resetRuleForm()
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveRule}
                disabled={isSavingRule || !ruleName.trim() || !ruleAlertTitle.trim() || !ruleAlertMessage.trim()}
              >
                {isSavingRule ? (
                  <>
                    <span className="material-icons animate-spin text-lg mr-2">sync</span>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
