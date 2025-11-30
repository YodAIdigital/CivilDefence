'use client'

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Community, CommunityGuide, GuideSection, InsuranceDetails, UtilityCompany } from '@/types/database'

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number
    }
  }
}

// Types for PDF export data
interface EmergencyContact {
  name: string
  number: string
  description: string
}

// Personal emergency contact (from profile)
interface PersonalEmergencyContact {
  id: string
  name: string
  phone: string
  relationship: string
}

interface ChecklistItem {
  id: string
  name: string
  checked: boolean
  lastChecked?: string
  recheckDays: number
}

interface ChecklistCategory {
  id: string
  name: string
  icon: string
  items: ChecklistItem[]
}

interface KeyLocation {
  name: string
  type: 'meeting_point' | 'fire_station' | 'hospital' | 'police' | 'resource' | 'other'
  address?: string
  phone?: string
  lat?: number
  lng?: number
}

// User profile data for PDF
interface UserProfileData {
  full_name: string | undefined
  email: string | undefined
  phone: string | undefined
  address: string | undefined
  mobile_number: string | undefined
  secondary_number: string | undefined
  date_of_birth: string | undefined
  emergency_contacts: PersonalEmergencyContact[] | undefined
  home_insurance: InsuranceDetails | undefined
  car_insurance: InsuranceDetails | undefined
  medical_insurance: InsuranceDetails | undefined
  utility_companies: UtilityCompany[] | undefined
  skills: string[] | undefined
  disabilities: string[] | undefined
  has_backup_power: boolean | undefined
  has_backup_water: boolean | undefined
  has_food_supply: boolean | undefined
  general_comments: string | undefined
}

interface PDFExportData {
  community: Community
  guides: CommunityGuide[]
  contacts: EmergencyContact[]
  checklist: ChecklistCategory[]
  keyLocations: KeyLocation[]
  generatedDate: Date
  userProfile?: UserProfileData
}

// Theme colors (keeping for potential future use)
const _COLORS = {
  primary: '#000542',
  secondary: '#313A64',
  accent: '#FEB100',
  text: '#1f2937',
  textLight: '#6b7280',
  border: '#e5e7eb',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
}
void _COLORS // Suppress unused variable warning

// Helper to add page numbers
function addPageNumbers(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(9)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Page ${i} of ${totalPages}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }
}

// Helper to add section header
function addSectionHeader(doc: jsPDF, title: string, y: number, _icon?: string): number {
  const pageWidth = doc.internal.pageSize.getWidth()

  // Draw light gray background bar with border
  doc.setFillColor(240, 240, 245)
  doc.rect(15, y, pageWidth - 30, 10, 'F')
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.rect(15, y, pageWidth - 30, 10, 'S')

  // Title text in dark color for contrast
  doc.setFontSize(14)
  doc.setTextColor(0, 5, 66)
  doc.setFont('helvetica', 'bold')
  doc.text(title.toUpperCase(), 20, y + 7)

  return y + 15
}

// Helper to check if we need a new page
function checkNewPage(doc: jsPDF, currentY: number, requiredSpace: number = 30): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (currentY + requiredSpace > pageHeight - 20) {
    doc.addPage()
    return 20
  }
  return currentY
}

