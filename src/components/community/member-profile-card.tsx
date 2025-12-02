'use client'

import { useState } from 'react'
import { Phone, MapPin, AlertTriangle, Heart, Mail } from 'lucide-react'
import type { Profile, CommunityRole, ProfileExtended, FieldVisibility, EmergencyContact } from '@/types/database'
import {
  SKILL_OPTIONS,
  DISABILITY_OPTIONS,
  EQUIPMENT_OPTIONS,
  COMMUNITY_ROLE_CONFIG,
  RELATIONSHIP_OPTIONS,
} from '@/types/database'

interface CommunityMemberWithProfile {
  id: string
  user_id: string
  community_id: string
  role: CommunityRole
  joined_at: string
  profile: Profile | null
}

interface MemberProfileCardProps {
  member: CommunityMemberWithProfile
  isCurrentUser: boolean
  isAdmin: boolean // Whether the viewer is an admin
  onRoleChange?: (memberId: string, newRole: CommunityRole) => void
  onRemove?: (memberId: string, userId: string) => void
  isUpdating?: boolean
}

// Helper to get extended profile data
function getExtendedProfile(profile: Profile | null): ProfileExtended | null {
  if (!profile) return null
  return (profile.notification_preferences as ProfileExtended) || null
}

// Helper to check if a field is visible based on privacy settings
function isFieldVisible(
  extended: ProfileExtended | null,
  fieldGroup: keyof NonNullable<ProfileExtended['visibility']>,
  isAdmin: boolean
): boolean {
  if (!extended?.visibility) return true // Default to visible if no privacy settings
  const visibility = extended.visibility[fieldGroup] as FieldVisibility | undefined
  if (!visibility || visibility === 'community') return true
  if (visibility === 'civil_defence_only') return isAdmin
  return false // 'private'
}

