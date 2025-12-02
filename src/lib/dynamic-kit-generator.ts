/**
 * Dynamic Emergency Kit Generator
 * Generates personalized emergency kit recommendations based on:
 * 1. General emergency preparedness guidelines
 * 2. Community-specific response plans
 * 3. User's household composition (members, ages, special needs)
 */

import type { HouseholdMember, ProfileExtended } from '@/types/database'

// Recheck periods in days
export const RECHECK_PERIODS = {
  perishable: 90, // 3 months for water, food, batteries
  medical: 90, // 3 months for medications
  equipment: 180, // 6 months for tools, equipment
  documents: 365, // 1 year for documents
  clothing: 180, // 6 months for clothing items
}

export interface ChecklistItem {
  id: string
  name: string
  description?: string
  quantity?: string
  checked: boolean
  lastChecked?: string
  recheckDays: number
  category: string
  source: 'general' | 'household' | 'response_plan' | 'special_needs'
  priority: 'essential' | 'recommended' | 'optional'
}

export interface ChecklistCategory {
  id: string
  name: string
  icon: string
  items: ChecklistItem[]
  source?: string // e.g., "Earthquake Response Plan"
}

export interface HouseholdAnalysis {
  totalPeople: number
  hasInfants: boolean // 0-2 years
  hasToddlers: boolean // 2-5 years
  hasChildren: boolean // 5-12 years
  hasTeens: boolean // 13-17 years
  hasAdults: boolean // 18-64 years
  hasElderly: boolean // 65+
  infantCount: number
  toddlerCount: number
  childCount: number
  teenCount: number
  adultCount: number
  elderlyCount: number
}

export interface ResponsePlanSupplies {
  planName: string
  planType: string
  planIcon: string
  supplies: string[]
}

// Parse age string to number (handles various formats)
function parseAge(ageStr: string): number | null {
  if (!ageStr) return null
  const cleaned = ageStr.trim().toLowerCase()

  // Handle ranges like "5-10" - take the lower bound
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-')
    const firstPart = parts[0] ?? ''
    const num = parseInt(firstPart)
    return isNaN(num) ? null : num
  }

  // Handle descriptive ages
  if (cleaned.includes('infant') || cleaned.includes('baby')) return 1
  if (cleaned.includes('toddler')) return 3
  if (cleaned.includes('child') || cleaned.includes('kid')) return 8
  if (cleaned.includes('teen')) return 15
  if (cleaned.includes('adult')) return 30
  if (cleaned.includes('elder') || cleaned.includes('senior')) return 70

  // Try parsing as number
  const num = parseInt(cleaned)
  return isNaN(num) ? null : num
}

// Analyze household composition
export function analyzeHousehold(
  householdMembers: HouseholdMember[],
  includeMainUser: boolean = true
): HouseholdAnalysis {
  const analysis: HouseholdAnalysis = {
    totalPeople: includeMainUser ? 1 : 0,
    hasInfants: false,
    hasToddlers: false,
    hasChildren: false,
    hasTeens: false,
    hasAdults: includeMainUser, // Assume main user is an adult
    hasElderly: false,
    infantCount: 0,
    toddlerCount: 0,
    childCount: 0,
    teenCount: 0,
    adultCount: includeMainUser ? 1 : 0,
    elderlyCount: 0,
  }

  for (const member of householdMembers) {
    analysis.totalPeople++
    const age = parseAge(member.age)

    if (age === null) {
      // If age unknown, assume adult
      analysis.hasAdults = true
      analysis.adultCount++
    } else if (age <= 2) {
      analysis.hasInfants = true
      analysis.infantCount++
    } else if (age <= 5) {
      analysis.hasToddlers = true
      analysis.toddlerCount++
    } else if (age <= 12) {
      analysis.hasChildren = true
      analysis.childCount++
    } else if (age <= 17) {
      analysis.hasTeens = true
      analysis.teenCount++
    } else if (age < 65) {
      analysis.hasAdults = true
      analysis.adultCount++
    } else {
      analysis.hasElderly = true
      analysis.elderlyCount++
    }
  }

  return analysis
}