// Generate Cover Page
function generateCoverPage(doc: jsPDF, data: PDFExportData): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Background gradient effect (using rectangles)
  doc.setFillColor(0, 5, 66) // primary
  doc.rect(0, 0, pageWidth, pageHeight * 0.45, 'F')

  doc.setFillColor(49, 58, 100) // secondary
  doc.rect(0, pageHeight * 0.45, pageWidth, pageHeight * 0.55, 'F')

  // Civil Defence title
  doc.setFontSize(12)
  doc.setTextColor(254, 177, 0) // accent
  doc.setFont('helvetica', 'bold')
  doc.text('CIVIL DEFENCE', pageWidth / 2, 25, { align: 'center' })

  // Emergency Response Plan title
  doc.setFontSize(24)
  doc.setTextColor(255, 255, 255)
  doc.text('EMERGENCY RESPONSE', pageWidth / 2, 45, { align: 'center' })
  doc.text('PLAN', pageWidth / 2, 57, { align: 'center' })

  // User name if available (personalized plan)
  if (data.userProfile?.full_name) {
    doc.setFontSize(12)
    doc.setTextColor(200, 200, 200)
    doc.setFont('helvetica', 'normal')
    doc.text('Prepared for', pageWidth / 2, 75, { align: 'center' })

    doc.setFontSize(18)
    doc.setTextColor(254, 177, 0) // accent
    doc.setFont('helvetica', 'bold')
    doc.text(data.userProfile.full_name, pageWidth / 2, 88, { align: 'center' })
  }

  // Community name
  doc.setFontSize(10)
  doc.setTextColor(200, 200, 200)
  doc.setFont('helvetica', 'normal')
  doc.text('Community', pageWidth / 2, 105, { align: 'center' })

  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text(data.community.name, pageWidth / 2, 117, { align: 'center' })

  // Community description
  let nextY = 130
  if (data.community.description) {
    doc.setFontSize(10)
    doc.setTextColor(180, 180, 180)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(data.community.description, pageWidth - 60)
    doc.text(lines.slice(0, 2), pageWidth / 2, nextY, { align: 'center' })
    nextY += lines.slice(0, 2).length * 5 + 10
  }

  // User address box if available
  if (data.userProfile?.address) {
    const boxY = nextY
    doc.setFillColor(255, 255, 255)
    doc.setGState(new (doc.GState as unknown as new (options: { opacity: number }) => unknown)({ opacity: 0.1 }))
    doc.roundedRect(30, boxY, pageWidth - 60, 28, 3, 3, 'F')
    doc.setGState(new (doc.GState as unknown as new (options: { opacity: number }) => unknown)({ opacity: 1 }))

    doc.setFontSize(9)
    doc.setTextColor(200, 200, 200)
    doc.text('MY ADDRESS', pageWidth / 2, boxY + 10, { align: 'center' })

    doc.setFontSize(11)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    const addressLines = doc.splitTextToSize(data.userProfile.address, pageWidth - 70)
    doc.text(addressLines[0], pageWidth / 2, boxY + 20, { align: 'center' })
    nextY = boxY + 35
  }

  // Meeting Point info
  if (data.community.meeting_point_name) {
    const boxY = Math.max(nextY, 175)
    doc.setDrawColor(254, 177, 0)
    doc.setLineWidth(1)
    doc.roundedRect(30, boxY, pageWidth - 60, 38, 3, 3, 'S')

    doc.setFontSize(9)
    doc.setTextColor(254, 177, 0)
    doc.text('EMERGENCY MEETING POINT', pageWidth / 2, boxY + 12, { align: 'center' })

    doc.setFontSize(12)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.text(data.community.meeting_point_name, pageWidth / 2, boxY + 24, { align: 'center' })

    if (data.community.meeting_point_address) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(data.community.meeting_point_address, pageWidth / 2, boxY + 33, { align: 'center' })
    }
  }

  // User contact numbers at bottom
  if (data.userProfile?.mobile_number || data.userProfile?.phone) {
    const contactY = pageHeight - 65
    doc.setFontSize(9)
    doc.setTextColor(180, 180, 180)
    doc.setFont('helvetica', 'normal')
    doc.text('MY CONTACT NUMBERS', pageWidth / 2, contactY, { align: 'center' })

    doc.setFontSize(11)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    const phone = data.userProfile.mobile_number || data.userProfile.phone || ''
    doc.text(phone, pageWidth / 2, contactY + 10, { align: 'center' })

    if (data.userProfile.secondary_number) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(180, 180, 180)
      doc.text(`Secondary: ${data.userProfile.secondary_number}`, pageWidth / 2, contactY + 18, { align: 'center' })
    }
  }

  // Generated date at bottom
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Generated: ${data.generatedDate.toLocaleDateString('en-NZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })}`,
    pageWidth / 2,
    pageHeight - 28,
    { align: 'center' }
  )

  // Emergency number reminder
  doc.setFontSize(11)
  doc.setTextColor(254, 177, 0)
  doc.setFont('helvetica', 'bold')
  doc.text('IN AN EMERGENCY CALL 111', pageWidth / 2, pageHeight - 18, { align: 'center' })
}

