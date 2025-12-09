'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { useCommunity } from '@/contexts/community-context'
import { CustomRecipientSelector } from '@/components/community/custom-recipient-selector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Bell, Mail, MessageSquare, AlertTriangle, AlertCircle, Info, CheckCircle, Users } from 'lucide-react'
import type { CommunityRole, CommunityGroup, Profile } from '@/types/database'

type AlertLevel = 'info' | 'warning' | 'danger'
type RecipientGroup = 'admin' | 'team' | 'members' | 'groups' | 'specific'

interface SelectedRecipient {
  id: string
  name: string
  email: string
  role?: CommunityRole
  isExternal?: boolean
}

interface CommunityMemberWithProfile {
  id: string
  user_id: string
  community_id: string
  role: CommunityRole
  joined_at: string
  profile: Profile | null
}

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

const RECIPIENT_GROUP_CONFIG = {
  admin: {
    label: 'Admins',
    description: 'Only community administrators',
  },
  team: {
    label: 'Team',
    description: 'Admins and team members',
  },
  members: {
    label: 'All Members',
    description: 'Everyone in the community',
  },
  groups: {
    label: 'Groups',
    description: 'Select one or more groups',
  },
  specific: {
    label: 'Select Members',
    description: 'Choose specific members',
  },
} as const

interface SendAlertModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function SendAlertModal({ isOpen, onClose, onSuccess }: SendAlertModalProps) {
  const { user } = useAuth()
  const { activeCommunity } = useCommunity()

  // Alert form state
  const [alertTitle, setAlertTitle] = useState('')
  const [alertMessage, setAlertMessage] = useState('')
  const [alertLevel, setAlertLevel] = useState<AlertLevel>('info')
  const [alertRecipientGroup, setAlertRecipientGroup] = useState<RecipientGroup>('members')
  const [alertSelectedRecipients, setAlertSelectedRecipients] = useState<SelectedRecipient[]>([])
  const [alertSelectedGroups, setAlertSelectedGroups] = useState<string[]>([])
  const [alertSendEmail, setAlertSendEmail] = useState(true)
  const [alertSendSms, setAlertSendSms] = useState(false)
  const [alertSendAppAlert, setAlertSendAppAlert] = useState(true)
  const [alertSendPushNotification, setAlertSendPushNotification] = useState(true)
  const [isSendingAlert, setIsSendingAlert] = useState(false)