// Generate water requirements description
function getWaterRequirement(analysis: HouseholdAnalysis): string {
  const litresPerPerson = 3
  const days = 3
  const totalLitres = analysis.totalPeople * litresPerPerson * days
  return `Drinking water (${totalLitres}L total - ${litresPerPerson}L per person per day for ${days}+ days)`
}

// Generate food requirements description
function getFoodRequirement(analysis: HouseholdAnalysis): string {
  return `Non-perishable food for ${analysis.totalPeople} people (${3}+ days supply)`
}

// Base general checklist items
function getGeneralChecklist(analysis: HouseholdAnalysis): ChecklistCategory[] {
  return [
    {
      id: 'water',
      name: 'Water & Food',
      icon: 'water_drop',
      items: [
        {
          id: 'water-1',
          name: getWaterRequirement(analysis),
          checked: false,
          recheckDays: RECHECK_PERIODS.perishable,
          category: 'water',
          source: 'general',
          priority: 'essential',
        },
        {
          id: 'water-2',
          name: 'Water purification tablets or filter',
          checked: false,
          recheckDays: RECHECK_PERIODS.perishable,
          category: 'water',
          source: 'general',
          priority: 'recommended',
        },
        {
          id: 'food-1',
          name: getFoodRequirement(analysis),
          checked: false,
          recheckDays: RECHECK_PERIODS.perishable,
          category: 'water',
          source: 'general',
          priority: 'essential',
        },
        {
          id: 'food-2',
          name: 'Manual can opener',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'water',
          source: 'general',
          priority: 'essential',
        },
        {
          id: 'food-3',
          name: `Eating utensils for ${analysis.totalPeople} people (plates, cups, cutlery)`,
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'water',
          source: 'general',
          priority: 'recommended',
        },
      ],
    },
    {
      id: 'first-aid',
      name: 'First Aid & Medical',
      icon: 'medical_services',
      items: [
        {
          id: 'med-1',
          name: 'First aid kit',
          checked: false,
          recheckDays: RECHECK_PERIODS.medical,
          category: 'first-aid',
          source: 'general',
          priority: 'essential',
        },
        {
          id: 'med-2',
          name: 'Prescription medications (7+ day supply)',
          checked: false,
          recheckDays: RECHECK_PERIODS.medical,
          category: 'first-aid',
          source: 'general',
          priority: 'essential',
        },
        {
          id: 'med-3',
          name: 'Pain relievers (paracetamol, ibuprofen)',
          checked: false,
          recheckDays: RECHECK_PERIODS.medical,
          category: 'first-aid',
          source: 'general',
          priority: 'recommended',
        },
        {
          id: 'med-4',
          name: 'Antiseptic wipes/solution',
          checked: false,
          recheckDays: RECHECK_PERIODS.medical,
          category: 'first-aid',
          source: 'general',
          priority: 'recommended',
        },
        {
          id: 'med-5',
          name: 'Bandages and dressings',
          checked: false,
          recheckDays: RECHECK_PERIODS.medical,
          category: 'first-aid',
          source: 'general',
          priority: 'essential',
        },
        {
          id: 'med-6',
          name: 'Scissors and tweezers',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'first-aid',
          source: 'general',
          priority: 'recommended',
        },
        {
          id: 'med-7',
          name: 'Thermometer',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'first-aid',
          source: 'general',
          priority: 'recommended',
        },
        {
          id: 'med-8',
          name: `Face masks (pack for ${analysis.totalPeople} people)`,
          checked: false,
          recheckDays: RECHECK_PERIODS.medical,
          category: 'first-aid',
          source: 'general',
          priority: 'recommended',
        },
        {
          id: 'med-9',
          name: 'Hand sanitiser',
          checked: false,
          recheckDays: RECHECK_PERIODS.medical,
          category: 'first-aid',
          source: 'general',
          priority: 'recommended',
        },
      ],
    },
    {
      id: 'tools',
      name: 'Tools & Equipment',
      icon: 'handyman',
      items: [
        {
          id: 'tool-1',
          name: 'Torch/flashlight with extra batteries',
          checked: false,
          recheckDays: RECHECK_PERIODS.perishable,
          category: 'tools',
          source: 'general',
          priority: 'essential',
        },
        {
          id: 'tool-2',
          name: 'Battery-powered or crank radio',
          checked: false,
          recheckDays: RECHECK_PERIODS.perishable,
          category: 'tools',
          source: 'general',
          priority: 'essential',
        },
        {
          id: 'tool-3',
          name: 'Phone charger and power bank',
          checked: false,
          recheckDays: RECHECK_PERIODS.perishable,
          category: 'tools',
          source: 'general',
          priority: 'essential',
        },
        {
          id: 'tool-4',
          name: 'Whistle (for signalling)',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'tools',
          source: 'general',
          priority: 'recommended',
        },
        {
          id: 'tool-5',
          name: 'Multi-tool or basic tool kit',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'tools',
          source: 'general',
          priority: 'recommended',
        },
        {
          id: 'tool-6',
          name: 'Duct tape',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'tools',
          source: 'general',
          priority: 'optional',
        },
        {
          id: 'tool-7',
          name: 'Wrench (for turning off utilities)',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'tools',
          source: 'general',
          priority: 'recommended',
        },
        {
          id: 'tool-8',
          name: 'Work gloves',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'tools',
          source: 'general',
          priority: 'recommended',
        },
      ],
    },
    {
      id: 'shelter',
      name: 'Shelter & Warmth',
      icon: 'home',
      items: [
        {
          id: 'shelter-1',
          name: `Emergency blankets or sleeping bags (${analysis.totalPeople})`,
          checked: false,
          recheckDays: RECHECK_PERIODS.clothing,
          category: 'shelter',
          source: 'general',
          priority: 'essential',
        },
        {
          id: 'shelter-2',
          name: 'Tarpaulin or plastic sheeting',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'shelter',
          source: 'general',
          priority: 'recommended',
        },
        {
          id: 'shelter-3',
          name: `Warm clothing for each household member (${analysis.totalPeople} sets)`,
          checked: false,
          recheckDays: RECHECK_PERIODS.clothing,
          category: 'shelter',
          source: 'general',
          priority: 'essential',
        },
        {
          id: 'shelter-4',
          name: `Sturdy shoes (${analysis.totalPeople} pairs)`,
          checked: false,
          recheckDays: RECHECK_PERIODS.clothing,
          category: 'shelter',
          source: 'general',
          priority: 'essential',
        },
        {
          id: 'shelter-5',
          name: `Rain gear (${analysis.totalPeople} sets)`,
          checked: false,
          recheckDays: RECHECK_PERIODS.clothing,
          category: 'shelter',
          source: 'general',
          priority: 'recommended',
        },
        {
          id: 'shelter-6',
          name: 'Tent (if available)',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'shelter',
          source: 'general',
          priority: 'optional',
        },
      ],
    },
    {
      id: 'documents',
      name: 'Documents & Money',
      icon: 'description',
      items: [
        {
          id: 'doc-1',
          name: 'Copies of important documents (in waterproof bag)',
          description: 'ID, insurance, medical records, property deeds',
          checked: false,
          recheckDays: RECHECK_PERIODS.documents,
          category: 'documents',
          source: 'general',
          priority: 'essential',
        },
        {
          id: 'doc-2',
          name: 'Cash in small denominations',
          checked: false,
          recheckDays: RECHECK_PERIODS.documents,
          category: 'documents',
          source: 'general',
          priority: 'essential',
        },
        {
          id: 'doc-3',
          name: 'Emergency contact list',
          checked: false,
          recheckDays: RECHECK_PERIODS.documents,
          category: 'documents',
          source: 'general',
          priority: 'essential',
        },
        {
          id: 'doc-4',
          name: 'Local area map',
          checked: false,
          recheckDays: RECHECK_PERIODS.documents,
          category: 'documents',
          source: 'general',
          priority: 'recommended',
        },
        {
          id: 'doc-5',
          name: 'USB drive with digital copies of documents',
          checked: false,
          recheckDays: RECHECK_PERIODS.documents,
          category: 'documents',
          source: 'general',
          priority: 'optional',
        },
      ],
    },
    {
      id: 'hygiene',
      name: 'Hygiene & Sanitation',
      icon: 'sanitizer',
      items: [
        {
          id: 'hyg-1',
          name: 'Toilet paper',
          checked: false,
          recheckDays: RECHECK_PERIODS.perishable,
          category: 'hygiene',
          source: 'general',
          priority: 'essential',
        },
        {
          id: 'hyg-2',
          name: 'Wet wipes',
          checked: false,
          recheckDays: RECHECK_PERIODS.perishable,
          category: 'hygiene',
          source: 'general',
          priority: 'recommended',
        },
        {
          id: 'hyg-3',
          name: 'Rubbish bags',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'hygiene',
          source: 'general',
          priority: 'essential',
        },
        {
          id: 'hyg-4',
          name: 'Bucket with lid (emergency toilet)',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'hygiene',
          source: 'general',
          priority: 'recommended',
        },
        {
          id: 'hyg-5',
          name: 'Soap and shampoo',
          checked: false,
          recheckDays: RECHECK_PERIODS.perishable,
          category: 'hygiene',
          source: 'general',
          priority: 'recommended',
        },
        {
          id: 'hyg-6',
          name: `Toothbrush and toothpaste (${analysis.totalPeople} sets)`,
          checked: false,
          recheckDays: RECHECK_PERIODS.perishable,
          category: 'hygiene',
          source: 'general',
          priority: 'recommended',
        },
      ],
    },
  ]
}