// Generate Map Page with Key Locations
function generateMapPage(doc: jsPDF, data: PDFExportData): void {
  doc.addPage()
  const pageWidth = doc.internal.pageSize.getWidth()

  let y = 20
  y = addSectionHeader(doc, 'Key Locations & Emergency Services', y)

  // Meeting point first if exists
  if (data.community.meeting_point_name) {
    y += 5
    doc.setFillColor(254, 177, 0, 0.1)
    doc.roundedRect(15, y, pageWidth - 30, 35, 3, 3, 'F')
    doc.setDrawColor(254, 177, 0)
    doc.setLineWidth(0.5)
    doc.roundedRect(15, y, pageWidth - 30, 35, 3, 3, 'S')

    doc.setFontSize(10)
    doc.setTextColor(200, 150, 0)
    doc.setFont('helvetica', 'bold')
    doc.text('COMMUNITY MEETING POINT', 25, y + 12)

    doc.setFontSize(14)
    doc.setTextColor(0, 5, 66)
    doc.text(data.community.meeting_point_name, 25, y + 24)

    if (data.community.meeting_point_address) {
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.setFont('helvetica', 'normal')
      doc.text(data.community.meeting_point_address, 25, y + 32)
    }
    y += 45
  }

  // Key locations table
  if (data.keyLocations.length > 0) {
    // Using plain text instead of emojis since jsPDF doesn't render Unicode emojis
    const locationTypes: Record<string, string> = {
      meeting_point: 'Meeting Point',
      fire_station: 'Fire Station',
      hospital: 'Hospital',
      police: 'Police Station',
      resource: 'Resource Centre',
      other: 'Other',
    }

    const tableData = data.keyLocations.map(loc => [
      locationTypes[loc.type] || loc.type,
      loc.name,
      loc.address || '-',
      loc.phone || '-',
    ])

    autoTable(doc, {
      startY: y,
      head: [['Type', 'Name', 'Address', 'Phone']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [235, 235, 240],
        textColor: [0, 5, 66],
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor: [50, 50, 50],
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 50 },
        2: { cellWidth: 70 },
        3: { cellWidth: 30 },
      },
    })
  }

  // Map placeholder note
  const mapY = doc.lastAutoTable?.finalY || y
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'italic')
  doc.text(
    'Note: For interactive maps with directions, view these locations in the Civil Defence app.',
    15,
    mapY + 15
  )
}

