'use client'

import { useState } from 'react'
import { Community, CommunityGuide } from '@/types/database'
import {
  downloadEmergencyPDF,
  PDFExportData,
  EmergencyContact,
  ChecklistCategory as PDFChecklistCategory,
  KeyLocation,
} from '@/lib/pdf-export'
import {
  generateDynamicChecklist,
  type ChecklistCategory as DynamicChecklistCategory,
  type ResponsePlanSupplies,
} from '@/lib/dynamic-kit-generator'
import { guideTemplates } from '@/data/guide-templates'

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

// Convert dynamic checklist to PDF format and apply stored states
function convertToPDFChecklist(
  dynamicChecklist: DynamicChecklistCategory[],
  storedItems: Record<string, { checked: boolean; lastChecked?: string }>
): PDFChecklistCategory[] {
  return dynamicChecklist.map(category => ({
    id: category.id,
    name: category.name,
    icon: category.icon,
    items: category.items.map(item => {
      const stored = storedItems[item.id]
      const result: PDFChecklistCategory['items'][0] = {
        id: item.id,
        name: item.name,
        checked: stored?.checked ?? item.checked,
        recheckDays: item.recheckDays,
      }
      const lastChecked = stored?.lastChecked ?? item.lastChecked
      if (lastChecked) {
        result.lastChecked = lastChecked
      }
      return result
    }),
  }))
}

// Get stored checklist item states from localStorage (community-specific)
function getStoredChecklistItems(communityId: string): Record<string, { checked: boolean; lastChecked?: string }> {
  if (typeof window === 'undefined') return {}

  try {
    const communityKey = `civildefence_checklist_v2_${communityId}`
    const stored = localStorage.getItem(communityKey)
    if (stored) {
      const data = JSON.parse(stored)
      if (data.items) {
        return data.items
      }
    }
  } catch {
    // Ignore errors
  }

  return {}
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

      // Build response plans for dynamic checklist generation
      const responsePlans: ResponsePlanSupplies[] = guides.map(guide => {
        const guideAny = guide as unknown as { supplies?: string[]; guide_type?: string }
        let supplies: string[] = []

        if (guideAny.supplies && Array.isArray(guideAny.supplies)) {
          supplies = guideAny.supplies
        } else {
          // Get from template
          const template = guideTemplates.find(t => t.type === guideAny.guide_type)
          if (template) {
            supplies = template.supplies
          }
        }

        const template = guideTemplates.find(t => t.type === guideAny.guide_type)
        return {
          planName: template?.name || guideAny.guide_type || 'Response Plan',
          planType: guideAny.guide_type || 'general',
          planIcon: template?.icon || 'emergency',
          supplies,
        }
      })

      // Generate dynamic checklist (without user profile since this component doesn't have access to it)
      const dynamicChecklist = generateDynamicChecklist([], null, responsePlans)

      // Get stored item states and apply them to the dynamic checklist
      const storedItems = getStoredChecklistItems(community.id)
      const checklist = convertToPDFChecklist(dynamicChecklist, storedItems)

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
