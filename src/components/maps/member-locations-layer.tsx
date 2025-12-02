'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { useCommunity } from '@/contexts/community-context'
import { Search, Filter, X, ChevronDown, User, Users, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MapMarker } from './google-map'
import type { Profile, CommunityRole, ProfileExtended, FieldVisibility, CommunityGroup } from '@/types/database'
import {
  SKILL_OPTIONS,
  DISABILITY_OPTIONS,
  EQUIPMENT_OPTIONS,
  COMMUNITY_ROLE_CONFIG,
} from '@/types/database'

// Member with profile and community role
export interface CommunityMemberWithLocation {
  id: string
  user_id: string
  community_id: string
  role: CommunityRole
  joined_at: string
  profile: Profile | null
  // Extracted from extended profile for convenience
  lat: number | undefined
  lng: number | undefined
  address: string | undefined
  skills: string[] | undefined
  disabilities: string[] | undefined
  equipment: string[] | undefined
}

// Group member info for filtering
interface GroupMemberInfo {
  group_id: string
  user_id: string
}

// Filter state for member locations
interface MemberFilters {
  searchQuery: string
  skills: string[]
  disabilities: string[]
  equipment: string[]
  roles: CommunityRole[]
  groups: string[]
}

const initialFilters: MemberFilters = {
  searchQuery: '',
  skills: [],
  disabilities: [],
  equipment: [],
  roles: [],
  groups: [],
}

type FilterCategory = 'skills' | 'disabilities' | 'equipment' | 'roles' | 'groups'

interface MemberLocationsLayerProps {
  onMembersChange: (markers: MapMarker[], members: CommunityMemberWithLocation[]) => void
  showMemberLocations: boolean
  onToggleShowMembers: () => void
  hideToggle?: boolean // When true, hides the show/hide toggle button (parent controls visibility)
  className?: string
}

// Get the viewer's visibility access level based on their role
// - admin: can see 'civil_defence_only', 'community', and 'private' (their own)
// - team_member: can see 'civil_defence_only' and 'community'
// - member: can only see 'community'
function canViewField(
  viewerRole: CommunityRole | null,
  viewerUserId: string | undefined,
  memberUserId: string,
  fieldVisibility: FieldVisibility | undefined
): boolean {
  // Default visibility is 'private' if not set
  const visibility = fieldVisibility || 'private'

  // Users can always see their own data
  if (viewerUserId === memberUserId) return true

  switch (visibility) {
    case 'private':
      // Only the user themselves can see (already handled above)
      return false
    case 'community':
      // All community members can see
      return true
    case 'civil_defence_only':
      // Only admin and team_member can see
      return viewerRole === 'admin' || viewerRole === 'team_member'
    default:
      return false
  }
}