// Calculate age from date of birth
function calculateAge(dateOfBirth: string): number | null {
  if (!dateOfBirth) return null
  const dob = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  return age
}

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function MemberProfileCard({
  member,
  isCurrentUser,
  isAdmin,
  onRoleChange,
  onRemove,
  isUpdating = false,
}: MemberProfileCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showImagePopup, setShowImagePopup] = useState(false)

  const profile = member.profile
  const extended = getExtendedProfile(profile)
  const roleConfig = COMMUNITY_ROLE_CONFIG[member.role as keyof typeof COMMUNITY_ROLE_CONFIG]

  // Get avatar URL or use initials
  const avatarUrl = profile?.avatar_url
  const initials = profile?.full_name?.charAt(0).toUpperCase() || profile?.email?.charAt(0).toUpperCase() || 'U'

  // Calculate age if DOB is available and visible
  const age = extended?.date_of_birth && isFieldVisible(extended, 'personal_info', isAdmin)
    ? calculateAge(extended.date_of_birth)
    : null

  // Check what data is available and visible
  const hasPersonalInfo = isFieldVisible(extended, 'personal_info', isAdmin) && (
    extended?.address || extended?.mobile_number || extended?.secondary_number
  )
  const hasHousehold = isFieldVisible(extended, 'household', isAdmin) &&
    extended?.household_members && extended.household_members.length > 0
  const hasEmergencyContacts = isFieldVisible(extended, 'emergency_contact', isAdmin) && (
    (extended?.emergency_contacts && extended.emergency_contacts.length > 0) ||
    extended?.emergency_contact_name
  )
  const hasDisabilities = isFieldVisible(extended, 'disabilities', isAdmin) &&
    extended?.disabilities && extended.disabilities.length > 0
  const hasSkills = isFieldVisible(extended, 'skills', isAdmin) &&
    extended?.skills && extended.skills.length > 0
  const hasEquipment = isFieldVisible(extended, 'equipment', isAdmin) &&
    extended?.equipment && extended.equipment.length > 0

  const hasExpandableContent = hasPersonalInfo || hasHousehold || hasEmergencyContacts || hasDisabilities || hasSkills || hasEquipment || profile?.email

  // Get the phone number to display (prefer mobile from extended, fallback to profile phone)
  const displayPhone = extended?.mobile_number || profile?.phone

  return (
    <div className="hover:bg-muted/50 transition-colors">
      {/* Main Row - Entire bar is clickable */}
      <div
        onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
        className={`p-4 ${hasExpandableContent ? 'cursor-pointer' : ''}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Avatar - clickable to open popup */}
            <div
              className="relative flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                if (avatarUrl) {
                  setShowImagePopup(true)
                }
              }}
            >
              <div className={`h-10 w-10 overflow-hidden rounded-full bg-gradient-to-br from-primary to-accent ${avatarUrl ? 'cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all' : ''}`}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={profile?.full_name || 'User'}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const sibling = e.currentTarget.nextElementSibling
                      if (sibling) sibling.classList.remove('hidden')
                    }}
                  />
                ) : null}
                <div className={`flex h-full w-full items-center justify-center text-sm font-medium text-white ${avatarUrl ? 'hidden' : ''}`}>
                  {initials}
                </div>
              </div>
            </div>

            {/* Name, phone, and role */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">
                  {profile?.full_name || profile?.email || 'Unknown User'}
                  {age !== null && ` (${age})`}
                </span>
                {isCurrentUser && (
                  <span className="text-xs text-muted-foreground">(You)</span>
                )}
                {member.role !== 'member' && roleConfig && (
                  <span
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${roleConfig.color}20`,
                      color: roleConfig.color
                    }}
                  >
                    <span className="material-icons text-xs">{roleConfig.icon}</span>
                    {roleConfig.label}
                  </span>
                )}
              </div>
              {/* Phone number only in collapsed view */}
              {displayPhone && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <a
                    href={`tel:${displayPhone}`}
                    className="hover:text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {displayPhone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Actions - stop propagation to prevent expand on click */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
            {onRoleChange && (
              <select
                value={member.role}
                onChange={(e) => onRoleChange(member.id, e.target.value as CommunityRole)}
                disabled={isUpdating}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              >
                <option value="member">Member</option>
                <option value="team_member">Team Member</option>
                <option value="admin">Admin</option>
              </select>
            )}

            {onRemove && !isCurrentUser && (
              <button
                onClick={() => onRemove(member.id, member.user_id)}
                disabled={isUpdating}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                title="Remove member"
              >
                {isUpdating ? (
                  <span className="material-icons animate-spin text-lg">sync</span>
                ) : (
                  <span className="material-icons text-lg">person_remove</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Profile Section */}
      {isExpanded && hasExpandableContent && (
        <div className="px-4 pb-4 border-t border-border mx-4">
          <div className="pt-4 grid gap-4 md:grid-cols-2">
            {/* Email - only shown when expanded */}
            {profile?.email && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Email
                </h4>
                <div className="text-sm text-muted-foreground pl-6">
                  <a href={`mailto:${profile.email}`} className="hover:text-primary">
                    {profile.email}
                  </a>
                </div>
              </div>
            )}

            {/* Personal Information */}
            {hasPersonalInfo && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Contact Information
                </h4>
                <div className="text-sm text-muted-foreground space-y-1 pl-6">
                  {extended?.address && (
                    <p className="flex items-start gap-2">
                      <span className="material-icons text-xs mt-0.5">home</span>
                      {extended.address}
                    </p>
                  )}
                  {extended?.mobile_number && (
                    <p className="flex items-center gap-2">
                      <span className="material-icons text-xs">phone_iphone</span>
                      <a href={`tel:${extended.mobile_number}`} className="hover:text-primary">
                        {extended.mobile_number}
                      </a>
                    </p>
                  )}
                  {extended?.secondary_number && (
                    <p className="flex items-center gap-2">
                      <span className="material-icons text-xs">phone</span>
                      <a href={`tel:${extended.secondary_number}`} className="hover:text-primary">
                        {extended.secondary_number}
                      </a>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Household Members */}
            {hasHousehold && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <span className="material-icons text-base text-purple-500">family_restroom</span>
                  Household Members ({extended?.household_members?.length})
                </h4>
                <div className="text-sm text-muted-foreground space-y-2 pl-6">
                  {extended?.household_members?.map((householdMember) => (
                    <div key={householdMember.id} className="flex items-start gap-2">
                      <span className="material-icons text-xs mt-0.5">person</span>
                      <div>
                        <span className="font-medium text-foreground">{householdMember.name}</span>
                        {householdMember.age && <span className="text-xs ml-1">(Age: {householdMember.age})</span>}
                        {householdMember.contact_number && (
                          <a href={`tel:${householdMember.contact_number}`} className="flex items-center gap-1 hover:text-primary text-xs">
                            <span className="material-icons text-xs">phone</span>
                            {householdMember.contact_number}
                          </a>
                        )}
                        {householdMember.email && (
                          <a href={`mailto:${householdMember.email}`} className="flex items-center gap-1 hover:text-primary text-xs">
                            <span className="material-icons text-xs">email</span>
                            {householdMember.email}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Emergency Contacts */}
            {hasEmergencyContacts && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Emergency Contacts
                </h4>
                <div className="text-sm text-muted-foreground space-y-2 pl-6">
                  {extended?.emergency_contacts?.map((contact: EmergencyContact, index: number) => {
                    const relationship = RELATIONSHIP_OPTIONS.find(r => r.value === contact.relationship)?.label || contact.relationship
                    return (
                      <div key={contact.id || index} className="flex items-start gap-2">
                        <span className="material-icons text-xs mt-0.5">person</span>
                        <div>
                          <span className="font-medium text-foreground">{contact.name}</span>
                          {relationship && <span className="text-xs ml-1">({relationship})</span>}
                          {contact.phone && (
                            <a href={`tel:${contact.phone}`} className="block hover:text-primary">
                              {contact.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {/* Legacy emergency contact support */}
                  {!extended?.emergency_contacts?.length && extended?.emergency_contact_name && (
                    <div className="flex items-start gap-2">
                      <span className="material-icons text-xs mt-0.5">person</span>
                      <div>
                        <span className="font-medium text-foreground">{extended.emergency_contact_name}</span>
                        {extended.emergency_contact_number && (
                          <a href={`tel:${extended.emergency_contact_number}`} className="block hover:text-primary">
                            {extended.emergency_contact_number}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Disabilities/Needs */}
            {hasDisabilities && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  Special Needs
                </h4>
                <div className="flex flex-wrap gap-1 pl-6">
                  {extended?.disabilities?.map((disability) => {
                    const label = DISABILITY_OPTIONS.find(d => d.value === disability)?.label || disability
                    return (
                      <span
                        key={disability}
                        className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      >
                        <span className="material-icons text-xs mr-1">accessible</span>
                        {label}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Skills */}
            {hasSkills && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <span className="material-icons text-base text-green-500">medical_services</span>
                  Skills & Qualifications
                </h4>
                <div className="flex flex-wrap gap-1 pl-6">
                  {extended?.skills?.map((skill) => {
                    const label = SKILL_OPTIONS.find(s => s.value === skill)?.label || skill
                    return (
                      <span
                        key={skill}
                        className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                      >
                        {label}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Equipment */}
            {hasEquipment && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <span className="material-icons text-base text-amber-500">construction</span>
                  Equipment
                </h4>
                <div className="flex flex-wrap gap-1 pl-6">
                  {extended?.equipment?.map((equip) => {
                    const label = EQUIPMENT_OPTIONS.find(e => e.value === equip)?.label || equip
                    return (
                      <span
                        key={equip}
                        className="inline-flex items-center px-2 py-1 rounded text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                      >
                        {label}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Join date and last active - at bottom of expanded section */}
          <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="material-icons text-xs">calendar_today</span>
              Joined {formatDate(member.joined_at)}
            </span>
            {profile?.updated_at && (
              <span className="flex items-center gap-1">
                <span className="material-icons text-xs">schedule</span>
                Last active {formatDate(profile.updated_at)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Profile Picture Popup */}
      {showImagePopup && avatarUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowImagePopup(false)}
        >
          <div
            className="relative max-w-lg w-full bg-card rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold">{profile?.full_name || 'Profile Picture'}</h3>
              <button
                onClick={() => setShowImagePopup(false)}
                className="p-1 hover:bg-muted rounded-lg transition-colors"
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            {/* Image */}
            <div className="p-4 flex items-center justify-center bg-muted/30">
              <img
                src={avatarUrl}
                alt={profile?.full_name || 'Profile'}
                className="max-h-[60vh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