// Generate Response Plans Pages
function generateResponsePlans(doc: jsPDF, data: PDFExportData): void {
  if (data.guides.length === 0) return

  doc.addPage()
  const pageWidth = doc.internal.pageSize.getWidth()

  let y = 20
  y = addSectionHeader(doc, 'Emergency Response Plans', y)
  y += 5

  data.guides.forEach((guide, guideIndex) => {
    // Check for new page
    y = checkNewPage(doc, y, 60)

    if (guideIndex > 0) {
      y += 10
    }

    // Guide header - light background with border for readability
    doc.setFillColor(245, 245, 250)
    doc.roundedRect(15, y, pageWidth - 30, 25, 3, 3, 'F')
    doc.setDrawColor(180, 180, 190)
    doc.setLineWidth(0.3)
    doc.roundedRect(15, y, pageWidth - 30, 25, 3, 3, 'S')

    doc.setFontSize(14)
    doc.setTextColor(0, 5, 66)
    doc.setFont('helvetica', 'bold')
    doc.text(guide.name, 25, y + 10)

    if (guide.description) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      const descLines = doc.splitTextToSize(guide.description, pageWidth - 60)
      doc.text(descLines.slice(0, 2), 25, y + 18)
    }

    y += 30

    // Before, During, After sections
    const phases = [
      { key: 'before', title: 'BEFORE Emergency', color: [34, 197, 94] as [number, number, number] },
      { key: 'during', title: 'DURING Emergency', color: [249, 115, 22] as [number, number, number] },
      { key: 'after', title: 'AFTER Emergency', color: [59, 130, 246] as [number, number, number] },
    ]

    phases.forEach(phase => {
      const sections = guide.sections[phase.key as keyof typeof guide.sections] as GuideSection[]
      if (!sections || sections.length === 0) return

      y = checkNewPage(doc, y, 40)

      // Phase header
      doc.setFillColor(...phase.color)
      doc.roundedRect(20, y, pageWidth - 40, 8, 2, 2, 'F')

      doc.setFontSize(10)
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.text(phase.title, 25, y + 5.5)

      y += 12

      // Section items
      sections.forEach((section: GuideSection) => {
        y = checkNewPage(doc, y, 25)

        doc.setFontSize(10)
        doc.setTextColor(0, 5, 66)
        doc.setFont('helvetica', 'bold')
        doc.text(`• ${section.title}`, 25, y)

        y += 5
        doc.setFontSize(9)
        doc.setTextColor(80, 80, 80)
        doc.setFont('helvetica', 'normal')
        const contentLines = doc.splitTextToSize(section.content, pageWidth - 60)
        doc.text(contentLines, 30, y)
        y += contentLines.length * 4 + 3
      })

      y += 5
    })

    // Supplies list
    if (guide.supplies && guide.supplies.length > 0) {
      y = checkNewPage(doc, y, 30)

      doc.setFontSize(10)
      doc.setTextColor(0, 5, 66)
      doc.setFont('helvetica', 'bold')
      doc.text('Required Supplies:', 25, y)
      y += 5

      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      doc.setFont('helvetica', 'normal')

      const suppliesPerRow = 2
      const colWidth = (pageWidth - 60) / suppliesPerRow

      guide.supplies.forEach((supply: string, idx: number) => {
        const col = idx % suppliesPerRow
        const row = Math.floor(idx / suppliesPerRow)

        if (col === 0 && row > 0) {
          y += 5
          y = checkNewPage(doc, y, 10)
        }

        // Draw checkbox square manually since Unicode boxes don't render in jsPDF
        const checkboxX = 30 + col * colWidth
        doc.setDrawColor(100, 100, 100)
        doc.setLineWidth(0.3)
        doc.rect(checkboxX, y - 3, 3, 3)
        doc.text(supply, checkboxX + 5, y)
      })
      y += 10
    }

    // Emergency contacts for this guide
    if (guide.emergency_contacts && guide.emergency_contacts.length > 0) {
      y = checkNewPage(doc, y, 30)

      doc.setFontSize(10)
      doc.setTextColor(0, 5, 66)
      doc.setFont('helvetica', 'bold')
      doc.text('Emergency Contacts for this Plan:', 25, y)
      y += 6

      guide.emergency_contacts.forEach(contact => {
        y = checkNewPage(doc, y, 10)
        doc.setFontSize(9)
        doc.setTextColor(80, 80, 80)
        doc.setFont('helvetica', 'bold')
        doc.text(`${contact.name}: `, 30, y)
        doc.setFont('helvetica', 'normal')
        doc.text(`${contact.number} - ${contact.description}`, 30 + doc.getTextWidth(`${contact.name}: `), y)
        y += 5
      })
    }
  })
}

