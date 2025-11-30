'use client'

import { useState } from 'react'
import { useCommunity } from '@/contexts/community-context'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase/client'
import {
  downloadEmergencyPDF,
  PDFExportData,
  EmergencyContact,
  ChecklistCategory,
  KeyLocation,
  UserProfileData,
} from '@/lib/pdf-export'
import type { CommunityGuide, Community, ProfileExtended } from '@/types/database'

// Default emergency contacts (NZ)
const defaultContacts: EmergencyContact[] = [
  { name: 'Emergency Services', number: '111', description: 'Police, Fire, Ambulance - Life threatening emergencies' },
  { name: 'Police (Non-urgent)', number: '105', description: 'Report non-urgent crimes and incidents' },
  { name: 'Civil Defence Emergency', number: '0800 22 22 00', description: 'National Emergency Management Agency' },
  { name: 'Healthline', number: '0800 611 116', description: '24/7 free health advice from registered nurses' },
  { name: 'Poison Control', number: '0800 764 766', description: 'National Poisons Centre - 24/7 advice' },
  { name: 'Mental Health Crisis', number: '1737', description: 'Free call or text - 24/7 mental health support' },
  { name: 'Gas Emergency', number: '0800 111 323', description: '24/7 gas emergency line' },
  { name: 'Road Conditions', number: '0800 44 44 49', description: 'NZTA road information and updates' },
]

// Get checklist from localStorage
function getChecklistFromStorage(): ChecklistCategory[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem('civildefence_checklist')
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore errors
  }

  // Return default checklist structure
  return [
    {
      id: 'water',
      name: 'Water & Food',
      icon: 'water_drop',
      items: [
        { id: 'water-1', name: 'Drinking water (3L per person per day for 3+ days)', checked: false, recheckDays: 90 },
        { id: 'food-1', name: 'Non-perishable food (3+ days supply)', checked: false, recheckDays: 90 },
        { id: 'food-2', name: 'Manual can opener', checked: false, recheckDays: 180 },
      ],
    },
    {
      id: 'first-aid',
      name: 'First Aid & Medical',
      icon: 'medical_services',
      items: [
        { id: 'med-1', name: 'First aid kit', checked: false, recheckDays: 90 },
        { id: 'med-2', name: 'Prescription medications (7+ day supply)', checked: false, recheckDays: 90 },
      ],
    },
    {
      id: 'tools',
      name: 'Tools & Equipment',
      icon: 'handyman',
      items: [
        { id: 'tool-1', name: 'Torch/flashlight with extra batteries', checked: false, recheckDays: 90 },
        { id: 'tool-2', name: 'Battery-powered or crank radio', checked: false, recheckDays: 90 },
      ],
    },
  ]
}