// Generate household-specific items based on composition
function getHouseholdSpecificItems(analysis: HouseholdAnalysis): ChecklistCategory[] {
  const categories: ChecklistCategory[] = []

  // Infant-specific items
  if (analysis.hasInfants) {
    categories.push({
      id: 'infant-supplies',
      name: `Infant Supplies (${analysis.infantCount} infant${analysis.infantCount > 1 ? 's' : ''})`,
      icon: 'child_care',
      items: [
        {
          id: 'infant-1',
          name: `Baby formula (7+ day supply for ${analysis.infantCount} infant${analysis.infantCount > 1 ? 's' : ''})`,
          checked: false,
          recheckDays: RECHECK_PERIODS.perishable,
          category: 'infant-supplies',
          source: 'household',
          priority: 'essential',
        },
        {
          id: 'infant-2',
          name: `Nappies/diapers (7+ day supply - approx ${analysis.infantCount * 8 * 7} nappies)`,
          checked: false,
          recheckDays: RECHECK_PERIODS.perishable,
          category: 'infant-supplies',
          source: 'household',
          priority: 'essential',
        },
        {
          id: 'infant-3',
          name: 'Baby wipes (multiple packs)',
          checked: false,
          recheckDays: RECHECK_PERIODS.perishable,
          category: 'infant-supplies',
          source: 'household',
          priority: 'essential',
        },
        {
          id: 'infant-4',
          name: 'Bottles and bottle brush',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'infant-supplies',
          source: 'household',
          priority: 'essential',
        },
        {
          id: 'infant-5',
          name: 'Nappy rash cream',
          checked: false,
          recheckDays: RECHECK_PERIODS.medical,
          category: 'infant-supplies',
          source: 'household',
          priority: 'recommended',
        },
        {
          id: 'infant-6',
          name: 'Baby blankets',
          checked: false,
          recheckDays: RECHECK_PERIODS.clothing,
          category: 'infant-supplies',
          source: 'household',
          priority: 'essential',
        },
        {
          id: 'infant-7',
          name: 'Infant pain reliever (e.g., Pamol)',
          checked: false,
          recheckDays: RECHECK_PERIODS.medical,
          category: 'infant-supplies',
          source: 'household',
          priority: 'recommended',
        },
      ],
    })
  }

  // Toddler-specific items
  if (analysis.hasToddlers) {
    categories.push({
      id: 'toddler-supplies',
      name: `Toddler Supplies (${analysis.toddlerCount} toddler${analysis.toddlerCount > 1 ? 's' : ''})`,
      icon: 'child_friendly',
      items: [
        {
          id: 'toddler-1',
          name: `Training pants/pull-ups (7+ day supply)`,
          description: 'If still toilet training',
          checked: false,
          recheckDays: RECHECK_PERIODS.perishable,
          category: 'toddler-supplies',
          source: 'household',
          priority: 'recommended',
        },
        {
          id: 'toddler-2',
          name: 'Toddler-friendly snacks (crackers, dried fruit)',
          checked: false,
          recheckDays: RECHECK_PERIODS.perishable,
          category: 'toddler-supplies',
          source: 'household',
          priority: 'recommended',
        },
        {
          id: 'toddler-3',
          name: 'Sippy cups or spill-proof bottles',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'toddler-supplies',
          source: 'household',
          priority: 'recommended',
        },
        {
          id: 'toddler-4',
          name: 'Comfort item (favourite toy or blanket)',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'toddler-supplies',
          source: 'household',
          priority: 'recommended',
        },
        {
          id: 'toddler-5',
          name: 'Child-safe pain reliever',
          checked: false,
          recheckDays: RECHECK_PERIODS.medical,
          category: 'toddler-supplies',
          source: 'household',
          priority: 'recommended',
        },
      ],
    })
  }

  // Children-specific items
  if (analysis.hasChildren || analysis.hasTeens) {
    const childCount = analysis.childCount + analysis.teenCount
    categories.push({
      id: 'children-supplies',
      name: `Children & Teen Supplies (${childCount} child${childCount > 1 ? 'ren' : ''})`,
      icon: 'escalator_warning',
      items: [
        {
          id: 'child-1',
          name: 'Activities/games to keep children occupied',
          description: 'Books, cards, small games',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'children-supplies',
          source: 'household',
          priority: 'recommended',
        },
        {
          id: 'child-2',
          name: 'Child-appropriate snacks',
          checked: false,
          recheckDays: RECHECK_PERIODS.perishable,
          category: 'children-supplies',
          source: 'household',
          priority: 'recommended',
        },
        {
          id: 'child-3',
          name: 'Comfort items for each child',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'children-supplies',
          source: 'household',
          priority: 'optional',
        },
      ],
    })
  }

  // Elderly-specific items
  if (analysis.hasElderly) {
    categories.push({
      id: 'elderly-supplies',
      name: `Elderly Member Supplies (${analysis.elderlyCount} person${analysis.elderlyCount > 1 ? 's' : ''})`,
      icon: 'elderly',
      items: [
        {
          id: 'elderly-1',
          name: 'Extra prescription medications (14+ day supply)',
          description: 'Elderly members may need longer medication supply',
          checked: false,
          recheckDays: RECHECK_PERIODS.medical,
          category: 'elderly-supplies',
          source: 'household',
          priority: 'essential',
        },
        {
          id: 'elderly-2',
          name: 'Mobility aids (spare cane, walker parts)',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'elderly-supplies',
          source: 'household',
          priority: 'recommended',
        },
        {
          id: 'elderly-3',
          name: 'Hearing aid batteries',
          checked: false,
          recheckDays: RECHECK_PERIODS.perishable,
          category: 'elderly-supplies',
          source: 'household',
          priority: 'recommended',
        },
        {
          id: 'elderly-4',
          name: 'Reading glasses (spare pair)',
          checked: false,
          recheckDays: RECHECK_PERIODS.equipment,
          category: 'elderly-supplies',
          source: 'household',
          priority: 'recommended',
        },
        {
          id: 'elderly-5',
          name: 'Large-print emergency instructions',
          checked: false,
          recheckDays: RECHECK_PERIODS.documents,
          category: 'elderly-supplies',
          source: 'household',
          priority: 'optional',
        },
        {
          id: 'elderly-6',
          name: 'Incontinence supplies (if needed)',
          checked: false,
          recheckDays: RECHECK_PERIODS.perishable,
          category: 'elderly-supplies',
          source: 'household',
          priority: 'recommended',
        },
      ],
    })
  }

  return categories
}