export function MemberLocationsLayer({
  onMembersChange,
  showMemberLocations,
  onToggleShowMembers,
  hideToggle = false,
  className = '',
}: MemberLocationsLayerProps) {
  const { user } = useAuth()
  const { activeCommunity, isActiveCommunityAdmin, isActiveCommunityTeamMember } = useCommunity()

  const [allMembers, setAllMembers] = useState<CommunityMemberWithLocation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [filters, setFilters] = useState<MemberFilters>(initialFilters)
  // When hideToggle is true, always show filters since parent controls visibility
  const [showFilters, setShowFilters] = useState(hideToggle)
  const [expandedCategory, setExpandedCategory] = useState<FilterCategory | null>(null)
  const [communityGroups, setCommunityGroups] = useState<CommunityGroup[]>([])
  const [groupMembers, setGroupMembers] = useState<GroupMemberInfo[]>([])

  // Get viewer's role
  const viewerRole = useMemo(() => {
    if (isActiveCommunityAdmin) return 'admin' as CommunityRole
    if (isActiveCommunityTeamMember) return 'team_member' as CommunityRole
    return 'member' as CommunityRole
  }, [isActiveCommunityAdmin, isActiveCommunityTeamMember])

  // Fetch community members with their locations
  const fetchMembers = useCallback(async () => {
    if (!user || !activeCommunity) {
      setAllMembers([])
      return
    }

    try {
      setIsLoading(true)

      // Fetch community members
      const { data: membersData, error: membersError } = await supabase
        .from('community_members')
        .select('id, user_id, community_id, role, joined_at')
        .eq('community_id', activeCommunity.id)

      if (membersError) throw membersError

      if (!membersData || membersData.length === 0) {
        setAllMembers([])
        return
      }

      // Fetch profiles for all members
      const userIds = membersData.map(m => m.user_id)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)

      if (profilesError) throw profilesError

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || [])

      // Build members with locations, respecting privacy settings
      const membersWithLocations: CommunityMemberWithLocation[] = membersData
        .map(m => {
          const profile = profilesMap.get(m.user_id) || null
          const extended = profile?.notification_preferences as ProfileExtended | null

          // Check if we can view this member's personal info (which includes location)
          const canViewPersonalInfo = canViewField(
            viewerRole,
            user.id,
            m.user_id,
            extended?.visibility?.personal_info
          )

          // Check if we can view skills
          const canViewSkills = canViewField(
            viewerRole,
            user.id,
            m.user_id,
            extended?.visibility?.skills
          )

          // Check if we can view disabilities
          const canViewDisabilities = canViewField(
            viewerRole,
            user.id,
            m.user_id,
            extended?.visibility?.disabilities
          )

          // Check if we can view equipment
          const canViewEquipment = canViewField(
            viewerRole,
            user.id,
            m.user_id,
            extended?.visibility?.equipment
          )

          return {
            id: m.id,
            user_id: m.user_id,
            community_id: m.community_id,
            role: m.role as CommunityRole,
            joined_at: m.joined_at,
            profile,
            // Only include location if viewer can see personal info
            lat: canViewPersonalInfo ? extended?.address_lat : undefined,
            lng: canViewPersonalInfo ? extended?.address_lng : undefined,
            address: canViewPersonalInfo ? extended?.address : undefined,
            // Only include skills/disabilities/equipment if viewer has access
            skills: canViewSkills ? extended?.skills : undefined,
            disabilities: canViewDisabilities ? extended?.disabilities : undefined,
            equipment: canViewEquipment ? extended?.equipment : undefined,
          }
        })
        // Only include members that have valid coordinates
        .filter(m => m.lat !== undefined && m.lng !== undefined)

      setAllMembers(membersWithLocations)
    } catch (err) {
      console.error('Error fetching member locations:', err)
      setAllMembers([])
    } finally {
      setIsLoading(false)
    }
  }, [user, activeCommunity, viewerRole])

  useEffect(() => {
    if (showMemberLocations) {
      fetchMembers()
    }
  }, [fetchMembers, showMemberLocations])

  // Fetch community groups
  const fetchGroups = useCallback(async () => {
    if (!activeCommunity) {
      setCommunityGroups([])
      setGroupMembers([])
      return
    }

    try {
      // Fetch groups
      const supabaseAny = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              eq: (col: string, val: boolean) => {
                order: (col: string, opts: { ascending: boolean }) => Promise<{ data: CommunityGroup[] | null; error: Error | null }>
              }
            }
          }
        }
      }

      const { data: groupsData } = await supabaseAny
        .from('community_groups')
        .select('*')
        .eq('community_id', activeCommunity.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (groupsData && groupsData.length > 0) {
        setCommunityGroups(groupsData)

        // Fetch group members
        const groupIds = groupsData.map(g => g.id)
        const membersFetch = supabase as unknown as {
          from: (table: string) => {
            select: (cols: string) => {
              in: (col: string, vals: string[]) => Promise<{ data: { group_id: string; user_id: string }[] | null; error: Error | null }>
            }
          }
        }

        const { data: groupMembersData } = await membersFetch
          .from('community_group_members')
          .select('group_id, user_id')
          .in('group_id', groupIds)

        if (groupMembersData) {
          setGroupMembers(groupMembersData)
        }
      } else {
        setCommunityGroups([])
        setGroupMembers([])
      }
    } catch (err) {
      console.error('Error fetching groups:', err)
    }
  }, [activeCommunity])

  useEffect(() => {
    if (showMemberLocations) {
      fetchGroups()
    }
  }, [fetchGroups, showMemberLocations])

  // Filter members based on active filters
  const filteredMembers = useMemo(() => {
    if (!showMemberLocations) return []

    let result = [...allMembers]

    // Search by name, email, or phone
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase().trim()
      result = result.filter(member => {
        const profile = member.profile
        if (!profile) return false

        const fullName = profile.full_name?.toLowerCase() || ''
        const email = profile.email?.toLowerCase() || ''
        const phone = profile.phone?.toLowerCase() || ''

        return (
          fullName.includes(query) ||
          email.includes(query) ||
          phone.includes(query)
        )
      })
    }

    // Filter by role
    if (filters.roles.length > 0) {
      result = result.filter(member => filters.roles.includes(member.role))
    }

    // Filter by skills (only if member has skills visible to us)
    if (filters.skills.length > 0) {
      result = result.filter(member => {
        if (!member.skills) return false
        return filters.skills.some(skill => member.skills?.includes(skill))
      })
    }

    // Filter by disabilities (only if member has disabilities visible to us)
    if (filters.disabilities.length > 0) {
      result = result.filter(member => {
        if (!member.disabilities) return false
        return filters.disabilities.some(d => member.disabilities?.includes(d))
      })
    }

    // Filter by equipment (only if member has equipment visible to us)
    if (filters.equipment.length > 0) {
      result = result.filter(member => {
        if (!member.equipment) return false
        return filters.equipment.some(e => member.equipment?.includes(e))
      })
    }

    // Filter by groups
    if (filters.groups.length > 0) {
      result = result.filter(member => {
        return filters.groups.some(groupId =>
          groupMembers.some(gm => gm.group_id === groupId && gm.user_id === member.user_id)
        )
      })
    }

    return result
  }, [allMembers, filters, showMemberLocations, groupMembers])

  // Convert filtered members to map markers
  const memberMarkers = useMemo((): MapMarker[] => {
    if (!showMemberLocations) return []

    return filteredMembers
      .filter(m => m.lat !== undefined && m.lng !== undefined)
      .map(member => {
        const roleConfig = COMMUNITY_ROLE_CONFIG[member.role]
        const name = member.profile?.full_name || member.profile?.email || 'Unknown Member'

        // Build description with available info
        const descParts: string[] = []
        if (member.address) descParts.push(member.address)
        if (member.skills && member.skills.length > 0) {
          const skillLabels = member.skills
            .map(s => SKILL_OPTIONS.find(o => o.value === s)?.label || s)
            .slice(0, 2)
          descParts.push(`Skills: ${skillLabels.join(', ')}`)
        }
        if (member.equipment && member.equipment.length > 0) {
          const equipLabels = member.equipment
            .map(e => EQUIPMENT_OPTIONS.find(o => o.value === e)?.label || e)
            .slice(0, 2)
          descParts.push(`Equipment: ${equipLabels.join(', ')}`)
        }

        return {
          id: `member-${member.id}`,
          lat: member.lat!,
          lng: member.lng!,
          title: name,
          description: descParts.join(' | '),
          color: roleConfig?.color || '#6b7280',
        }
      })
  }, [filteredMembers, showMemberLocations])

  // Notify parent of changes
  useEffect(() => {
    onMembersChange(memberMarkers, filteredMembers)
  }, [memberMarkers, filteredMembers, onMembersChange])

  const handleSearchChange = (value: string) => {
    setFilters(prev => ({ ...prev, searchQuery: value }))
  }

  const toggleFilter = (category: FilterCategory, value: string) => {
    setFilters(prev => {
      const currentValues = prev[category] as string[]
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value]
      return { ...prev, [category]: newValues }
    })
  }

  const toggleRole = (role: CommunityRole) => {
    setFilters(prev => {
      const newRoles = prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role]
      return { ...prev, roles: newRoles }
    })
  }

  const clearAllFilters = () => {
    setFilters(initialFilters)
  }

  const toggleCategory = (category: FilterCategory) => {
    setExpandedCategory(prev => (prev === category ? null : category))
  }

  const hasActiveFilters =
    filters.searchQuery ||
    filters.skills.length > 0 ||
    filters.disabilities.length > 0 ||
    filters.equipment.length > 0 ||
    filters.roles.length > 0 ||
    filters.groups.length > 0

  const activeFilterCount =
    filters.skills.length +
    filters.disabilities.length +
    filters.equipment.length +
    filters.roles.length +
    filters.groups.length

  const toggleGroup = (groupId: string) => {
    setFilters(prev => {
      const newGroups = prev.groups.includes(groupId)
        ? prev.groups.filter(g => g !== groupId)
        : [...prev.groups, groupId]
      return { ...prev, groups: newGroups }
    })
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Toggle Member Locations - hidden when parent controls visibility */}
      {!hideToggle && (
        <div className="flex items-center justify-between">
          <button
            onClick={onToggleShowMembers}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              showMemberLocations
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background hover:bg-muted'
            }`}
          >
            {showMemberLocations ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">
              {showMemberLocations ? 'Showing Members' : 'Show Members'}
            </span>
            {showMemberLocations && allMembers.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs">
                {filteredMembers.length}
              </span>
            )}
          </button>

          {showMemberLocations && (
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-1"
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
              {activeFilterCount > 0 && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground text-xs text-primary">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Header when hideToggle is true - shows member count */}
      {hideToggle && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-purple-500" />
            <span className="font-medium">Member Locations</span>
            {allMembers.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs">
                {filteredMembers.length} of {allMembers.length}
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Loading State */}
      {showMemberLocations && isLoading && (
        <div className="flex items-center justify-center py-4">
          <span className="material-icons animate-spin text-xl text-primary">sync</span>
          <span className="ml-2 text-sm text-muted-foreground">Loading member locations...</span>
        </div>
      )}

      {/* Filter Panel - always show when hideToggle is true, otherwise respect showFilters */}
      {showMemberLocations && (hideToggle || showFilters) && !isLoading && (
        <div className={`space-y-3 ${hideToggle ? '' : 'rounded-lg border border-border bg-card p-3'}`}>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={filters.searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-background pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {filters.searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Clear All - hidden when hideToggle since it's in the header */}
          {hasActiveFilters && !hideToggle && (
            <div className="flex justify-end">
              <button
                onClick={clearAllFilters}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            </div>
          )}

          {/* Role Filter */}
          <div className="border-b border-border pb-3">
            <button
              onClick={() => toggleCategory('roles')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">User Type</span>
                {filters.roles.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {filters.roles.length}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  expandedCategory === 'roles' ? 'rotate-180' : ''
                }`}
              />
            </button>
            {expandedCategory === 'roles' && (
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(COMMUNITY_ROLE_CONFIG) as CommunityRole[]).map(role => {
                  const config = COMMUNITY_ROLE_CONFIG[role]
                  const isSelected = filters.roles.includes(role)
                  return (
                    <button
                      key={role}
                      onClick={() => toggleRole(role)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      <span className="material-icons text-xs">{config.icon}</span>
                      {config.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Groups Filter - only show if groups exist */}
          {communityGroups.length > 0 && (
            <div className="border-b border-border pb-3">
              <button
                onClick={() => toggleCategory('groups')}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Groups</span>
                  {filters.groups.length > 0 && (
                    <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                      {filters.groups.length}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    expandedCategory === 'groups' ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {expandedCategory === 'groups' && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {communityGroups.map(group => {
                    const isSelected = filters.groups.includes(group.id)
                    return (
                      <button
                        key={group.id}
                        onClick={() => toggleGroup(group.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                          isSelected
                            ? 'text-white'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                        style={isSelected ? { backgroundColor: group.color } : {}}
                      >
                        <span className="material-icons text-xs">{group.icon}</span>
                        {group.name}
                        <span className="opacity-75">({group.member_count})</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Skills Filter */}
          <div className="border-b border-border pb-3">
            <button
              onClick={() => toggleCategory('skills')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <span className="material-icons text-base text-muted-foreground">medical_services</span>
                <span className="font-medium text-sm">Skills</span>
                {filters.skills.length > 0 && (
                  <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full">
                    {filters.skills.length}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  expandedCategory === 'skills' ? 'rotate-180' : ''
                }`}
              />
            </button>
            {expandedCategory === 'skills' && (
              <div className="mt-2 flex flex-wrap gap-2">
                {SKILL_OPTIONS.map(skill => {
                  const isSelected = filters.skills.includes(skill.value)
                  return (
                    <button
                      key={skill.value}
                      onClick={() => toggleFilter('skills', skill.value)}
                      className={`px-2 py-1 rounded-full text-xs transition-colors ${
                        isSelected
                          ? 'bg-green-500 text-white'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {skill.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Disabilities Filter */}
          <div className="border-b border-border pb-3">
            <button
              onClick={() => toggleCategory('disabilities')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <span className="material-icons text-base text-muted-foreground">accessible</span>
                <span className="font-medium text-sm">Needs</span>
                {filters.disabilities.length > 0 && (
                  <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full">
                    {filters.disabilities.length}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  expandedCategory === 'disabilities' ? 'rotate-180' : ''
                }`}
              />
            </button>
            {expandedCategory === 'disabilities' && (
              <div className="mt-2 flex flex-wrap gap-2">
                {DISABILITY_OPTIONS.map(option => {
                  const isSelected = filters.disabilities.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      onClick={() => toggleFilter('disabilities', option.value)}
                      className={`px-2 py-1 rounded-full text-xs transition-colors ${
                        isSelected
                          ? 'bg-blue-500 text-white'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Equipment Filter */}
          <div>
            <button
              onClick={() => toggleCategory('equipment')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <span className="material-icons text-base text-muted-foreground">construction</span>
                <span className="font-medium text-sm">Equipment</span>
                {filters.equipment.length > 0 && (
                  <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
                    {filters.equipment.length}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  expandedCategory === 'equipment' ? 'rotate-180' : ''
                }`}
              />
            </button>
            {expandedCategory === 'equipment' && (
              <div className="mt-2 flex flex-wrap gap-2">
                {EQUIPMENT_OPTIONS.map(option => {
                  const isSelected = filters.equipment.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      onClick={() => toggleFilter('equipment', option.value)}
                      className={`px-2 py-1 rounded-full text-xs transition-colors ${
                        isSelected
                          ? 'bg-amber-500 text-white'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results Summary */}
      {showMemberLocations && !isLoading && (
        <div className="text-xs text-muted-foreground">
          {allMembers.length === 0 ? (
            <span>No members with visible locations found</span>
          ) : hasActiveFilters ? (
            <span>
              Showing {filteredMembers.length} of {allMembers.length} members with locations
            </span>
          ) : (
            <span>{allMembers.length} members with locations</span>
          )}
        </div>
      )}

      {/* Privacy Note */}
      {showMemberLocations && !isLoading && allMembers.length > 0 && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
          <span className="material-icons text-xs align-middle mr-1">info</span>
          Member locations are shown based on their privacy settings.
          {viewerRole === 'member' && ' Some members may not be visible to you.'}
          {viewerRole === 'team_member' && ' You can see members who share with the community or Civil Defence team.'}
          {viewerRole === 'admin' && ' As admin, you can see all members who share with the community or Civil Defence team.'}
        </div>
      )}
    </div>
  )
}