  // Data state
  const [members, setMembers] = useState<CommunityMemberWithProfile[]>([])
  const [communityGroups, setCommunityGroups] = useState<CommunityGroup[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetch members and groups
  const fetchData = useCallback(async () => {
    if (!activeCommunity) return

    try {
      // Fetch members
      const { data: membersData } = await supabase
        .from('community_members')
        .select(`
          *,
          profile:profiles(*)
        `)
        .eq('community_id', activeCommunity.id)

      if (membersData) {
        setMembers(membersData as CommunityMemberWithProfile[])
      }

      // Fetch groups
      const { data: groupsData } = await supabase
        .from('community_groups')
        .select(`
          *,
          member_count:community_group_members(count)
        `)
        .eq('community_id', activeCommunity.id)
        .eq('is_active', true)

      if (groupsData) {
        const groupsWithCount = groupsData.map(group => ({
          ...group,
          member_count: Array.isArray(group.member_count) && group.member_count[0]
            ? (group.member_count[0] as { count: number }).count
            : 0,
        }))
        setCommunityGroups(groupsWithCount as CommunityGroup[])
      }
    } catch (err) {
      console.error('Error fetching data:', err)
    }
  }, [activeCommunity])

  useEffect(() => {
    if (isOpen) {
      fetchData()
    }
  }, [isOpen, fetchData])

  const resetForm = () => {
    setAlertTitle('')
    setAlertMessage('')
    setAlertLevel('info')
    setAlertRecipientGroup('members')
    setAlertSelectedRecipients([])
    setAlertSelectedGroups([])
    setAlertSendEmail(true)
    setAlertSendSms(false)
    setAlertSendAppAlert(true)
    setAlertSendPushNotification(true)
    setError(null)
    setSuccess(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const toggleAlertGroupSelection = (groupId: string) => {
    setAlertSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
  }

  const handleSendAlert = async () => {
    if (!activeCommunity || !user) return

    if (!alertTitle.trim()) {
      setError('Please enter an alert title')
      return
    }

    if (!alertMessage.trim()) {
      setError('Please enter an alert message')
      return
    }

    if (!alertSendEmail && !alertSendSms && !alertSendAppAlert && !alertSendPushNotification) {
      setError('Please select at least one delivery method')
      return
    }

    if (alertRecipientGroup === 'specific' && alertSelectedRecipients.length === 0) {
      setError('Please select at least one recipient')
      return
    }

    if (alertRecipientGroup === 'groups' && alertSelectedGroups.length === 0) {
      setError('Please select at least one group')
      return
    }

    try {
      setIsSendingAlert(true)
      setError(null)

      // Separate internal members and external recipients
      const memberRecipients = alertSelectedRecipients.filter(r => !r.isExternal)
      const externalRecipients = alertSelectedRecipients.filter(r => r.isExternal)

      const response = await fetch('/api/community-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communityId: activeCommunity.id,
          senderId: user.id,
          title: alertTitle,
          message: alertMessage,
          alertLevel,
          recipientGroup: alertRecipientGroup,
          specificMemberIds: alertRecipientGroup === 'specific' ? memberRecipients.map(r => r.id) : undefined,
          selectedGroupIds: alertRecipientGroup === 'groups' ? alertSelectedGroups : undefined,
          externalRecipients: alertRecipientGroup === 'specific' && externalRecipients.length > 0
            ? externalRecipients.map(r => ({ name: r.name, email: r.email }))
            : undefined,
          sendEmail: alertSendEmail,
          sendSms: alertSendSms,
          sendAppAlert: alertSendAppAlert,
          sendPushNotification: alertSendPushNotification,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send alert')
      }

      const deliveryMethods = []
      if (alertSendAppAlert) deliveryMethods.push('in-app')
      if (alertSendPushNotification && data.pushSent > 0) deliveryMethods.push(`${data.pushSent} push`)
      if (alertSendEmail && data.emailsSent > 0) deliveryMethods.push(`${data.emailsSent} email${data.emailsSent > 1 ? 's' : ''}`)
      if (alertSendSms && data.smsSent > 0) deliveryMethods.push(`${data.smsSent} SMS`)

      setSuccess(`Alert sent to ${data.recipientCount} recipient${data.recipientCount > 1 ? 's' : ''} (${deliveryMethods.join(', ')})`)

      setTimeout(() => {
        handleClose()
        onSuccess?.()
      }, 2000)
    } catch (err) {
      console.error('Error sending alert:', err)
      setError(err instanceof Error ? err.message : 'Failed to send alert')
    } finally {
      setIsSendingAlert(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-card shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span className="material-icons text-[#FEB100]">campaign</span>
            Send Alert
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Error/Success Messages */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
              {success}
            </div>
          )}

          {/* Alert Level Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">Alert Type</label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(ALERT_LEVEL_CONFIG) as AlertLevel[]).map((level) => {
                const config = ALERT_LEVEL_CONFIG[level]
                const IconComponent = config.icon
                const isSelected = alertLevel === level
                return (
                  <button
                    key={level}
                    onClick={() => setAlertLevel(level)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? `${config.bgColor} ${config.borderColor}`
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <IconComponent className="h-5 w-5" style={{ color: config.color }} />
                      <span className="font-medium" style={{ color: isSelected ? config.color : undefined }}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Recipients Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">Send To</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(RECIPIENT_GROUP_CONFIG) as RecipientGroup[]).map((group) => {
                const config = RECIPIENT_GROUP_CONFIG[group]
                const isSelected = alertRecipientGroup === group
                return (
                  <button
                    key={group}
                    onClick={() => setAlertRecipientGroup(group)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <span className="font-medium text-sm">{config.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Group Selection (when groups is selected) */}
          {alertRecipientGroup === 'groups' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Groups ({alertSelectedGroups.length} selected)
              </label>
              {communityGroups.filter(g => g.is_active && g.member_count > 0).length === 0 ? (
                <div className="border border-border rounded-lg p-4 text-center text-muted-foreground text-sm">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No groups with members available.</p>
                  <p className="text-xs mt-1">Create groups in the community settings to use this option.</p>
                </div>
              ) : (
                <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
                  {communityGroups.filter(g => g.is_active && g.member_count > 0).map((group) => {
                    const isSelected = alertSelectedGroups.includes(group.id)
                    return (
                      <button
                        key={group.id}
                        onClick={() => toggleAlertGroupSelection(group.id)}
                        className={`w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 border-b border-border last:border-b-0 ${
                          isSelected ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className={`flex h-5 w-5 items-center justify-center rounded border ${
                          isSelected ? 'bg-primary border-primary' : 'border-border'
                        }`}>
                          {isSelected && <CheckCircle className="h-4 w-4 text-primary-foreground" />}
                        </div>
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: group.color + '20' }}
                        >
                          <span className="material-icons text-sm" style={{ color: group.color }}>
                            {group.icon}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{group.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Custom Recipient Selection (when specific is selected) */}
          {alertRecipientGroup === 'specific' && (
            <CustomRecipientSelector
              members={members}
              selectedRecipients={alertSelectedRecipients}
              onRecipientsChange={setAlertSelectedRecipients}
            />
          )}

          {/* Alert Title */}
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <Input
              placeholder="Enter alert title"
              value={alertTitle}
              onChange={(e) => setAlertTitle(e.target.value)}
            />
          </div>

          {/* Alert Message */}
          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <textarea
              placeholder="Enter your alert message..."
              value={alertMessage}
              onChange={(e) => setAlertMessage(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          {/* Delivery Options */}
          <div>
            <label className="block text-sm font-medium mb-3">Delivery Method</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={alertSendAppAlert}
                  onChange={(e) => setAlertSendAppAlert(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border"
                />
                <div className="flex items-start gap-2">
                  <Bell className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <span className="font-medium text-sm">In-App Alert</span>
                    <p className="text-xs text-muted-foreground">Shows at top of dashboard</p>
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={alertSendPushNotification}
                  onChange={(e) => setAlertSendPushNotification(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border"
                />
                <div className="flex items-start gap-2">
                  <span className="material-icons text-base text-muted-foreground mt-0.5">devices</span>
                  <div>
                    <span className="font-medium text-sm">Push Notification</span>
                    <p className="text-xs text-muted-foreground">Browser & mobile alerts</p>
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={alertSendEmail}
                  onChange={(e) => setAlertSendEmail(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border"
                />
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <span className="font-medium text-sm">Email</span>
                    <p className="text-xs text-muted-foreground">Sends to email address</p>
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={alertSendSms}
                  onChange={(e) => setAlertSendSms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border"
                />
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <span className="font-medium text-sm">SMS</span>
                    <p className="text-xs text-muted-foreground">Sends as text message</p>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Preview */}
          {alertTitle && (
            <div>
              <label className="block text-sm font-medium mb-2">Preview</label>
              <div className={`rounded-xl border p-4 ${ALERT_LEVEL_CONFIG[alertLevel].bgColor} ${ALERT_LEVEL_CONFIG[alertLevel].borderColor}`}>
                <div className="flex items-start gap-3">
                  {(() => {
                    const IconComponent = ALERT_LEVEL_CONFIG[alertLevel].icon
                    return <IconComponent className="h-5 w-5 mt-0.5" style={{ color: ALERT_LEVEL_CONFIG[alertLevel].color }} />
                  })()}
                  <div className="flex-1">
                    <h4 className="font-semibold" style={{ color: ALERT_LEVEL_CONFIG[alertLevel].color }}>
                      {alertTitle}
                    </h4>
                    {alertMessage && (
                      <p className="mt-1 text-sm whitespace-pre-wrap">{alertMessage}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Send Button */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSendAlert}
              disabled={isSendingAlert || !alertTitle.trim() || !alertMessage.trim() || (!alertSendEmail && !alertSendSms && !alertSendAppAlert && !alertSendPushNotification)}
              className="gap-2"
              style={{
                backgroundColor: ALERT_LEVEL_CONFIG[alertLevel].color,
              }}
            >
              {isSendingAlert ? (
                <>
                  <span className="material-icons animate-spin text-lg">sync</span>
                  Sending...
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  Send Alert
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