// Generate special needs items based on user profile
function getSpecialNeedsItems(
  disabilities: string[] | undefined
): ChecklistCategory | null {
  if (!disabilities || disabilities.length === 0) return null

  const items: ChecklistItem[] = []

  // Map disability types to recommended items
  const disabilityItemMap: Record<string, ChecklistItem[]> = {
    mobility: [
      {
        id: 'mobility-1',
        name: 'Wheelchair/mobility aid supplies and repair kit',
        checked: false,
        recheckDays: RECHECK_PERIODS.equipment,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'essential',
      },
      {
        id: 'mobility-2',
        name: 'Portable ramp or transfer board',
        checked: false,
        recheckDays: RECHECK_PERIODS.equipment,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'recommended',
      },
    ],
    vision: [
      {
        id: 'vision-1',
        name: 'Spare glasses and/or contact lenses with solution',
        checked: false,
        recheckDays: RECHECK_PERIODS.medical,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'essential',
      },
      {
        id: 'vision-2',
        name: 'Talking/large-button emergency supplies',
        checked: false,
        recheckDays: RECHECK_PERIODS.equipment,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'recommended',
      },
      {
        id: 'vision-3',
        name: 'White cane (spare)',
        checked: false,
        recheckDays: RECHECK_PERIODS.equipment,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'recommended',
      },
    ],
    hearing: [
      {
        id: 'hearing-1',
        name: 'Extra hearing aid batteries (2+ weeks supply)',
        checked: false,
        recheckDays: RECHECK_PERIODS.perishable,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'essential',
      },
      {
        id: 'hearing-2',
        name: 'Visual/vibrating alert devices',
        checked: false,
        recheckDays: RECHECK_PERIODS.equipment,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'recommended',
      },
      {
        id: 'hearing-3',
        name: 'Written communication cards',
        checked: false,
        recheckDays: RECHECK_PERIODS.documents,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'recommended',
      },
    ],
    cognitive: [
      {
        id: 'cognitive-1',
        name: 'Simple, visual emergency instructions',
        checked: false,
        recheckDays: RECHECK_PERIODS.documents,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'essential',
      },
      {
        id: 'cognitive-2',
        name: 'Comfort/sensory items',
        checked: false,
        recheckDays: RECHECK_PERIODS.equipment,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'recommended',
      },
      {
        id: 'cognitive-3',
        name: 'ID bracelet or card with emergency contact info',
        checked: false,
        recheckDays: RECHECK_PERIODS.documents,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'essential',
      },
    ],
    respiratory: [
      {
        id: 'resp-1',
        name: 'Spare inhalers/nebulizer with power source',
        checked: false,
        recheckDays: RECHECK_PERIODS.medical,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'essential',
      },
      {
        id: 'resp-2',
        name: 'Extra N95/P2 masks for respiratory protection',
        checked: false,
        recheckDays: RECHECK_PERIODS.medical,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'essential',
      },
      {
        id: 'resp-3',
        name: 'Portable oxygen (if prescribed)',
        checked: false,
        recheckDays: RECHECK_PERIODS.medical,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'essential',
      },
    ],
    diabetes: [
      {
        id: 'diabetes-1',
        name: 'Insulin and supplies (14+ day supply with cooling case)',
        checked: false,
        recheckDays: RECHECK_PERIODS.medical,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'essential',
      },
      {
        id: 'diabetes-2',
        name: 'Blood glucose monitor and test strips',
        checked: false,
        recheckDays: RECHECK_PERIODS.medical,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'essential',
      },
      {
        id: 'diabetes-3',
        name: 'Fast-acting glucose tablets or snacks',
        checked: false,
        recheckDays: RECHECK_PERIODS.perishable,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'essential',
      },
    ],
    dialysis: [
      {
        id: 'dialysis-1',
        name: 'Dialysis emergency contact information',
        checked: false,
        recheckDays: RECHECK_PERIODS.documents,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'essential',
      },
      {
        id: 'dialysis-2',
        name: 'Emergency dialysis center locations documented',
        checked: false,
        recheckDays: RECHECK_PERIODS.documents,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'essential',
      },
    ],
    allergies: [
      {
        id: 'allergy-1',
        name: 'EpiPen or adrenaline auto-injector (multiple)',
        checked: false,
        recheckDays: RECHECK_PERIODS.medical,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'essential',
      },
      {
        id: 'allergy-2',
        name: 'Antihistamines',
        checked: false,
        recheckDays: RECHECK_PERIODS.medical,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'essential',
      },
      {
        id: 'allergy-3',
        name: 'Medical alert bracelet/documentation',
        checked: false,
        recheckDays: RECHECK_PERIODS.documents,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'essential',
      },
      {
        id: 'allergy-4',
        name: 'Allergen-free food supply',
        checked: false,
        recheckDays: RECHECK_PERIODS.perishable,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'essential',
      },
    ],
    mental_health: [
      {
        id: 'mental-1',
        name: 'Mental health medication (14+ day supply)',
        checked: false,
        recheckDays: RECHECK_PERIODS.medical,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'essential',
      },
      {
        id: 'mental-2',
        name: 'Calming/coping items (stress ball, headphones, music)',
        checked: false,
        recheckDays: RECHECK_PERIODS.equipment,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'recommended',
      },
      {
        id: 'mental-3',
        name: 'Crisis helpline numbers documented',
        checked: false,
        recheckDays: RECHECK_PERIODS.documents,
        category: 'special-needs',
        source: 'special_needs',
        priority: 'recommended',
      },
    ],
  }

  // Add items for each disability type
  for (const disability of disabilities) {
    const mappedItems = disabilityItemMap[disability]
    if (mappedItems) {
      items.push(...mappedItems)
    }
  }

  if (items.length === 0) return null

  return {
    id: 'special-needs',
    name: 'Special Needs & Medical Requirements',
    icon: 'accessible',
    items,
  }
}