// Generate Contacts Page
function generateContactsPage(doc: jsPDF, data: PDFExportData): void {
  doc.addPage()
  const pageWidth = doc.internal.pageSize.getWidth()

  let y = 20
  y = addSectionHeader(doc, 'Emergency Contacts', y)

  // Emergency banner
  y += 5
  doc.setFillColor(239, 68, 68)
  doc.roundedRect(15, y, pageWidth - 30, 20, 3, 3, 'F')

  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('FOR LIFE-THREATENING EMERGENCIES CALL 111', pageWidth / 2, y + 13, { align: 'center' })

  y += 30

  // Contacts table
  if (data.contacts.length > 0) {
    const tableData = data.contacts.map(contact => [
      contact.name,
      contact.number,
      contact.description,
    ])

    autoTable(doc, {
      startY: y,
      head: [['Contact', 'Number', 'Description']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [235, 235, 240],
        textColor: [0, 5, 66],
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor: [50, 50, 50],
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 40 },
        2: { cellWidth: 95 },
      },
    })
  }

  // Tips at bottom
  const tipY = doc.lastAutoTable?.finalY || y
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'italic')
  doc.text('Tip: Keep a printed copy of these contacts in your emergency kit.', 15, tipY + 15)
}

// Generate Checklist Pages
function generateChecklistPages(doc: jsPDF, data: PDFExportData): void {
  if (data.checklist.length === 0) return

  doc.addPage()
  const pageWidth = doc.internal.pageSize.getWidth()

  let y = 20
  y = addSectionHeader(doc, 'Emergency Kit Checklist', y)
  y += 5

  data.checklist.forEach((category) => {
    y = checkNewPage(doc, y, 40)

    // Category header - light background for readability
    doc.setFillColor(235, 235, 240)
    doc.roundedRect(15, y, pageWidth - 30, 10, 2, 2, 'F')
    doc.setDrawColor(180, 180, 190)
    doc.setLineWidth(0.3)
    doc.roundedRect(15, y, pageWidth - 30, 10, 2, 2, 'S')

    doc.setFontSize(11)
    doc.setTextColor(0, 5, 66)
    doc.setFont('helvetica', 'bold')
    doc.text(category.name, 20, y + 7)

    y += 15

    // Items
    category.items.forEach((item) => {
      y = checkNewPage(doc, y, 8)

      // Checkbox
      doc.setDrawColor(150, 150, 150)
      doc.setLineWidth(0.3)
      doc.rect(20, y - 3, 4, 4)

      if (item.checked) {
        doc.setFillColor(34, 197, 94)
        doc.rect(20.5, y - 2.5, 3, 3, 'F')
      }

      // Item text
      doc.setFontSize(9)
      doc.setTextColor(item.checked ? 100 : 50, item.checked ? 100 : 50, item.checked ? 100 : 50)
      doc.setFont('helvetica', 'normal')
      doc.text(item.name, 28, y)

      // Last checked date if available
      if (item.checked && item.lastChecked) {
        const date = new Date(item.lastChecked)
        const dateStr = date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
        doc.setFontSize(7)
        doc.setTextColor(150, 150, 150)
        doc.text(`(${dateStr})`, pageWidth - 20, y, { align: 'right' })
      }

      y += 6
    })

    y += 5
  })

  // Recheck reminder
  y = checkNewPage(doc, y, 30)
  doc.setFillColor(254, 177, 0, 0.1)
  doc.roundedRect(15, y, pageWidth - 30, 25, 3, 3, 'F')
  doc.setDrawColor(254, 177, 0)
  doc.roundedRect(15, y, pageWidth - 30, 25, 3, 3, 'S')

  doc.setFontSize(10)
  doc.setTextColor(200, 150, 0)
  doc.setFont('helvetica', 'bold')
  doc.text('REMINDER', 20, y + 10)

  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  doc.text('Check perishable items (water, food, batteries, medications) every 3 months.', 20, y + 18)
}

// Skill and disability label lookups
const SKILL_LABELS: Record<string, string> = {
  medical_doctor: 'Medical Doctor',
  nurse: 'Nurse',
  paramedic: 'Paramedic',
  first_aider: 'Trained First Aider',
  firefighter: 'Fire Fighter',
  search_rescue: 'Trained Search and Rescue',
}

