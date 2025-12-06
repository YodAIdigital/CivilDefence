'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import {
  Plus,
  Trash2,
  Mail,
  UserPlus,
  AlertCircle,
  Users
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { WizardData } from '../onboarding-wizard'

interface StepFiveProps {
  data: WizardData
  updateData: (updates: Partial<WizardData>) => void
}

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member', description: 'View content & receive alerts' },
  { value: 'team_member', label: 'Team Member', description: 'Manage events & send alerts' },
  { value: 'admin', label: 'Admin', description: 'Full access to settings' },
] as const

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function StepFive({ data, updateData }: StepFiveProps) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'member' | 'team_member' | 'admin'>('member')
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const handleAddInvitation = () => {
    setError(null)

    if (!email.trim()) {
      setError('Please enter an email address')
      return
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    if (data.invitations.some(inv => inv.email.toLowerCase() === email.toLowerCase())) {
      setError('This email has already been added')
      return
    }

    const newInvitation: { email: string; role: 'member' | 'team_member' | 'admin'; name?: string; groupName?: string } = {
      email: email.trim().toLowerCase(),
      role,
    }
    if (name.trim()) {
      newInvitation.name = name.trim()
    }
    if (selectedGroup) {
      newInvitation.groupName = selectedGroup
    }
    updateData({
      invitations: [...data.invitations, newInvitation]
    })

    setEmail('')
    setName('')
    setRole('member')
    setSelectedGroup('')
  }

  const handleRemoveInvitation = (index: number) => {
    const newInvitations = data.invitations.filter((_, i) => i !== index)
    updateData({ invitations: newInvitations })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddInvitation()
    }
  }

  const getRoleLabel = (roleValue: string) => {
    const option = ROLE_OPTIONS.find(r => r.value === roleValue)
    return option?.label || roleValue
  }

  const getRoleColor = (roleValue: string) => {
    switch (roleValue) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'team_member':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Invite Members</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column - Add Invitation Form */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="inviteEmail">Email *</Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="name@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inviteName">Name</Label>
                  <Input
                    id="inviteName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="John Smith"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRole(option.value)}
                      className={`p-2 rounded-lg border-2 text-left transition-all ${
                        role === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-muted-foreground/30'
                      }`}
                    >
                      <div className="font-medium text-xs">{option.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {option.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Group Assignment */}
              {data.groups.length > 0 && (
                <div className="space-y-2">
                  <Label>Assign to Group (optional)</Label>
                  <Select value={selectedGroup || 'none'} onValueChange={(val) => setSelectedGroup(val === 'none' ? '' : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a group..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No group</SelectItem>
                      {data.groups.map((group) => (
                        <SelectItem key={group.name} value={group.name}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: group.color }}
                            />
                            {group.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button onClick={handleAddInvitation} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add to List
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column - Invitations List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Pending Invitations ({data.invitations.length})</p>
          </div>

          {data.invitations.length > 0 ? (
            <div className="space-y-2">
              {data.invitations.map((invitation, index) => (
                <Card key={index} className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {invitation.name || invitation.email}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getRoleColor(invitation.role)}`}>
                          {getRoleLabel(invitation.role)}
                        </span>
                        {invitation.groupName && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary flex items-center gap-1">
                            <Users className="h-2.5 w-2.5" />
                            {invitation.groupName}
                          </span>
                        )}
                      </div>
                      {invitation.name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {invitation.email}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveInvitation(index)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive flex-shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center border-dashed">
              <UserPlus className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">
                No invitations yet. Add emails on the left.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