// Convert response plan supplies to checklist items
function getResponsePlanItems(
  responsePlans: ResponsePlanSupplies[]
): ChecklistCategory[] {
  return responsePlans.map((plan, planIndex) => ({
    id: `response-plan-${planIndex}`,
    name: `${plan.planName} Supplies`,
    icon: plan.planIcon || 'emergency',
    source: plan.planName,
    items: plan.supplies.map((supply, supplyIndex) => ({
      id: `rp-${planIndex}-${supplyIndex}`,
      name: supply,
      checked: false,
      recheckDays: RECHECK_PERIODS.equipment,
      category: `response-plan-${planIndex}`,
      source: 'response_plan' as const,
      priority: 'recommended' as const,
    })),
  }))
}

// Main function to generate dynamic checklist
export function generateDynamicChecklist(
  householdMembers: HouseholdMember[] = [],
  profileExtended: ProfileExtended | null = null,
  responsePlans: ResponsePlanSupplies[] = []
): ChecklistCategory[] {
  // Analyze household
  const analysis = analyzeHousehold(householdMembers, true)

  // Build categories
  const categories: ChecklistCategory[] = []

  // 1. General guidelines (customized for household size)
  categories.push(...getGeneralChecklist(analysis))

  // 2. Household-specific items (babies, children, elderly)
  categories.push(...getHouseholdSpecificItems(analysis))

  // 3. Special needs items
  const specialNeedsCategory = getSpecialNeedsItems(profileExtended?.disabilities)
  if (specialNeedsCategory) {
    categories.push(specialNeedsCategory)
  }

  // 4. Response plan items (deduplicated)
  if (responsePlans.length > 0) {
    const responsePlanCategories = getResponsePlanItems(responsePlans)

    // Create a set of existing item names for deduplication
    const existingItemNames = new Set(
      categories.flatMap(c => c.items.map(i => i.name.toLowerCase()))
    )

    // Filter out duplicate items from response plans
    for (const rpCategory of responsePlanCategories) {
      rpCategory.items = rpCategory.items.filter(
        item => !existingItemNames.has(item.name.toLowerCase())
      )
      // Only add if there are unique items
      if (rpCategory.items.length > 0) {
        categories.push(rpCategory)
      }
    }
  }

  return categories
}

// Get summary of personalized recommendations
export function getChecklistSummary(
  householdMembers: HouseholdMember[] = [],
  profileExtended: ProfileExtended | null = null,
  responsePlans: ResponsePlanSupplies[] = []
): {
  householdAnalysis: HouseholdAnalysis
  hasSpecialNeeds: boolean
  responsePlanCount: number
  totalItems: number
  personalizedItems: number
} {
  const analysis = analyzeHousehold(householdMembers, true)
  const categories = generateDynamicChecklist(householdMembers, profileExtended, responsePlans)

  const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0)
  const personalizedItems = categories.reduce(
    (sum, cat) => sum + cat.items.filter(i => i.source !== 'general').length,
    0
  )

  return {
    householdAnalysis: analysis,
    hasSpecialNeeds: (profileExtended?.disabilities?.length ?? 0) > 0,
    responsePlanCount: responsePlans.length,
    totalItems,
    personalizedItems,
  }
}