export function PDFExportWidget() {
  const { activeCommunity } = useCommunity()
  const { profile, user } = useAuth()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    if (!activeCommunity) return

    setIsExporting(true)

    try {
      // Fetch the full profile data including notification_preferences which stores extended data
      let extendedProfile: ProfileExtended | null = null
      if (user?.id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileData?.notification_preferences && typeof profileData.notification_preferences === 'object') {
          extendedProfile = profileData.notification_preferences as unknown as ProfileExtended
        }
      }

      // Build UserProfileData from profile and extended data
      const userProfileData: UserProfileData = {
        full_name: profile?.full_name || undefined,
        email: profile?.email || undefined,
        phone: profile?.phone || undefined,
        address: extendedProfile?.address || undefined,
        mobile_number: extendedProfile?.mobile_number || undefined,
        secondary_number: extendedProfile?.secondary_number || undefined,
        date_of_birth: extendedProfile?.date_of_birth || undefined,
        emergency_contacts: extendedProfile?.emergency_contacts || undefined,
        home_insurance: extendedProfile?.home_insurance || undefined,
        car_insurance: extendedProfile?.car_insurance || undefined,
        medical_insurance: extendedProfile?.medical_insurance || undefined,
        utility_companies: extendedProfile?.utility_companies || undefined,
        skills: extendedProfile?.skills || undefined,
        disabilities: extendedProfile?.disabilities || undefined,
        has_backup_power: extendedProfile?.has_backup_power,
        has_backup_water: extendedProfile?.has_backup_water,
        has_food_supply: extendedProfile?.has_food_supply,
        general_comments: extendedProfile?.general_comments || undefined,
      }

      // Fetch guides for the active community
      const { data: guidesData } = await (supabase
        .from('community_guides' as 'profiles')
        .select('*')
        .eq('community_id', activeCommunity.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true }) as unknown as Promise<{ data: CommunityGuide[] | null; error: Error | null }>)

      let guides: CommunityGuide[] = []
      if (guidesData) {
        guides = guidesData.map((g: CommunityGuide) => ({
          ...g,
          sections: typeof g.sections === 'string' ? JSON.parse(g.sections as unknown as string) : g.sections,
          supplies: typeof g.supplies === 'string' ? JSON.parse(g.supplies as unknown as string) : g.supplies,
          emergency_contacts: typeof g.emergency_contacts === 'string' ? JSON.parse(g.emergency_contacts as unknown as string) : g.emergency_contacts,
          local_resources: typeof g.local_resources === 'string' ? JSON.parse(g.local_resources as unknown as string) : g.local_resources,
        }))
      }

      // Build key locations from community data and guides
      const keyLocations: KeyLocation[] = []

      // Add meeting point if exists
      if (activeCommunity.meeting_point_name) {
        const location: KeyLocation = {
          name: activeCommunity.meeting_point_name,
          type: 'meeting_point',
        }
        if (activeCommunity.meeting_point_address) location.address = activeCommunity.meeting_point_address
        if (activeCommunity.meeting_point_lat) location.lat = activeCommunity.meeting_point_lat
        if (activeCommunity.meeting_point_lng) location.lng = activeCommunity.meeting_point_lng
        keyLocations.push(location)
      }

      // Add local resources from guides
      guides.forEach(guide => {
        if (guide.local_resources) {
          guide.local_resources.forEach(resource => {
            const location: KeyLocation = {
              name: resource.name,
              type: resource.type as KeyLocation['type'],
            }
            if (resource.address) location.address = resource.address
            if (resource.phone) location.phone = resource.phone
            if (resource.lat) location.lat = resource.lat
            if (resource.lng) location.lng = resource.lng
            keyLocations.push(location)
          })
        }
      })

      // Collect emergency contacts from guides
      const guideContacts: EmergencyContact[] = []
      guides.forEach(guide => {
        if (guide.emergency_contacts) {
          guide.emergency_contacts.forEach(contact => {
            if (!guideContacts.find(c => c.number === contact.number)) {
              guideContacts.push(contact)
            }
          })
        }
      })

      // Combine with default contacts
      const allContacts = [...defaultContacts]
      guideContacts.forEach(gc => {
        if (!allContacts.find(c => c.number === gc.number)) {
          allContacts.push(gc)
        }
      })

      // Get checklist from localStorage
      const checklist = getChecklistFromStorage()

      // Build export data - spread activeCommunity to exclude userRole
      const { userRole: _userRole, ...communityData } = activeCommunity
      const exportData: PDFExportData = {
        community: communityData as Community,
        guides,
        contacts: allContacts,
        checklist,
        keyLocations,
        generatedDate: new Date(),
        userProfile: userProfileData,
      }

      await downloadEmergencyPDF(exportData)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  if (!activeCommunity) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <span className="material-icons text-muted-foreground">picture_as_pdf</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Emergency Plan PDF</p>
            <p className="text-xs text-muted-foreground">Select a community first</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#000542]/10">
          <span className="material-icons text-[#000542]">picture_as_pdf</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Emergency Plan</p>
          <p className="text-xs text-muted-foreground">{activeCommunity.name}</p>
        </div>
      </div>
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#000542] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#313A64] disabled:opacity-50 transition-colors"
      >
        {isExporting ? (
          <>
            <span className="material-icons animate-spin text-lg">sync</span>
            Generating...
          </>
        ) : (
          <>
            <span className="material-icons text-lg">download</span>
            Download PDF
          </>
        )}
      </button>
      <p className="mt-2 text-xs text-center text-muted-foreground">
        Includes response plans, contacts & checklist
      </p>
    </div>
  )
}
