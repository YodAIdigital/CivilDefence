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
  mapImageBase64?: string // Optional base64 encoded map image
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

// Helper to add page numbers (skip cover page)
function addPageNumbers(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages()
  // Start from page 2 to skip cover page
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(9)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Page ${i - 1} of ${totalPages - 1}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }
}

// Helper to add section header (centered, no background/border)
function addSectionHeader(doc: jsPDF, title: string, y: number, _icon?: string): number {
  const pageWidth = doc.internal.pageSize.getWidth()

  // Centered title text, no background or border
  doc.setFontSize(16)
  doc.setTextColor(0, 5, 66)
  doc.setFont('helvetica', 'bold')
  doc.text(title.toUpperCase(), pageWidth / 2, y + 7, { align: 'center' })

  return y + 18
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

  // Solid white background (print-friendly)
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, pageWidth, pageHeight, 'F')

  // CivilDefencePro title (matching email branding style)
  // "Civil" normal + "Defence" bold + "Pro" normal
  const titleY = 35
  doc.setFontSize(28)

  // Calculate total width for centering
  doc.setFont('helvetica', 'normal')
  const civilWidth = doc.getTextWidth('Civil')
  doc.setFont('helvetica', 'bold')
  const defenceWidth = doc.getTextWidth('Defence')
  doc.setFont('helvetica', 'normal')
  const proWidth = doc.getTextWidth('Pro')
  const totalTitleWidth = civilWidth + defenceWidth + proWidth

  let titleX = (pageWidth - totalTitleWidth) / 2

  // Draw "Civil" in normal weight, dark color
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 5, 66) // primary dark blue
  doc.text('Civil', titleX, titleY)
  titleX += civilWidth

  // Draw "Defence" in bold, accent color
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(254, 177, 0) // accent yellow
  doc.text('Defence', titleX, titleY)
  titleX += defenceWidth

  // Draw "Pro" in normal weight, dark color
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 5, 66)
  doc.text('Pro', titleX, titleY)

  // Emergency Response Plan title (on one line)
  doc.setFontSize(22)
  doc.setTextColor(0, 5, 66) // dark text for print-friendly
  doc.setFont('helvetica', 'bold')
  doc.text('EMERGENCY RESPONSE PLAN', pageWidth / 2, 55, { align: 'center' })

  // Prepared for: {NAME} on one line with same font style
  let nextY = 80
  if (data.userProfile?.full_name) {
    doc.setFontSize(14)
    doc.setTextColor(0, 5, 66)
    doc.setFont('helvetica', 'normal')
    doc.text(`Prepared for: ${data.userProfile.full_name}`, pageWidth / 2, nextY, { align: 'center' })
    nextY += 20
  }

  // Community name
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  doc.text('Community', pageWidth / 2, nextY, { align: 'center' })

  doc.setFontSize(16)
  doc.setTextColor(0, 5, 66)
  doc.setFont('helvetica', 'bold')
  doc.text(data.community.name, pageWidth / 2, nextY + 12, { align: 'center' })

  // Community description
  nextY += 30
  if (data.community.description) {
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(data.community.description, pageWidth - 60)
    doc.text(lines.slice(0, 2), pageWidth / 2, nextY, { align: 'center' })
    nextY += lines.slice(0, 2).length * 5 + 15
  }

  // Meeting Point info (vertically centered in remaining space)
  if (data.community.meeting_point_name) {
    // Calculate vertical center position for meeting point box
    const boxHeight = 45
    const boxY = Math.max(nextY + 10, (pageHeight - 60 - boxHeight) / 2)

    doc.setDrawColor(254, 177, 0)
    doc.setLineWidth(1.5)
    doc.roundedRect(30, boxY, pageWidth - 60, boxHeight, 3, 3, 'S')

    doc.setFontSize(10)
    doc.setTextColor(254, 177, 0)
    doc.setFont('helvetica', 'bold')
    doc.text('EMERGENCY MEETING POINT', pageWidth / 2, boxY + 14, { align: 'center' })

    doc.setFontSize(14)
    doc.setTextColor(0, 5, 66)
    doc.setFont('helvetica', 'bold')
    doc.text(data.community.meeting_point_name, pageWidth / 2, boxY + 27, { align: 'center' })

    if (data.community.meeting_point_address) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      doc.text(data.community.meeting_point_address, pageWidth / 2, boxY + 38, { align: 'center' })
    }
  }

  // Emergency number reminder (at bottom)
  doc.setFontSize(12)
  doc.setTextColor(239, 68, 68) // red for emergency
  doc.setFont('helvetica', 'bold')
  doc.text('IN AN EMERGENCY CALL 111', pageWidth / 2, pageHeight - 25, { align: 'center' })

  // Generated date below emergency number
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Generated: ${data.generatedDate.toLocaleDateString('en-NZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })}`,
    pageWidth / 2,
    pageHeight - 15,
    { align: 'center' }
  )
}

