'use client'

import { useState, useMemo } from 'react'
import { X, UserPlus, Search, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { COMMUNITY_ROLE_CONFIG } from '@/types/database'
import type { CommunityRole } from '@/types/database'

interface Member {
  id: string
  user_id: string
  role: CommunityRole
  profile?: {
    full_name?: string
    email?: string
  }
}

interface ExternalRecipient {
  id: string // temporary ID for UI purposes
  name: string
  email: string
  isExternal: true
}

interface SelectedMember {
  id: string // user_id for members, temporary id for external
  name: string
  email: string
  role?: CommunityRole
  isExternal?: boolean
}

interface CustomRecipientSelectorProps {
  members: Member[]
  selectedRecipients: SelectedMember[]
  onRecipientsChange: (recipients: SelectedMember[]) => void
}

export function CustomRecipientSelector({
  members,
  selectedRecipients,
  onRecipientsChange
}: CustomRecipientSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddExternal, setShowAddExternal] = useState(false)
  const [externalName, setExternalName] = useState('')
  const [externalEmail, setExternalEmail] = useState('')

  // Filter members based on search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return []

    const query = searchQuery.toLowerCase()
    return members.filter(member => {
      const name = member.profile?.full_name?.toLowerCase() || ''
      const email = member.profile?.email?.toLowerCase() || ''
      return name.includes(query) || email.includes(query)
    })
  }, [members, searchQuery])

  const handleAddMember = (member: Member) => {
    // Check if already selected
    if (selectedRecipients.some(r => r.id === member.user_id)) {
      return
    }

    const newRecipient: SelectedMember = {
      id: member.user_id,
      name: member.profile?.full_name || member.profile?.email || 'Unknown',
      email: member.profile?.email || '',
      role: member.role,
      isExternal: false
    }

    onRecipientsChange([...selectedRecipients, newRecipient])
    setSearchQuery('')
  }

  const handleAddExternal = () => {
    if (!externalName.trim() || !externalEmail.trim()) {
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(externalEmail)) {
      return
    }

    // Check if email already exists
    if (selectedRecipients.some(r => r.email.toLowerCase() === externalEmail.toLowerCase())) {
      return
    }

    const newRecipient: SelectedMember = {
      id: `external-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: externalName.trim(),
      email: externalEmail.trim(),
      isExternal: true
    }

    onRecipientsChange([...selectedRecipients, newRecipient])
    setExternalName('')
    setExternalEmail('')
    setShowAddExternal(false)
  }

  const handleRemoveRecipient = (id: string) => {
    onRecipientsChange(selectedRecipients.filter(r => r.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Search Members */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search members by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />

        {/* Search Results Dropdown */}
        {searchQuery && filteredMembers.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredMembers.map((member) => {
              const isSelected = selectedRecipients.some(r => r.id === member.user_id)
              return (
                <button
                  key={member.id}
                  onClick={() => handleAddMember(member)}
                  disabled={isSelected}
                  className={`w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 border-b border-border last:border-b-0 ${
                    isSelected ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {member.profile?.full_name || member.profile?.email || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.profile?.email}
                    </p>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: `${COMMUNITY_ROLE_CONFIG[member.role]?.color}20`,
                      color: COMMUNITY_ROLE_CONFIG[member.role]?.color
                    }}
                  >
                    {COMMUNITY_ROLE_CONFIG[member.role]?.label}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Add External Recipient */}
      {!showAddExternal ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAddExternal(true)}
          className="w-full"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add External Recipient
        </Button>
      ) : (
        <div className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">Add External Recipient</h4>
            <button
              onClick={() => {
                setShowAddExternal(false)
                setExternalName('')
                setExternalEmail('')
              }}
              className="p-1 hover:bg-muted rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Input
            placeholder="Full name"
            value={externalName}
            onChange={(e) => setExternalName(e.target.value)}
          />
          <Input
            type="email"
            placeholder="Email address"
            value={externalEmail}
            onChange={(e) => setExternalEmail(e.target.value)}
          />
          <Button
            type="button"
            onClick={handleAddExternal}
            disabled={!externalName.trim() || !externalEmail.trim()}
            className="w-full"
          >
            Add Recipient
          </Button>
        </div>
      )}

      {/* Selected Recipients */}
      {selectedRecipients.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Selected Recipients ({selectedRecipients.length})
          </label>
          <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
            {selectedRecipients.map((recipient) => (
              <div
                key={recipient.id}
                className="flex items-center gap-3 p-3 border-b border-border last:border-b-0 hover:bg-muted/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">
                      {recipient.name}
                    </p>
                    {recipient.isExternal && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-500 shrink-0">
                        External
                      </span>
                    )}
                    {recipient.role && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: `${COMMUNITY_ROLE_CONFIG[recipient.role]?.color}20`,
                          color: COMMUNITY_ROLE_CONFIG[recipient.role]?.color
                        }}
                      >
                        {COMMUNITY_ROLE_CONFIG[recipient.role]?.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground truncate mt-0.5">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{recipient.email}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveRecipient(recipient.id)}
                  className="p-1 hover:bg-destructive/10 rounded text-destructive shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
