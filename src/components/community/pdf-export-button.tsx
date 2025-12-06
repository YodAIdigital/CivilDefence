'use client'

import { useState } from 'react'
import { Community, CommunityGuide } from '@/types/database'
import {
  downloadEmergencyPDF,
  PDFExportData,
  EmergencyContact,
  ChecklistCategory,
  KeyLocation,
} from '@/lib/pdf-export'

interface PDFExportButtonProps {
  community: Community
  guides: CommunityGuide[]
  className?: string
}

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

// Default checklist categories
const defaultChecklistCategories: ChecklistCategory[] = [
  {
    id: 'water',
    name: 'Water & Food',
    icon: 'water_drop',
    items: [
      { id: 'water-1', name: 'Drinking water (3L per person per day for 3+ days)', checked: false, recheckDays: 90 },
      { id: 'water-2', name: 'Water purification tablets or filter', checked: false, recheckDays: 90 },
      { id: 'food-1', name: 'Non-perishable food (3+ days supply)', checked: false, recheckDays: 90 },
      { id: 'food-2', name: 'Manual can opener', checked: false, recheckDays: 180 },
      { id: 'food-3', name: 'Eating utensils', checked: false, recheckDays: 180 },
    ],
  },
  {
    id: 'first-aid',
    name: 'First Aid & Medical',
    icon: 'medical_services',
    items: [
      { id: 'med-1', name: 'First aid kit', checked: false, recheckDays: 90 },
      { id: 'med-2', name: 'Prescription medications (7+ day supply)', checked: false, recheckDays: 90 },
      { id: 'med-3', name: 'Pain relievers', checked: false, recheckDays: 90 },
      { id: 'med-4', name: 'Bandages and dressings', checked: false, recheckDays: 90 },
      { id: 'med-5', name: 'Face masks', checked: false, recheckDays: 90 },
    ],
  },
  {
    id: 'tools',
    name: 'Tools & Equipment',
    icon: 'handyman',
    items: [
      { id: 'tool-1', name: 'Torch/flashlight with extra batteries', checked: false, recheckDays: 90 },
      { id: 'tool-2', name: 'Battery-powered or crank radio', checked: false, recheckDays: 90 },
      { id: 'tool-3', name: 'Phone charger and power bank', checked: false, recheckDays: 90 },
      { id: 'tool-4', name: 'Whistle (for signalling)', checked: false, recheckDays: 180 },
      { id: 'tool-5', name: 'Multi-tool', checked: false, recheckDays: 180 },
    ],
  },
  {
    id: 'shelter',
    name: 'Shelter & Warmth',
    icon: 'home',
    items: [
      { id: 'shelter-1', name: 'Emergency blankets or sleeping bags', checked: false, recheckDays: 180 },
      { id: 'shelter-2', name: 'Warm clothing', checked: false, recheckDays: 180 },
      { id: 'shelter-3', name: 'Sturdy shoes', checked: false, recheckDays: 180 },
      { id: 'shelter-4', name: 'Rain gear', checked: false, recheckDays: 180 },
    ],
  },
  {
    id: 'documents',
    name: 'Documents & Money',
    icon: 'description',
    items: [
      { id: 'doc-1', name: 'Copies of important documents (waterproof bag)', checked: false, recheckDays: 365 },
      { id: 'doc-2', name: 'Cash in small denominations', checked: false, recheckDays: 365 },
      { id: 'doc-3', name: 'Emergency contact list', checked: false, recheckDays: 365 },
      { id: 'doc-4', name: 'Local area map', checked: false, recheckDays: 365 },
    ],
  },
  {
    id: 'hygiene',
    name: 'Hygiene & Sanitation',
    icon: 'sanitizer',
    items: [
      { id: 'hyg-1', name: 'Toilet paper', checked: false, recheckDays: 90 },
      { id: 'hyg-2', name: 'Wet wipes', checked: false, recheckDays: 90 },
      { id: 'hyg-3', name: 'Rubbish bags', checked: false, recheckDays: 180 },
      { id: 'hyg-4', name: 'Soap', checked: false, recheckDays: 90 },
    ],
  },
]

// Helper to apply stored item states to default checklist structure
function applyStoredItemsToDefaults(
  storedItems: Record<string, { checked: boolean; lastChecked?: string }>
): ChecklistCategory[] {
  return defaultChecklistCategories.map(category => ({
    ...category,
    items: category.items.map(item => {
      const stored = storedItems[item.id]
      if (stored && stored.lastChecked) {
        return {
          ...item,
          checked: stored.checked,
          lastChecked: stored.lastChecked,
        }
      }
      return item
    }),
  }))
}

// Get checklist from localStorage (community-specific)
function getChecklistFromStorage(communityId: string): ChecklistCategory[] {
  if (typeof window === 'undefined') return defaultChecklistCategories

  // Try community-specific key (v2 format)
  try {
    const communityKey = `civildefence_checklist_v2_${communityId}`
    const stored = localStorage.getItem(communityKey)
    if (stored) {
      const data = JSON.parse(stored)
      // v2 format stores items separately, need to merge with default structure
      if (data.items) {
        return applyStoredItemsToDefaults(data.items)
      }
      return data
    }
  } catch {
    // Ignore errors
  }

  // Return default checklist structure
  return defaultChecklistCategories
}

export function PDFExportButton({ community, guides, className = '' }: PDFExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)

    try {
      // Build key locations from community data and guides
      const keyLocations: KeyLocation[] = []

      // Add meeting point if exists
      if (community.meeting_point_name) {
        const location: KeyLocation = {
          name: community.meeting_point_name,
          type: 'meeting_point',
        }
        if (community.meeting_point_address) location.address = community.meeting_point_address
        if (community.meeting_point_lat) location.lat = community.meeting_point_lat
        if (community.meeting_point_lng) location.lng = community.meeting_point_lng
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
            // Avoid duplicates
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

      // Get checklist from localStorage (community-specific)
      const checklist = getChecklistFromStorage(community.id)

      // Build export data
      const exportData: PDFExportData = {
        community,
        guides: guides.filter(g => g.is_active),
        contacts: allContacts,
        checklist,
        keyLocations,
        generatedDate: new Date(),
      }

      await downloadEmergencyPDF(exportData)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className={`flex items-center gap-2 rounded-lg bg-[#000542] px-4 py-2 text-sm font-medium text-white hover:bg-[#313A64] disabled:opacity-50 ${className}`}
    >
      {isExporting ? (
        <>
          <span className="material-icons animate-spin text-lg">sync</span>
          Generating PDF...
        </>
      ) : (
        <>
          <span className="material-icons text-lg">picture_as_pdf</span>
          Download Emergency Plan (PDF)
        </>
      )}
    </button>
  )
}