const DISABILITY_LABELS: Record<string, string> = {
  unable_walk: 'Unable to walk',
  difficulty_walking: 'Difficulty walking',
  medical_equipment: 'Dependent on medical equipment',
  essential_medication: 'Relies on essential medication',
  blind: 'Blind or visually impaired',
  deaf: 'Deaf or hard of hearing',
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  spouse: 'Spouse/Partner',
  parent: 'Parent',
  child: 'Child',
  sibling: 'Sibling',
  friend: 'Friend',
  neighbor: 'Neighbor',
  other: 'Other',
}

const UTILITY_TYPE_LABELS: Record<string, string> = {
  electricity: 'Electricity',
  gas: 'Gas',
  water: 'Water',
  internet: 'Internet',
}

// Generate Personal Profile Page
function generatePersonalProfilePage(doc: jsPDF, data: PDFExportData): void {
  if (!data.userProfile) return

  doc.addPage()
  const pageWidth = doc.internal.pageSize.getWidth()

  let y = 20
  y = addSectionHeader(doc, 'My Personal Information', y)
  y += 5

  const profile = data.userProfile

  // Personal Details section
  doc.setFillColor(240, 240, 245)
  doc.roundedRect(15, y, pageWidth - 30, 50, 3, 3, 'F')

  doc.setFontSize(11)
  doc.setTextColor(0, 5, 66)
  doc.setFont('helvetica', 'bold')
  doc.text('Personal Details', 20, y + 10)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)

  let detailY = y + 18
  if (profile.full_name) {
    doc.text(`Name: ${profile.full_name}`, 25, detailY)
    detailY += 6
  }
  if (profile.address) {
    doc.text(`Address: ${profile.address}`, 25, detailY)
    detailY += 6
  }
  if (profile.mobile_number || profile.phone) {
    doc.text(`Phone: ${profile.mobile_number || profile.phone}`, 25, detailY)
    detailY += 6
  }
  if (profile.secondary_number) {
    doc.text(`Secondary: ${profile.secondary_number}`, 25, detailY)
    detailY += 6
  }
  if (profile.email) {
    doc.text(`Email: ${profile.email}`, 25, detailY)
  }

  y += 58

  // Personal Emergency Contacts
  if (profile.emergency_contacts && profile.emergency_contacts.length > 0) {
    y = checkNewPage(doc, y, 50)

    doc.setFillColor(239, 68, 68)
    doc.setGState(new (doc.GState as unknown as new (options: { opacity: number }) => unknown)({ opacity: 0.1 }))
    doc.roundedRect(15, y, pageWidth - 30, 8 + profile.emergency_contacts.length * 25, 3, 3, 'F')
    doc.setGState(new (doc.GState as unknown as new (options: { opacity: number }) => unknown)({ opacity: 1 }))

    doc.setDrawColor(239, 68, 68)
    doc.setLineWidth(0.5)
    doc.roundedRect(15, y, pageWidth - 30, 8 + profile.emergency_contacts.length * 25, 3, 3, 'S')

    doc.setFontSize(11)
    doc.setTextColor(239, 68, 68)
    doc.setFont('helvetica', 'bold')
    doc.text('My Emergency Contacts', 20, y + 8)

    y += 15
    profile.emergency_contacts.forEach((contact) => {
      doc.setFontSize(10)
      doc.setTextColor(0, 5, 66)
      doc.setFont('helvetica', 'bold')
      doc.text(contact.name, 25, y)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text(contact.phone, 25, y + 6)

      const relationshipLabel = RELATIONSHIP_LABELS[contact.relationship] || contact.relationship
      doc.setTextColor(120, 120, 120)
      doc.text(`(${relationshipLabel})`, 25 + doc.getTextWidth(contact.phone) + 5, y + 6)

      y += 20
    })
    y += 5
  }

  // Insurance Details
  const hasInsurance =
    (profile.home_insurance?.provider) ||
    (profile.car_insurance?.provider) ||
    (profile.medical_insurance?.provider)

  if (hasInsurance) {
    y = checkNewPage(doc, y, 80)

    doc.setFontSize(11)
    doc.setTextColor(0, 5, 66)
    doc.setFont('helvetica', 'bold')
    doc.text('Insurance Information', 20, y)
    y += 8

    const insuranceTypes = [
      { key: 'home_insurance', label: 'Home Insurance', icon: 'home' },
      { key: 'car_insurance', label: 'Car Insurance', icon: 'car' },
      { key: 'medical_insurance', label: 'Medical Insurance', icon: 'medical' },
    ]

    insuranceTypes.forEach((ins) => {
      const insurance = profile[ins.key as keyof typeof profile] as InsuranceDetails | undefined
      if (insurance?.provider) {
        y = checkNewPage(doc, y, 25)

        doc.setFillColor(248, 248, 250)
        doc.roundedRect(20, y, pageWidth - 40, 22, 2, 2, 'F')

        doc.setFontSize(9)
        doc.setTextColor(0, 5, 66)
        doc.setFont('helvetica', 'bold')
        doc.text(ins.label, 25, y + 6)

        doc.setFont('helvetica', 'normal')
        doc.setTextColor(60, 60, 60)
        doc.text(`Provider: ${insurance.provider}`, 25, y + 12)

        if (insurance.policy_number) {
          doc.text(`Policy: ${insurance.policy_number}`, 90, y + 12)
        }
        if (insurance.contact_phone) {
          doc.text(`Claims: ${insurance.contact_phone}`, 25, y + 18)
        }

        y += 26
      }
    })
  }

  // Utility Companies
  if (profile.utility_companies && profile.utility_companies.length > 0) {
    y = checkNewPage(doc, y, 60)

    doc.setFontSize(11)
    doc.setTextColor(0, 5, 66)
    doc.setFont('helvetica', 'bold')
    doc.text('Utility Providers', 20, y)
    y += 8

    profile.utility_companies.forEach((utility) => {
      y = checkNewPage(doc, y, 28)

      doc.setFillColor(248, 248, 250)
      doc.roundedRect(20, y, pageWidth - 40, 25, 2, 2, 'F')

      // Utility type label
      const typeLabel = UTILITY_TYPE_LABELS[utility.type] || utility.type
      doc.setFontSize(9)
      doc.setTextColor(0, 5, 66)
      doc.setFont('helvetica', 'bold')
      doc.text(typeLabel, 25, y + 6)

      // Provider name
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text(`Provider: ${utility.provider}`, 25, y + 12)

      // Account number (if available)
      if (utility.account_number) {
        doc.text(`Account: ${utility.account_number}`, 100, y + 12)
      }

      // Phone (if available)
      if (utility.phone) {
        doc.text(`Phone: ${utility.phone}`, 25, y + 18)
      }

      // Website (if available)
      if (utility.website) {
        doc.text(`Web: ${utility.website}`, utility.phone ? 100 : 25, y + 18)
      }

      y += 29
    })
  }

  // Skills
  if (profile.skills && profile.skills.length > 0) {
    y = checkNewPage(doc, y, 40)

    doc.setFontSize(11)
    doc.setTextColor(0, 5, 66)
    doc.setFont('helvetica', 'bold')
    doc.text('Skills & Qualifications', 20, y)
    y += 8

    doc.setFillColor(34, 197, 94)
    doc.setGState(new (doc.GState as unknown as new (options: { opacity: number }) => unknown)({ opacity: 0.1 }))
    doc.roundedRect(20, y, pageWidth - 40, 6 + Math.ceil(profile.skills.length / 2) * 8, 2, 2, 'F')
    doc.setGState(new (doc.GState as unknown as new (options: { opacity: number }) => unknown)({ opacity: 1 }))

    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    doc.setFont('helvetica', 'normal')

    let skillY = y + 6
    profile.skills.forEach((skill, idx) => {
      const label = SKILL_LABELS[skill] || skill
      const col = idx % 2
      const xPos = col === 0 ? 25 : pageWidth / 2

      if (col === 0 && idx > 0) {
        skillY += 8
        skillY = checkNewPage(doc, skillY, 10)
      }

      doc.text(`• ${label}`, xPos, skillY)
    })

    y = skillY + 12
  }

  // Disabilities/Special Needs
  if (profile.disabilities && profile.disabilities.length > 0) {
    y = checkNewPage(doc, y, 40)

    doc.setFontSize(11)
    doc.setTextColor(0, 5, 66)
    doc.setFont('helvetica', 'bold')
    doc.text('Special Needs & Considerations', 20, y)
    y += 8

    doc.setFillColor(249, 115, 22)
    doc.setGState(new (doc.GState as unknown as new (options: { opacity: number }) => unknown)({ opacity: 0.1 }))
    doc.roundedRect(20, y, pageWidth - 40, 6 + profile.disabilities.length * 8, 2, 2, 'F')
    doc.setGState(new (doc.GState as unknown as new (options: { opacity: number }) => unknown)({ opacity: 1 }))

    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    doc.setFont('helvetica', 'normal')

    let disY = y + 6
    profile.disabilities.forEach((disability) => {
      disY = checkNewPage(doc, disY, 10)
      const label = DISABILITY_LABELS[disability] || disability
      doc.text(`• ${label}`, 25, disY)
      disY += 8
    })

    y = disY + 8
  }

  // Preparedness
  const hasPreparedness = profile.has_backup_power || profile.has_backup_water || profile.has_food_supply
  if (hasPreparedness) {
    y = checkNewPage(doc, y, 40)

    doc.setFontSize(11)
    doc.setTextColor(0, 5, 66)
    doc.setFont('helvetica', 'bold')
    doc.text('Emergency Preparedness', 20, y)
    y += 8

    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    doc.setFont('helvetica', 'normal')

    if (profile.has_backup_power) {
      doc.setTextColor(34, 197, 94)
      doc.text('✓', 25, y)
      doc.setTextColor(60, 60, 60)
      doc.text('Emergency backup power available', 32, y)
      y += 7
    }
    if (profile.has_backup_water) {
      doc.setTextColor(34, 197, 94)
      doc.text('✓', 25, y)
      doc.setTextColor(60, 60, 60)
      doc.text('Backup water supply available', 32, y)
      y += 7
    }
    if (profile.has_food_supply) {
      doc.setTextColor(34, 197, 94)
      doc.text('✓', 25, y)
      doc.setTextColor(60, 60, 60)
      doc.text('Food supply for 5+ days', 32, y)
      y += 7
    }
  }

  // General comments
  if (profile.general_comments) {
    y = checkNewPage(doc, y, 40)
    y += 5

    doc.setFontSize(11)
    doc.setTextColor(0, 5, 66)
    doc.setFont('helvetica', 'bold')
    doc.text('Additional Notes', 20, y)
    y += 8

    doc.setFillColor(248, 248, 250)
    const commentLines = doc.splitTextToSize(profile.general_comments, pageWidth - 50)
    doc.roundedRect(20, y, pageWidth - 40, 8 + commentLines.length * 5, 2, 2, 'F')

    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.setFont('helvetica', 'normal')
    doc.text(commentLines, 25, y + 6)
  }
}

// Main export function
export async function generateEmergencyPDF(data: PDFExportData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  // Generate all sections
  generateCoverPage(doc, data)
  generatePersonalProfilePage(doc, data)
  generateMapPage(doc, data)
  generateResponsePlans(doc, data)
  generateContactsPage(doc, data)
  generateChecklistPages(doc, data)

  // Add page numbers
  addPageNumbers(doc)

  // Return as blob for download
  return doc.output('blob')
}

// Helper to download the PDF
export async function downloadEmergencyPDF(data: PDFExportData, filename?: string): Promise<void> {
  const blob = await generateEmergencyPDF(data)
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename || `${data.community.name.replace(/\s+/g, '_')}_Emergency_Plan.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

// Export types for use in components
export type { PDFExportData, EmergencyContact, ChecklistItem, ChecklistCategory, KeyLocation, UserProfileData, PersonalEmergencyContact }
