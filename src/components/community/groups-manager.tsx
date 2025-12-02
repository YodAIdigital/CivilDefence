'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  type CommunityGroup,
  type Profile,
  SUGGESTED_GROUPS,
  GROUP_ICON_OPTIONS,
  GROUP_COLOR_OPTIONS,
} from '@/types/database'
import {
  Plus,
  Trash2,
  Edit2,
  X,
  ChevronDown,
  ChevronUp,
  Users,
  UserPlus,
  Search,
  Check,
} from 'lucide-react'

interface CommunityMember {
  id: string
  user_id: string
  profile: Profile | null
}

interface GroupMemberInfo {
  id: string
  user_id: string
  added_at: string
  profile?: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | undefined
}

interface GroupWithMembers extends CommunityGroup {
  group_members?: GroupMemberInfo[]
}

interface GroupsManagerProps {
  communityId: string
  userId: string
  members: CommunityMember[]
  onGroupsChange?: (groups: CommunityGroup[]) => void
}

interface GroupFormData {
  id: string
  name: string
  description: string
  color: string
  icon: string
  is_active: boolean
}

const emptyGroup: GroupFormData = {
  id: '',
  name: '',
  description: '',
  color: '#6b7280',
  icon: 'group',
  is_active: true,
}

export function GroupsManager({
  communityId,
  userId,
  members,
  onGroupsChange,
}: GroupsManagerProps) {
  const [groups, setGroups] = useState<GroupWithMembers[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [editingGroup, setEditingGroup] = useState<GroupFormData | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [managingMembersId, setManagingMembersId] = useState<string | null>(null)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')

  // Fetch groups with their members
  const fetchGroups = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch groups using raw query to work around typing issues
      const supabaseAny = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              order: (col: string, opts: { ascending: boolean }) => Promise<{ data: GroupWithMembers[] | null; error: Error | null }>
            }
          }
        }
      }

      const { data: groupsData, error: groupsError } = await supabaseAny
        .from('community_groups')
        .select('*')
        .eq('community_id', communityId)
        .order('display_order', { ascending: true })

      if (groupsError) throw groupsError

      if (!groupsData || groupsData.length === 0) {
        setGroups([])
        setIsLoading(false)
        return
      }

      // Fetch members for each group
      const groupIds = groupsData.map(g => g.id)

      const membersFetch = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            in: (col: string, vals: string[]) => Promise<{ data: { id: string; group_id: string; user_id: string; added_at: string }[] | null; error: Error | null }>
          }
        }
      }

      const { data: groupMembersData } = await membersFetch
        .from('community_group_members')
        .select('id, group_id, user_id, added_at')
        .in('group_id', groupIds)

      // Get unique user IDs from group members
      const userIds = Array.from(new Set(groupMembersData?.map(gm => gm.user_id) || []))

      // Fetch profiles for group members
      let profilesMap = new Map<string, { id: string; full_name: string | null; email: string; avatar_url: string | null }>()
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', userIds)

        profilesMap = new Map(profilesData?.map(p => [p.id, p]) || [])
      }

      // Combine groups with their members
      const groupsWithMembers: GroupWithMembers[] = groupsData.map(group => ({
        ...group,
        group_members: (groupMembersData || [])
          .filter(gm => gm.group_id === group.id)
          .map(gm => ({
            id: gm.id,
            user_id: gm.user_id,
            added_at: gm.added_at,
            profile: profilesMap.get(gm.user_id),
          })),
      }))

      setGroups(groupsWithMembers)
      onGroupsChange?.(groupsWithMembers)
    } catch (err) {
      console.error('Error fetching groups:', err)
      setError('Failed to load groups')
    } finally {
      setIsLoading(false)
    }
  }, [communityId, onGroupsChange])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  const handleAddNew = (suggested?: { name: string; description: string; icon: string; color: string }) => {
    const newGroup: GroupFormData = {
      ...emptyGroup,
      id: '',
      name: suggested?.name || '',
      description: suggested?.description || '',
      icon: suggested?.icon || 'group',
      color: suggested?.color || '#6b7280',
    }
    setEditingGroup(newGroup)
    setIsAddingNew(true)
    setShowSuggestions(false)
  }

  const handleEdit = (group: CommunityGroup) => {
    setEditingGroup({
      id: group.id,
      name: group.name,
      description: group.description || '',
      color: group.color,
      icon: group.icon,
      is_active: group.is_active,
    })
    setIsAddingNew(false)
  }

  const handleCancel = () => {
    setEditingGroup(null)
    setIsAddingNew(false)
  }

  const handleSaveGroup = async () => {
    if (!editingGroup || !editingGroup.name.trim()) {
      setError('Please enter a group name')
      return
    }

    try {
      setIsSaving(true)
      setError(null)

      const supabaseAny = supabase as unknown as {
        from: (table: string) => {
          insert: (data: unknown) => {
            select: () => {
              single: () => Promise<{ data: CommunityGroup | null; error: { message: string } | null }>
            }
          }
          update: (data: unknown) => {
            eq: (col: string, val: string) => {
              select: () => {
                single: () => Promise<{ data: CommunityGroup | null; error: { message: string } | null }>
              }
            }
          }
        }
      }

      if (isAddingNew) {
        // Create new group
        const { error: insertError } = await supabaseAny
          .from('community_groups')
          .insert({
            community_id: communityId,
            name: editingGroup.name.trim(),
            description: editingGroup.description || null,
            color: editingGroup.color,
            icon: editingGroup.icon,
            is_active: editingGroup.is_active,
            display_order: groups.length,
            created_by: userId,
          })
          .select()
          .single()

        if (insertError) {
          if (insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
            setError('A group with this name already exists')
            return
          }
          throw new Error(insertError.message)
        }

        setSuccess('Group created successfully')
      } else {
        // Update existing group
        const { error: updateError } = await supabaseAny
          .from('community_groups')
          .update({
            name: editingGroup.name.trim(),
            description: editingGroup.description || null,
            color: editingGroup.color,
            icon: editingGroup.icon,
            is_active: editingGroup.is_active,
            updated_by: userId,
          })
          .eq('id', editingGroup.id)
          .select()
          .single()

        if (updateError) {
          if (updateError.message?.includes('unique') || updateError.message?.includes('duplicate')) {
            setError('A group with this name already exists')
            return
          }
          throw new Error(updateError.message)
        }

        setSuccess('Group updated successfully')
      }

      setEditingGroup(null)
      setIsAddingNew(false)
      await fetchGroups()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error saving group:', err)
      setError(err instanceof Error ? err.message : 'Failed to save group')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? All member assignments will be removed.')) return

    try {
      setError(null)

      const supabaseAny = supabase as unknown as {
        from: (table: string) => {
          delete: () => {
            eq: (col: string, val: string) => Promise<{ error: Error | null }>
          }
        }
      }

      const { error: deleteError } = await supabaseAny
        .from('community_groups')
        .delete()
        .eq('id', groupId)

      if (deleteError) throw deleteError

      setSuccess('Group deleted successfully')
      await fetchGroups()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error deleting group:', err)
      setError('Failed to delete group')
    }
  }

  const handleAddMemberToGroup = async (groupId: string, memberUserId: string) => {
    try {
      setError(null)

      const supabaseAny = supabase as unknown as {
        from: (table: string) => {
          insert: (data: unknown) => Promise<{ error: { message: string } | null }>
        }
      }

      const { error: insertError } = await supabaseAny
        .from('community_group_members')
        .insert({
          group_id: groupId,
          user_id: memberUserId,
          added_by: userId,
        })

      if (insertError) {
        if (insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
          setError('Member is already in this group')
          return
        }
        throw new Error(insertError.message)
      }

      await fetchGroups()
    } catch (err) {
      console.error('Error adding member to group:', err)
      setError('Failed to add member to group')
    }
  }

  const handleRemoveMemberFromGroup = async (groupMemberId: string) => {
    try {
      setError(null)

      const supabaseAny = supabase as unknown as {
        from: (table: string) => {
          delete: () => {
            eq: (col: string, val: string) => Promise<{ error: Error | null }>
          }
        }
      }

      const { error: deleteError } = await supabaseAny
        .from('community_group_members')
        .delete()
        .eq('id', groupMemberId)

      if (deleteError) throw deleteError

      await fetchGroups()
    } catch (err) {
      console.error('Error removing member from group:', err)
      setError('Failed to remove member from group')
    }
  }

  // Available suggestions (groups not yet created)
  const availableSuggestions = SUGGESTED_GROUPS.filter(
    sg => !groups.some(g => g.name.toLowerCase() === sg.name.toLowerCase())
  )

  // Filter members for search
  const filteredMembers = members.filter(member => {
    if (!memberSearchQuery.trim()) return true
    const query = memberSearchQuery.toLowerCase()
    const name = member.profile?.full_name?.toLowerCase() || ''
    const email = member.profile?.email?.toLowerCase() || ''
    return name.includes(query) || email.includes(query)
  })

  // Get members not in a specific group
  const getMembersNotInGroup = (group: GroupWithMembers) => {
    const groupUserIds = new Set(group.group_members?.map(gm => gm.user_id) || [])
    return filteredMembers.filter(m => !groupUserIds.has(m.user_id))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="material-icons animate-spin text-xl text-primary">sync</span>
        <span className="ml-2 text-sm text-muted-foreground">Loading groups...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Messages */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
          <span className="material-icons text-lg">error</span>
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm flex items-center gap-2">
          <span className="material-icons text-lg">check_circle</span>
          {success}
        </div>
      )}

      {/* Groups List */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-muted/50">
          <Users className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No groups defined</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create groups to organize members and send targeted alerts.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <div
              key={group.id}
              className="border rounded-lg bg-card overflow-hidden"
            >
              {/* Group Header */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedId(expandedId === group.id ? null : group.id)}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: group.color + '20' }}
                >
                  <span className="material-icons text-xl" style={{ color: group.color }}>
                    {group.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{group.name}</span>
                    {!group.is_active && (
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEdit(group)
                    }}
                    className="p-2 hover:bg-muted rounded"
                    title="Edit group"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setManagingMembersId(managingMembersId === group.id ? null : group.id)
                      setMemberSearchQuery('')
                    }}
                    className={`p-2 rounded ${managingMembersId === group.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    title="Manage members"
                  >
                    <UserPlus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(group.id)
                    }}
                    className="p-2 hover:bg-muted text-destructive rounded"
                    title="Delete group"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ml-1 ${
                      expandedId === group.id ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </div>

              {/* Expanded Details - Group Members */}
              {expandedId === group.id && (
                <div className="px-3 pb-3 pt-0 border-t bg-muted/30">
                  {group.description && (
                    <p className="text-sm text-muted-foreground mt-3 mb-2">{group.description}</p>
                  )}

                  {group.group_members && group.group_members.length > 0 ? (
                    <div className="space-y-1 mt-2">
                      <p className="text-xs font-medium text-muted-foreground">Members:</p>
                      <div className="flex flex-wrap gap-2">
                        {group.group_members.map((gm) => (
                          <div
                            key={gm.id}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs"
                            style={{ backgroundColor: group.color + '15' }}
                          >
                            {gm.profile?.avatar_url ? (
                              <img
                                src={gm.profile.avatar_url}
                                alt=""
                                className="w-4 h-4 rounded-full"
                              />
                            ) : (
                              <span className="material-icons text-sm" style={{ color: group.color }}>person</span>
                            )}
                            <span>{gm.profile?.full_name || gm.profile?.email || 'Unknown'}</span>
                            {managingMembersId === group.id && (
                              <button
                                onClick={() => handleRemoveMemberFromGroup(gm.id)}
                                className="ml-1 hover:text-destructive"
                                title="Remove from group"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">No members assigned yet</p>
                  )}
                </div>
              )}

              {/* Member Management Panel */}
              {managingMembersId === group.id && (
                <div className="px-3 pb-3 border-t bg-card">
                  <div className="py-3 space-y-3">
                    <p className="text-sm font-medium">Add Members to {group.name}</p>

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search members..."
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* Available Members */}
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {getMembersNotInGroup(group).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {filteredMembers.length === 0 ? 'No members found' : 'All members are already in this group'}
                        </p>
                      ) : (
                        getMembersNotInGroup(group).map((member) => (
                          <button
                            key={member.id}
                            onClick={() => handleAddMemberToGroup(group.id, member.user_id)}
                            className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-left"
                          >
                            {member.profile?.avatar_url ? (
                              <img
                                src={member.profile.avatar_url}
                                alt=""
                                className="w-6 h-6 rounded-full"
                              />
                            ) : (
                              <span className="material-icons text-lg text-muted-foreground">person</span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {member.profile?.full_name || 'Unknown'}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {member.profile?.email}
                              </p>
                            </div>
                            <Plus className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit/Add Form */}
      {editingGroup && (
        <div className="border rounded-lg p-4 bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              {isAddingNew ? 'Create New Group' : 'Edit Group'}
            </h3>
            <button onClick={handleCancel} className="p-1 hover:bg-muted rounded">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium mb-1 block">Group Name *</label>
              <Input
                value={editingGroup.name}
                onChange={(e) =>
                  setEditingGroup({ ...editingGroup, name: e.target.value })
                }
                placeholder="e.g., Response Team, Zone 1"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Input
                value={editingGroup.description}
                onChange={(e) =>
                  setEditingGroup({ ...editingGroup, description: e.target.value })
                }
                placeholder="Brief description of this group"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Icon</label>
              <div className="flex flex-wrap gap-2">
                {GROUP_ICON_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditingGroup({ ...editingGroup, icon: opt.value })}
                    className={`p-2 rounded-lg border transition-colors ${
                      editingGroup.icon === opt.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-muted'
                    }`}
                    title={opt.label}
                  >
                    <span className="material-icons text-lg">{opt.value}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Color</label>
              <div className="flex flex-wrap gap-2">
                {GROUP_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditingGroup({ ...editingGroup, color: opt.value })}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      editingGroup.color === opt.value
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: opt.value }}
                    title={opt.label}
                  >
                    {editingGroup.color === opt.value && (
                      <Check className="h-4 w-4 text-white m-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingGroup.is_active}
                  onChange={(e) =>
                    setEditingGroup({ ...editingGroup, is_active: e.target.checked })
                  }
                  className="rounded border-border"
                />
                <span className="text-sm font-medium">Active (visible and usable)</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleCancel} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSaveGroup}
              disabled={!editingGroup.name.trim() || isSaving}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <span className="material-icons animate-spin text-lg mr-2">sync</span>
                  Saving...
                </>
              ) : isAddingNew ? (
                'Create Group'
              ) : (
                'Update Group'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Add Button */}
      {!editingGroup && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleAddNew()}
              className="flex-1"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Custom Group
            </Button>
            {availableSuggestions.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowSuggestions(!showSuggestions)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Templates
                {showSuggestions ? (
                  <ChevronUp className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                )}
              </Button>
            )}
          </div>

          {showSuggestions && availableSuggestions.length > 0 && (
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-sm text-muted-foreground">Quick add from templates:</p>
              <div className="flex flex-wrap gap-2">
                {availableSuggestions.map((group) => (
                  <Button
                    key={group.name}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddNew(group)}
                    className="h-auto py-1.5"
                  >
                    <span className="material-icons text-sm mr-1" style={{ color: group.color }}>
                      {group.icon}
                    </span>
                    {group.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