// Generate Map Page with Key Locations
function generateMapPage(doc: jsPDF, data: PDFExportData): void {
  doc.addPage()
  const pageWidth = doc.internal.pageSize.getWidth()

  let y = 20
  y = addSectionHeader(doc, 'Key Locations & Emergency Services', y)

  // Map area - 50% taller for better visibility
  const mapHeight = 105
  y += 5

  // If we have a map image, add it
  if (data.mapImageBase64) {
    try {
      doc.addImage(data.mapImageBase64, 'PNG', 15, y, pageWidth - 30, mapHeight)
      // Add border around the map
      doc.setDrawColor(200, 200, 210)
      doc.setLineWidth(0.5)
      doc.roundedRect(15, y, pageWidth - 30, mapHeight, 3, 3, 'S')
    } catch {
      // If image fails to load, show placeholder
      doc.setFillColor(245, 247, 250)
      doc.roundedRect(15, y, pageWidth - 30, mapHeight, 3, 3, 'F')
      doc.setDrawColor(200, 200, 210)
      doc.setLineWidth(0.5)
      doc.roundedRect(15, y, pageWidth - 30, mapHeight, 3, 3, 'S')
      doc.setFontSize(11)
      doc.setTextColor(120, 120, 130)
      doc.setFont('helvetica', 'normal')
      doc.text('Map image could not be loaded', pageWidth / 2, y + mapHeight / 2, { align: 'center' })
    }
  } else {
    // Draw map placeholder box
    doc.setFillColor(245, 247, 250)
    doc.roundedRect(15, y, pageWidth - 30, mapHeight, 3, 3, 'F')
    doc.setDrawColor(200, 200, 210)
    doc.setLineWidth(0.5)
    doc.roundedRect(15, y, pageWidth - 30, mapHeight, 3, 3, 'S')

    // Map placeholder text
    doc.setFontSize(11)
    doc.setTextColor(120, 120, 130)
    doc.setFont('helvetica', 'normal')
    doc.text('Regional Map', pageWidth / 2, y + mapHeight / 2 - 5, { align: 'center' })
    doc.setFontSize(9)
    doc.text('View interactive map with directions in the CivilDefencePro app', pageWidth / 2, y + mapHeight / 2 + 5, { align: 'center' })
  }

  y += mapHeight + 10

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
        fontSize: 11,
      },
      styles: {
        fontSize: 10,
        cellPadding: 5,
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
}

