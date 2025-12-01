'use client'

import { useState, useMemo } from 'react'
import { Search, Filter, X, ChevronDown, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Profile, CommunityRole, ProfileExtended } from '@/types/database'
import {
  SKILL_OPTIONS,
  DISABILITY_OPTIONS,
  EQUIPMENT_OPTIONS,
  COMMUNITY_ROLE_CONFIG,
} from '@/types/database'

export interface CommunityMemberWithProfile {
  id: string
  user_id: string
  community_id: string
  role: CommunityRole
  joined_at: string
  profile: Profile | null
}

interface MemberSearchFilterProps {
  members: CommunityMemberWithProfile[]
  onFilteredMembersChange: (members: CommunityMemberWithProfile[]) => void
  className?: string
}

type FilterCategory = 'skills' | 'disabilities' | 'equipment' | 'roles'

interface ActiveFilters {
  searchQuery: string
  skills: string[]
  disabilities: string[]
  equipment: string[]
  roles: CommunityRole[]
}

const initialFilters: ActiveFilters = {
  searchQuery: '',
  skills: [],
  disabilities: [],
  equipment: [],
  roles: [],
}

export function MemberSearchFilter({
  members,
  onFilteredMembersChange,
  className = '',
}: MemberSearchFilterProps) {
  const [filters, setFilters] = useState<ActiveFilters>(initialFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<FilterCategory | null>(null)

  // Get extended profile data from notification_preferences
  const getExtendedProfile = (profile: Profile | null): ProfileExtended | null => {
    if (!profile) return null
    return (profile.notification_preferences as ProfileExtended) || null
  }

  // Filter members based on all active filters
  const filteredMembers = useMemo(() => {
    let result = [...members]

    // Search by name, email, or phone
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase().trim()
      result = result.filter((member) => {
        const profile = member.profile
        if (!profile) return false

        const fullName = profile.full_name?.toLowerCase() || ''
        const email = profile.email?.toLowerCase() || ''
        const phone = profile.phone?.toLowerCase() || ''

        // Also check extended profile for mobile/secondary numbers
        const extended = getExtendedProfile(profile)
        const mobileNumber = extended?.mobile_number?.toLowerCase() || ''
        const secondaryNumber = extended?.secondary_number?.toLowerCase() || ''

        return (
          fullName.includes(query) ||
          email.includes(query) ||
          phone.includes(query) ||
          mobileNumber.includes(query) ||
          secondaryNumber.includes(query)
        )
      })
    }

    // Filter by role
    if (filters.roles.length > 0) {
      result = result.filter((member) => filters.roles.includes(member.role))
    }

    // Filter by skills
    if (filters.skills.length > 0) {
      result = result.filter((member) => {
        const extended = getExtendedProfile(member.profile)
        if (!extended?.skills) return false
        return filters.skills.some((skill) => extended.skills?.includes(skill))
      })
    }

    // Filter by disabilities
    if (filters.disabilities.length > 0) {
      result = result.filter((member) => {
        const extended = getExtendedProfile(member.profile)
        if (!extended?.disabilities) return false
        return filters.disabilities.some((disability) =>
          extended.disabilities?.includes(disability)
        )
      })
    }

    // Filter by equipment
    if (filters.equipment.length > 0) {
      result = result.filter((member) => {
        const extended = getExtendedProfile(member.profile)
        if (!extended?.equipment) return false
        return filters.equipment.some((equip) => extended.equipment?.includes(equip))
      })
    }

    return result
  }, [members, filters])

  // Update parent component when filtered members change
  useMemo(() => {
    onFilteredMembersChange(filteredMembers)
  }, [filteredMembers, onFilteredMembersChange])

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: value }))
  }

  const toggleFilter = (category: FilterCategory, value: string) => {
    setFilters((prev) => {
      const currentValues = prev[category] as string[]
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value]
      return { ...prev, [category]: newValues }
    })
  }

  const toggleRole = (role: CommunityRole) => {
    setFilters((prev) => {
      const newRoles = prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role]
      return { ...prev, roles: newRoles }
    })
  }

  const clearAllFilters = () => {
    setFilters(initialFilters)
  }

  const hasActiveFilters =
    filters.searchQuery ||
    filters.skills.length > 0 ||
    filters.disabilities.length > 0 ||
    filters.equipment.length > 0 ||
    filters.roles.length > 0

  const activeFilterCount =
    filters.skills.length +
    filters.disabilities.length +
    filters.equipment.length +
    filters.roles.length

  const toggleCategory = (category: FilterCategory) => {
    setExpandedCategory((prev) => (prev === category ? null : category))
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Bar and Filter Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={filters.searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
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
        <Button
          variant={showFilters ? 'default' : 'outline'}
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2 shrink-0"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground text-xs text-primary">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          {/* Clear All Button */}
          {hasActiveFilters && (
            <div className="flex justify-end">
              <button
                onClick={clearAllFilters}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                Clear all filters
              </button>
            </div>
          )}

          {/* Role Filter */}
          <div className="border-b border-border pb-4">
            <button
              onClick={() => toggleCategory('roles')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">User Type</span>
                {filters.roles.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {filters.roles.length} selected
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
              <div className="mt-3 flex flex-wrap gap-2">
                {(Object.keys(COMMUNITY_ROLE_CONFIG) as CommunityRole[]).map((role) => {
                  const config = COMMUNITY_ROLE_CONFIG[role]
                  const isSelected = filters.roles.includes(role)
                  return (
                    <button
                      key={role}
                      onClick={() => toggleRole(role)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      <span className="material-icons text-sm">{config.icon}</span>
                      {config.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Skills Filter */}
          <div className="border-b border-border pb-4">
            <button
              onClick={() => toggleCategory('skills')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <span className="material-icons text-lg text-muted-foreground">medical_services</span>
                <span className="font-medium text-sm">Skills & Qualifications</span>
                {filters.skills.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {filters.skills.length} selected
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
              <div className="mt-3 flex flex-wrap gap-2">
                {SKILL_OPTIONS.map((skill) => {
                  const isSelected = filters.skills.includes(skill.value)
                  return (
                    <button
                      key={skill.value}
                      onClick={() => toggleFilter('skills', skill.value)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
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

          {/* Disability Needs Filter */}
          <div className="border-b border-border pb-4">
            <button
              onClick={() => toggleCategory('disabilities')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <span className="material-icons text-lg text-muted-foreground">accessible</span>
                <span className="font-medium text-sm">Disability Needs</span>
                {filters.disabilities.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {filters.disabilities.length} selected
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
              <div className="mt-3 flex flex-wrap gap-2">
                {DISABILITY_OPTIONS.map((disability) => {
                  const isSelected = filters.disabilities.includes(disability.value)
                  return (
                    <button
                      key={disability.value}
                      onClick={() => toggleFilter('disabilities', disability.value)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        isSelected
                          ? 'bg-blue-500 text-white'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {disability.label}
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
                <span className="material-icons text-lg text-muted-foreground">construction</span>
                <span className="font-medium text-sm">Equipment</span>
                {filters.equipment.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {filters.equipment.length} selected
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
              <div className="mt-3 flex flex-wrap gap-2">
                {EQUIPMENT_OPTIONS.map((equip) => {
                  const isSelected = filters.equipment.includes(equip.value)
                  return (
                    <button
                      key={equip.value}
                      onClick={() => toggleFilter('equipment', equip.value)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        isSelected
                          ? 'bg-amber-500 text-white'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {equip.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Filter Tags */}
      {hasActiveFilters && !showFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          {filters.roles.map((role) => (
            <span
              key={role}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-primary/10 text-primary"
            >
              {COMMUNITY_ROLE_CONFIG[role].label}
              <button
                onClick={() => toggleRole(role)}
                className="hover:text-primary/70"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {filters.skills.map((skill) => {
            const label = SKILL_OPTIONS.find((s) => s.value === skill)?.label || skill
            return (
              <span
                key={skill}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
              >
                {label}
                <button
                  onClick={() => toggleFilter('skills', skill)}
                  className="hover:text-green-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
          {filters.disabilities.map((disability) => {
            const label =
              DISABILITY_OPTIONS.find((d) => d.value === disability)?.label || disability
            return (
              <span
                key={disability}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              >
                {label}
                <button
                  onClick={() => toggleFilter('disabilities', disability)}
                  className="hover:text-blue-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
          {filters.equipment.map((equip) => {
            const label = EQUIPMENT_OPTIONS.find((e) => e.value === equip)?.label || equip
            return (
              <span
                key={equip}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
              >
                {label}
                <button
                  onClick={() => toggleFilter('equipment', equip)}
                  className="hover:text-amber-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {filteredMembers.length} of {members.length} members
        </span>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-primary hover:text-primary/80 text-xs"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}

// Helper component to display member's extended info (skills, disabilities, equipment)
export function MemberExtendedInfo({ profile }: { profile: Profile | null }) {
  if (!profile) return null

  const extended = (profile.notification_preferences as ProfileExtended) || null
  if (!extended) return null

  const hasSkills = extended.skills && extended.skills.length > 0
  const hasDisabilities = extended.disabilities && extended.disabilities.length > 0
  const hasEquipment = extended.equipment && extended.equipment.length > 0

  if (!hasSkills && !hasDisabilities && !hasEquipment) return null

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {hasSkills &&
        extended.skills?.map((skill) => {
          const label = SKILL_OPTIONS.find((s) => s.value === skill)?.label || skill
          return (
            <span
              key={skill}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
              title={`Skill: ${label}`}
            >
              <span className="material-icons text-xs mr-0.5">medical_services</span>
              {label}
            </span>
          )
        })}
      {hasDisabilities &&
        extended.disabilities?.map((disability) => {
          const label =
            DISABILITY_OPTIONS.find((d) => d.value === disability)?.label || disability
          return (
            <span
              key={disability}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              title={`Need: ${label}`}
            >
              <span className="material-icons text-xs mr-0.5">accessible</span>
              {label}
            </span>
          )
        })}
      {hasEquipment &&
        extended.equipment?.map((equip) => {
          const label = EQUIPMENT_OPTIONS.find((e) => e.value === equip)?.label || equip
          return (
            <span
              key={equip}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
              title={`Equipment: ${label}`}
            >
              <span className="material-icons text-xs mr-0.5">construction</span>
              {label}
            </span>
          )
        })}
    </div>
  )
}