// Generate Response Plans Pages
function generateResponsePlans(doc: jsPDF, data: PDFExportData): void {
  if (data.guides.length === 0) return

  const pageWidth = doc.internal.pageSize.getWidth()

  data.guides.forEach((guide, guideIndex) => {
    // Start each response plan on a new page
    doc.addPage()
    let y = 20

    // Add section header only on first guide
    if (guideIndex === 0) {
      y = addSectionHeader(doc, 'Emergency Response Plans', y)
      y += 5
    }

    // Guide header - no background fill, just border
    doc.setDrawColor(180, 180, 190)
    doc.setLineWidth(0.5)
    doc.roundedRect(15, y, pageWidth - 30, 28, 3, 3, 'S')

    doc.setFontSize(14)
    doc.setTextColor(0, 5, 66)
    doc.setFont('helvetica', 'bold')
    doc.text(guide.name, 25, y + 12)

    // Add risk level badge after the guide name
    if (guide.risk_level) {
      const nameWidth = doc.getTextWidth(guide.name)
      const badgeX = 25 + nameWidth + 5
      const badgeY = y + 7

      // Risk level colors and labels
      const riskConfig = {
        low: { bg: [220, 252, 231] as [number, number, number], text: [22, 101, 52] as [number, number, number], label: 'LOW RISK' },
        medium: { bg: [254, 243, 199] as [number, number, number], text: [146, 64, 14] as [number, number, number], label: 'MEDIUM RISK' },
        high: { bg: [254, 226, 226] as [number, number, number], text: [153, 27, 27] as [number, number, number], label: 'HIGH RISK' },
      }
      const config = riskConfig[guide.risk_level]

      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      const badgeText = config.label
      const badgeTextWidth = doc.getTextWidth(badgeText)
      const badgeWidth = badgeTextWidth + 6
      const badgeHeight = 6

      // Draw badge background
      doc.setFillColor(...config.bg)
      doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.5, 1.5, 'F')

      // Draw badge text
      doc.setTextColor(...config.text)
      doc.text(badgeText, badgeX + 3, badgeY + 4.5)
    }

    if (guide.description) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      const descLines = doc.splitTextToSize(guide.description, pageWidth - 50)
      doc.text(descLines.slice(0, 2), 25, y + 21)
    }

    y += 35

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
      doc.roundedRect(20, y, pageWidth - 40, 10, 2, 2, 'F')

      doc.setFontSize(11)
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.text(phase.title, 25, y + 7)

      // 18px spacing below phase header (approximately 6.35mm)
      y += 16

      // Section items
      sections.forEach((section: GuideSection) => {
        y = checkNewPage(doc, y, 25)

        doc.setFontSize(11)
        doc.setTextColor(0, 5, 66)
        doc.setFont('helvetica', 'bold')
        doc.text(`• ${section.title}`, 25, y)

        y += 6
        doc.setFontSize(10)
        doc.setTextColor(80, 80, 80)
        doc.setFont('helvetica', 'normal')
        const contentLines = doc.splitTextToSize(section.content, pageWidth - 60)
        doc.text(contentLines, 30, y)
        y += contentLines.length * 5 + 4
      })

      y += 8
    })

    // Supplies list
    if (guide.supplies && guide.supplies.length > 0) {
      y = checkNewPage(doc, y, 30)

      doc.setFontSize(11)
      doc.setTextColor(0, 5, 66)
      doc.setFont('helvetica', 'bold')
      doc.text('Required Supplies:', 25, y)
      y += 10

      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      doc.setFont('helvetica', 'normal')

      const suppliesPerRow = 2
      const colWidth = (pageWidth - 60) / suppliesPerRow
      const textMaxWidth = colWidth - 12 // Account for checkbox and padding

      guide.supplies.forEach((supply: string, idx: number) => {
        const col = idx % suppliesPerRow
        const row = Math.floor(idx / suppliesPerRow)

        if (col === 0 && row > 0) {
          y += 8
          y = checkNewPage(doc, y, 12)
        }

        // Draw checkbox square manually since Unicode boxes don't render in jsPDF
        const checkboxX = 25 + col * colWidth
        doc.setDrawColor(100, 100, 100)
        doc.setLineWidth(0.3)
        doc.rect(checkboxX, y - 3, 4, 4)

        // Truncate text if too long for the column
        let displayText = supply
        const textWidth = doc.getTextWidth(supply)
        if (textWidth > textMaxWidth) {
          // Truncate and add ellipsis
          while (doc.getTextWidth(displayText + '...') > textMaxWidth && displayText.length > 0) {
            displayText = displayText.slice(0, -1)
          }
          displayText += '...'
        }
        doc.text(displayText, checkboxX + 7, y)
      })
      y += 14
    }

    // Emergency contacts for this guide
    if (guide.emergency_contacts && guide.emergency_contacts.length > 0) {
      y = checkNewPage(doc, y, 30)

      doc.setFontSize(11)
      doc.setTextColor(0, 5, 66)
      doc.setFont('helvetica', 'bold')
      doc.text('Emergency Contacts for this Plan:', 25, y)
      y += 10

      guide.emergency_contacts.forEach(contact => {
        y = checkNewPage(doc, y, 12)
        doc.setFontSize(10)
        doc.setTextColor(0, 5, 66)
        doc.setFont('helvetica', 'bold')
        // Contact name with number on same line
        const contactLine = `${contact.name}: ${contact.number}`
        doc.text(contactLine, 30, y)

        // Description on next line with proper wrapping
        if (contact.description) {
          y += 5
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(80, 80, 80)
          const descLines = doc.splitTextToSize(`- ${contact.description}`, pageWidth - 60)
          doc.text(descLines, 30, y)
          y += descLines.length * 4.5
        }
        y += 4
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
  doc.roundedRect(15, y, pageWidth - 30, 22, 3, 3, 'F')

  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('FOR LIFE-THREATENING EMERGENCIES CALL 111', pageWidth / 2, y + 14, { align: 'center' })

  y += 32

  // Contacts table with larger fonts
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
        fontSize: 11,
      },
      styles: {
        fontSize: 10,
        cellPadding: 5,
        textColor: [50, 50, 50],
      },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: 'bold' },
        1: { cellWidth: 45 },
        2: { cellWidth: 85 },
      },
    })
  }

  // Tips at bottom
  const tipY = doc.lastAutoTable?.finalY || y
  doc.setFontSize(10)
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

    // Category header - no background, just text with underline
    doc.setFontSize(12)
    doc.setTextColor(0, 5, 66)
    doc.setFont('helvetica', 'bold')
    doc.text(category.name, 20, y + 7)

    // Underline
    doc.setDrawColor(200, 200, 210)
    doc.setLineWidth(0.5)
    doc.line(20, y + 10, pageWidth - 20, y + 10)

    y += 18

    // Items with larger font
    category.items.forEach((item) => {
      y = checkNewPage(doc, y, 12)

      // Checkbox - larger and more visible
      doc.setDrawColor(120, 120, 120)
      doc.setLineWidth(0.5)
      doc.rect(20, y - 4, 5, 5)

      if (item.checked) {
        doc.setFillColor(34, 197, 94)
        doc.rect(20.5, y - 3.5, 4, 4, 'F')
      }

      // Item text - larger font
      doc.setFontSize(10)
      doc.setTextColor(item.checked ? 100 : 50, item.checked ? 100 : 50, item.checked ? 100 : 50)
      doc.setFont('helvetica', 'normal')
      doc.text(item.name, 30, y)

      // Last checked date if available
      if (item.checked && item.lastChecked) {
        const date = new Date(item.lastChecked)
        const dateStr = date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(`(${dateStr})`, pageWidth - 20, y, { align: 'right' })
      }

      y += 8
    })

    y += 10
  })

  // Recheck reminder - no fill, just border
  y = checkNewPage(doc, y, 30)
  doc.setDrawColor(254, 177, 0)
  doc.setLineWidth(1)
  doc.roundedRect(15, y, pageWidth - 30, 28, 3, 3, 'S')

  doc.setFontSize(11)
  doc.setTextColor(200, 150, 0)
  doc.setFont('helvetica', 'bold')
  doc.text('REMINDER', 20, y + 12)

  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  doc.text('Check perishable items (water, food, batteries, medications) every 3 months.', 20, y + 22)
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

  // Personal Details section - no background fill, just border
  doc.setDrawColor(200, 200, 210)
  doc.setLineWidth(0.5)
  doc.roundedRect(15, y, pageWidth - 30, 55, 3, 3, 'S')

  doc.setFontSize(12)
  doc.setTextColor(0, 5, 66)
  doc.setFont('helvetica', 'bold')
  doc.text('Personal Details', 20, y + 10)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)

  let detailY = y + 20
  if (profile.full_name) {
    doc.text(`Name: ${profile.full_name}`, 25, detailY)
    detailY += 7
  }
  if (profile.address) {
    doc.text(`Address: ${profile.address}`, 25, detailY)
    detailY += 7
  }
  if (profile.mobile_number || profile.phone) {
    doc.text(`Phone: ${profile.mobile_number || profile.phone}`, 25, detailY)
    detailY += 7
  }
  if (profile.secondary_number) {
    doc.text(`Secondary: ${profile.secondary_number}`, 25, detailY)
    detailY += 7
  }
  if (profile.email) {
    doc.text(`Email: ${profile.email}`, 25, detailY)
  }

  y += 62

  // Personal Emergency Contacts
  if (profile.emergency_contacts && profile.emergency_contacts.length > 0) {
    // 18px spacing above heading (approximately 6.35mm)
    y += 6
    y = checkNewPage(doc, y, 50)

    // No background fill, just red border
    doc.setDrawColor(239, 68, 68)
    doc.setLineWidth(0.8)
    doc.roundedRect(15, y, pageWidth - 30, 12 + profile.emergency_contacts.length * 22, 3, 3, 'S')

    doc.setFontSize(12)
    doc.setTextColor(239, 68, 68)
    doc.setFont('helvetica', 'bold')
    doc.text('My Emergency Contacts', 20, y + 10)

    y += 18
    profile.emergency_contacts.forEach((contact) => {
      doc.setFontSize(11)
      doc.setTextColor(0, 5, 66)
      doc.setFont('helvetica', 'bold')
      doc.text(contact.name, 25, y)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      // Add proper spacing between name and phone
      doc.text(contact.phone, 25, y + 7)

      const relationshipLabel = RELATIONSHIP_LABELS[contact.relationship] || contact.relationship
      doc.setTextColor(120, 120, 120)
      doc.text(`  (${relationshipLabel})`, 25 + doc.getTextWidth(contact.phone), y + 7)

      y += 18
    })
    y += 8
  }

  // Insurance Details
  const hasInsurance =
    (profile.home_insurance?.provider) ||
    (profile.car_insurance?.provider) ||
    (profile.medical_insurance?.provider)

  if (hasInsurance) {
    // 18px spacing above heading
    y += 6
    y = checkNewPage(doc, y, 80)

    doc.setFontSize(12)
    doc.setTextColor(0, 5, 66)
    doc.setFont('helvetica', 'bold')
    doc.text('Insurance Information', 20, y)
    y += 10

    const insuranceTypes = [
      { key: 'home_insurance', label: 'Home Insurance', icon: 'home' },
      { key: 'car_insurance', label: 'Car Insurance', icon: 'car' },
      { key: 'medical_insurance', label: 'Medical Insurance', icon: 'medical' },
    ]

    insuranceTypes.forEach((ins) => {
      const insurance = profile[ins.key as keyof typeof profile] as InsuranceDetails | undefined
      if (insurance?.provider) {
        y = checkNewPage(doc, y, 28)

        // No background, just border
        doc.setDrawColor(200, 200, 210)
        doc.setLineWidth(0.3)
        doc.roundedRect(20, y, pageWidth - 40, 24, 2, 2, 'S')

        doc.setFontSize(10)
        doc.setTextColor(0, 5, 66)
        doc.setFont('helvetica', 'bold')
        doc.text(ins.label, 25, y + 7)

        doc.setFont('helvetica', 'normal')
        doc.setTextColor(60, 60, 60)
        doc.text(`Provider: ${insurance.provider}`, 25, y + 14)

        if (insurance.policy_number) {
          doc.text(`Policy: ${insurance.policy_number}`, 95, y + 14)
        }
        if (insurance.contact_phone) {
          doc.text(`Claims: ${insurance.contact_phone}`, 25, y + 21)
        }

        y += 28
      }
    })
  }

  // Utility Companies
  if (profile.utility_companies && profile.utility_companies.length > 0) {
    // 18px spacing above heading
    y += 6
    y = checkNewPage(doc, y, 60)

    doc.setFontSize(12)
    doc.setTextColor(0, 5, 66)
    doc.setFont('helvetica', 'bold')
    doc.text('Utility Providers', 20, y)
    y += 10

    profile.utility_companies.forEach((utility) => {
      y = checkNewPage(doc, y, 30)

      // No background, just border
      doc.setDrawColor(200, 200, 210)
      doc.setLineWidth(0.3)
      doc.roundedRect(20, y, pageWidth - 40, 27, 2, 2, 'S')

      // Utility type label
      const typeLabel = UTILITY_TYPE_LABELS[utility.type] || utility.type
      doc.setFontSize(10)
      doc.setTextColor(0, 5, 66)
      doc.setFont('helvetica', 'bold')
      doc.text(typeLabel, 25, y + 7)

      // Provider name
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text(`Provider: ${utility.provider}`, 25, y + 14)

      // Account number (if available)
      if (utility.account_number) {
        doc.text(`Account: ${utility.account_number}`, 100, y + 14)
      }

      // Phone (if available)
      if (utility.phone) {
        doc.text(`Phone: ${utility.phone}`, 25, y + 21)
      }

      // Website (if available)
      if (utility.website) {
        doc.text(`Web: ${utility.website}`, utility.phone ? 100 : 25, y + 21)
      }

      y += 31
    })
  }

  // Skills
  if (profile.skills && profile.skills.length > 0) {
    // 18px spacing above heading
    y += 6
    y = checkNewPage(doc, y, 40)

    doc.setFontSize(12)
    doc.setTextColor(0, 5, 66)
    doc.setFont('helvetica', 'bold')
    doc.text('Skills & Qualifications', 20, y)
    y += 10

    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)
    doc.setFont('helvetica', 'normal')

    let skillY = y
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

    y = skillY + 14
  }

  // Disabilities/Special Needs
  if (profile.disabilities && profile.disabilities.length > 0) {
    // 18px spacing above heading
    y += 6
    y = checkNewPage(doc, y, 40)

    doc.setFontSize(12)
    doc.setTextColor(0, 5, 66)
    doc.setFont('helvetica', 'bold')
    doc.text('Special Needs & Considerations', 20, y)
    y += 10

    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)
    doc.setFont('helvetica', 'normal')

    let disY = y
    profile.disabilities.forEach((disability) => {
      disY = checkNewPage(doc, disY, 10)
      const label = DISABILITY_LABELS[disability] || disability
      doc.text(`• ${label}`, 25, disY)
      disY += 8
    })

    y = disY + 10
  }

  // Preparedness
  const hasPreparedness = profile.has_backup_power || profile.has_backup_water || profile.has_food_supply
  if (hasPreparedness) {
    // 18px spacing above heading
    y += 6
    y = checkNewPage(doc, y, 40)

    doc.setFontSize(12)
    doc.setTextColor(0, 5, 66)
    doc.setFont('helvetica', 'bold')
    doc.text('Emergency Preparedness', 20, y)
    y += 10

    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)
    doc.setFont('helvetica', 'normal')

    if (profile.has_backup_power) {
      // Draw checkbox with checkmark
      doc.setDrawColor(34, 197, 94)
      doc.setFillColor(34, 197, 94)
      doc.rect(25, y - 3.5, 4, 4, 'FD')
      doc.setTextColor(60, 60, 60)
      doc.text('Emergency backup power available', 33, y)
      y += 8
    }
    if (profile.has_backup_water) {
      // Draw checkbox with checkmark
      doc.setDrawColor(34, 197, 94)
      doc.setFillColor(34, 197, 94)
      doc.rect(25, y - 3.5, 4, 4, 'FD')
      doc.setTextColor(60, 60, 60)
      doc.text('Backup water supply available', 33, y)
      y += 8
    }
    if (profile.has_food_supply) {
      // Draw checkbox with checkmark
      doc.setDrawColor(34, 197, 94)
      doc.setFillColor(34, 197, 94)
      doc.rect(25, y - 3.5, 4, 4, 'FD')
      doc.setTextColor(60, 60, 60)
      doc.text('Food supply for 5+ days', 33, y)
      y += 8
    }
  }

  // General comments
  if (profile.general_comments) {
    // 18px spacing above heading
    y += 6
    y = checkNewPage(doc, y, 40)

    doc.setFontSize(12)
    doc.setTextColor(0, 5, 66)
    doc.setFont('helvetica', 'bold')
    doc.text('Additional Notes', 20, y)
    y += 10

    // No background, just border
    const commentLines = doc.splitTextToSize(profile.general_comments, pageWidth - 50)
    doc.setDrawColor(200, 200, 210)
    doc.setLineWidth(0.3)
    doc.roundedRect(20, y, pageWidth - 40, 10 + commentLines.length * 5, 2, 2, 'S')

    doc.setFontSize(10)
    doc.setTextColor(80, 80, 80)
    doc.setFont('helvetica', 'normal')
    doc.text(commentLines, 25, y + 7)
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
