'use client'

import { useState, useEffect } from 'react'

interface ChecklistItem {
  id: string
  name: string
  description?: string
  checked: boolean
  lastChecked?: string // ISO date string
  recheckDays: number // Days until recheck needed
}

interface ChecklistCategory {
  id: string
  name: string
  icon: string
  items: ChecklistItem[]
}

type ItemStatus = 'ok' | 'warning' | 'overdue' | 'unchecked'

const CHECKLIST_STORAGE_KEY = 'civildefence_checklist'

// Recheck periods in days
const RECHECK_PERIODS = {
  perishable: 90, // 3 months for water, food, batteries
  medical: 90, // 3 months for medications
  equipment: 180, // 6 months for tools, equipment
  documents: 365, // 1 year for documents
  clothing: 180, // 6 months for clothing items
}

const defaultChecklist: ChecklistCategory[] = [
  {
    id: 'water',
    name: 'Water & Food',
    icon: 'water_drop',
    items: [
      { id: 'water-1', name: 'Drinking water (3L per person per day for 3+ days)', checked: false, recheckDays: RECHECK_PERIODS.perishable },
      { id: 'water-2', name: 'Water purification tablets or filter', checked: false, recheckDays: RECHECK_PERIODS.perishable },
      { id: 'food-1', name: 'Non-perishable food (3+ days supply)', checked: false, recheckDays: RECHECK_PERIODS.perishable },
      { id: 'food-2', name: 'Manual can opener', checked: false, recheckDays: RECHECK_PERIODS.equipment },
      { id: 'food-3', name: 'Eating utensils (plates, cups, cutlery)', checked: false, recheckDays: RECHECK_PERIODS.equipment },
      { id: 'food-4', name: 'Baby food/formula (if needed)', checked: false, recheckDays: RECHECK_PERIODS.perishable },
      { id: 'food-5', name: 'Pet food (if needed)', checked: false, recheckDays: RECHECK_PERIODS.perishable },
    ],
  },
  {
    id: 'first-aid',
    name: 'First Aid & Medical',
    icon: 'medical_services',
    items: [
      { id: 'med-1', name: 'First aid kit', checked: false, recheckDays: RECHECK_PERIODS.medical },
      { id: 'med-2', name: 'Prescription medications (7+ day supply)', checked: false, recheckDays: RECHECK_PERIODS.medical },
      { id: 'med-3', name: 'Pain relievers (paracetamol, ibuprofen)', checked: false, recheckDays: RECHECK_PERIODS.medical },
      { id: 'med-4', name: 'Antiseptic wipes/solution', checked: false, recheckDays: RECHECK_PERIODS.medical },
      { id: 'med-5', name: 'Bandages and dressings', checked: false, recheckDays: RECHECK_PERIODS.medical },
      { id: 'med-6', name: 'Scissors and tweezers', checked: false, recheckDays: RECHECK_PERIODS.equipment },
      { id: 'med-7', name: 'Thermometer', checked: false, recheckDays: RECHECK_PERIODS.equipment },
      { id: 'med-8', name: 'Face masks', checked: false, recheckDays: RECHECK_PERIODS.medical },
      { id: 'med-9', name: 'Hand sanitiser', checked: false, recheckDays: RECHECK_PERIODS.medical },
    ],
  },
  {
    id: 'tools',
    name: 'Tools & Equipment',
    icon: 'handyman',
    items: [
      { id: 'tool-1', name: 'Torch/flashlight with extra batteries', checked: false, recheckDays: RECHECK_PERIODS.perishable },
      { id: 'tool-2', name: 'Battery-powered or crank radio', checked: false, recheckDays: RECHECK_PERIODS.perishable },
      { id: 'tool-3', name: 'Phone charger and power bank', checked: false, recheckDays: RECHECK_PERIODS.perishable },
      { id: 'tool-4', name: 'Whistle (for signalling)', checked: false, recheckDays: RECHECK_PERIODS.equipment },
      { id: 'tool-5', name: 'Multi-tool or basic tool kit', checked: false, recheckDays: RECHECK_PERIODS.equipment },
      { id: 'tool-6', name: 'Duct tape', checked: false, recheckDays: RECHECK_PERIODS.equipment },
      { id: 'tool-7', name: 'Wrench (for turning off utilities)', checked: false, recheckDays: RECHECK_PERIODS.equipment },
      { id: 'tool-8', name: 'Work gloves', checked: false, recheckDays: RECHECK_PERIODS.equipment },
    ],
  },
  {
    id: 'shelter',
    name: 'Shelter & Warmth',
    icon: 'home',
    items: [
      { id: 'shelter-1', name: 'Emergency blankets or sleeping bags', checked: false, recheckDays: RECHECK_PERIODS.clothing },
      { id: 'shelter-2', name: 'Tarpaulin or plastic sheeting', checked: false, recheckDays: RECHECK_PERIODS.equipment },
      { id: 'shelter-3', name: 'Warm clothing for each family member', checked: false, recheckDays: RECHECK_PERIODS.clothing },
      { id: 'shelter-4', name: 'Sturdy shoes', checked: false, recheckDays: RECHECK_PERIODS.clothing },
      { id: 'shelter-5', name: 'Rain gear', checked: false, recheckDays: RECHECK_PERIODS.clothing },
      { id: 'shelter-6', name: 'Tent (if available)', checked: false, recheckDays: RECHECK_PERIODS.equipment },
    ],
  },
  {
    id: 'documents',
    name: 'Documents & Money',
    icon: 'description',
    items: [
      { id: 'doc-1', name: 'Copies of important documents (in waterproof bag)', description: 'ID, insurance, medical records, property deeds', checked: false, recheckDays: RECHECK_PERIODS.documents },
      { id: 'doc-2', name: 'Cash in small denominations', checked: false, recheckDays: RECHECK_PERIODS.documents },
      { id: 'doc-3', name: 'Emergency contact list', checked: false, recheckDays: RECHECK_PERIODS.documents },
      { id: 'doc-4', name: 'Local area map', checked: false, recheckDays: RECHECK_PERIODS.documents },
      { id: 'doc-5', name: 'USB drive with digital copies of documents', checked: false, recheckDays: RECHECK_PERIODS.documents },
    ],
  },
  {
    id: 'hygiene',
    name: 'Hygiene & Sanitation',
    icon: 'sanitizer',
    items: [
      { id: 'hyg-1', name: 'Toilet paper', checked: false, recheckDays: RECHECK_PERIODS.perishable },
      { id: 'hyg-2', name: 'Wet wipes', checked: false, recheckDays: RECHECK_PERIODS.perishable },
      { id: 'hyg-3', name: 'Rubbish bags', checked: false, recheckDays: RECHECK_PERIODS.equipment },
      { id: 'hyg-4', name: 'Bucket with lid (emergency toilet)', checked: false, recheckDays: RECHECK_PERIODS.equipment },
      { id: 'hyg-5', name: 'Soap and shampoo', checked: false, recheckDays: RECHECK_PERIODS.perishable },
      { id: 'hyg-6', name: 'Toothbrush and toothpaste', checked: false, recheckDays: RECHECK_PERIODS.perishable },
      { id: 'hyg-7', name: 'Feminine hygiene products', checked: false, recheckDays: RECHECK_PERIODS.perishable },
      { id: 'hyg-8', name: 'Nappies (if needed)', checked: false, recheckDays: RECHECK_PERIODS.perishable },
    ],
  },
]

function getItemStatus(item: ChecklistItem): ItemStatus {
  if (!item.checked || !item.lastChecked) {
    return 'unchecked'
  }

  const lastChecked = new Date(item.lastChecked)
  const now = new Date()
  const daysSinceCheck = Math.floor((now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60 * 24))
  const daysUntilRecheck = item.recheckDays - daysSinceCheck

  if (daysUntilRecheck < 0) {
    return 'overdue'
  } else if (daysUntilRecheck <= 14) {
    return 'warning'
  }
  return 'ok'
}

function getDaysUntilRecheck(item: ChecklistItem): number | null {
  if (!item.checked || !item.lastChecked) return null

  const lastChecked = new Date(item.lastChecked)
  const now = new Date()
  const daysSinceCheck = Math.floor((now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60 * 24))
  return item.recheckDays - daysSinceCheck
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ChecklistPage() {
  const [checklist, setChecklist] = useState<ChecklistCategory[]>(defaultChecklist)
  const [expandedCategories, setExpandedCategories] = useState<string[]>(defaultChecklist.map(c => c.id))
  const [isLoaded, setIsLoaded] = useState(false)

  // Load checklist from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CHECKLIST_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ChecklistCategory[]
        // Merge with defaults to ensure new items are added
        const merged = defaultChecklist.map(defaultCat => {
          const storedCat = parsed.find(c => c.id === defaultCat.id)
          if (!storedCat) return defaultCat

          return {
            ...defaultCat,
            items: defaultCat.items.map(defaultItem => {
              const storedItem = storedCat.items.find(i => i.id === defaultItem.id)
              if (!storedItem) return defaultItem
              return {
                ...defaultItem,
                checked: storedItem.checked,
                ...(storedItem.lastChecked && { lastChecked: storedItem.lastChecked }),
              }
            }),
          }
        })
        setChecklist(merged)
      }
    } catch {
      // Ignore localStorage errors, use defaults
    }
    setIsLoaded(true)
  }, [])

  // Save to localStorage when checklist changes
  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checklist))
    } catch {
      // Ignore localStorage errors
    }
  }, [checklist, isLoaded])

  const toggleItem = (categoryId: string, itemId: string) => {
    setChecklist(prev =>
      prev.map(category =>
        category.id === categoryId
          ? {
              ...category,
              items: category.items.map(item => {
                if (item.id !== itemId) return item
                const newChecked = !item.checked
                if (newChecked) {
                  return {
                    ...item,
                    checked: true,
                    lastChecked: new Date().toISOString(),
                  }
                }
                // When unchecking, remove lastChecked
                const { lastChecked: _, ...rest } = item
                return { ...rest, checked: false }
              }),
            }
          : category
      )
    )
  }

  const recheckItem = (categoryId: string, itemId: string) => {
    setChecklist(prev =>
      prev.map(category =>
        category.id === categoryId
          ? {
              ...category,
              items: category.items.map(item => {
                if (item.id !== itemId) return item
                return {
                  ...item,
                  lastChecked: new Date().toISOString(),
                }
              }),
            }
          : category
      )
    )
  }

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const getTotalProgress = () => {
    const allItems = checklist.flatMap(c => c.items)
    const checkedItems = allItems.filter(item => item.checked)
    return { checked: checkedItems.length, total: allItems.length }
  }

  const getCategoryProgress = (category: ChecklistCategory) => {
    const checkedItems = category.items.filter(item => item.checked)
    return { checked: checkedItems.length, total: category.items.length }
  }

  const getAlertCounts = () => {
    const allItems = checklist.flatMap(c => c.items)
    let warnings = 0
    let overdue = 0

    allItems.forEach(item => {
      const status = getItemStatus(item)
      if (status === 'warning') warnings++
      if (status === 'overdue') overdue++
    })

    return { warnings, overdue }
  }

  const getCategoryAlertCounts = (category: ChecklistCategory) => {
    let warnings = 0
    let overdue = 0

    category.items.forEach(item => {
      const status = getItemStatus(item)
      if (status === 'warning') warnings++
      if (status === 'overdue') overdue++
    })

    return { warnings, overdue }
  }

  const progress = getTotalProgress()
  const progressPercent = progress.total > 0 ? Math.round((progress.checked / progress.total) * 100) : 0
  const alerts = getAlertCounts()

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Emergency Kit Checklist</h1>
        <p className="mt-1 text-muted-foreground">
          Track your emergency supplies and ensure your household is prepared.
        </p>
      </div>

      {/* Alert Summary */}
      {(alerts.overdue > 0 || alerts.warnings > 0) && (
        <div className="flex flex-wrap gap-3">
          {alerts.overdue > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2">
              <span className="material-icons text-red-500">error</span>
              <span className="text-sm font-medium text-red-700 dark:text-red-300">
                {alerts.overdue} item{alerts.overdue !== 1 ? 's' : ''} overdue for recheck
              </span>
            </div>
          )}
          {alerts.warnings > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-2">
              <span className="material-icons text-amber-500">warning</span>
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {alerts.warnings} item{alerts.warnings !== 1 ? 's' : ''} due for recheck soon
              </span>
            </div>
          )}
        </div>
      )}

      {/* Progress Overview */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <span className="material-icons text-2xl text-primary">inventory_2</span>
            </div>
            <div>
              <h2 className="font-semibold">Overall Progress</h2>
              <p className="text-sm text-muted-foreground">
                {progress.checked} of {progress.total} items collected
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold text-primary">{progressPercent}%</span>
          </div>
        </div>
        <div className="h-3 w-full rounded-full bg-muted">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Checklist Categories */}
      <div className="space-y-4">
        {checklist.map(category => {
          const categoryProgress = getCategoryProgress(category)
          const categoryAlerts = getCategoryAlertCounts(category)
          const isExpanded = expandedCategories.includes(category.id)
          const isComplete = categoryProgress.checked === categoryProgress.total

          return (
            <div
              key={category.id}
              className={`rounded-xl border bg-card transition-all ${
                categoryAlerts.overdue > 0
                  ? 'border-red-500/50'
                  : categoryAlerts.warnings > 0
                    ? 'border-amber-500/50'
                    : isComplete
                      ? 'border-green-500/50'
                      : 'border-border'
              }`}
            >
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="flex w-full items-center justify-between p-4"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      categoryAlerts.overdue > 0
                        ? 'bg-red-500/10'
                        : categoryAlerts.warnings > 0
                          ? 'bg-amber-500/10'
                          : isComplete
                            ? 'bg-green-500/10'
                            : 'bg-primary/10'
                    }`}
                  >
                    <span
                      className={`material-icons text-xl ${
                        categoryAlerts.overdue > 0
                          ? 'text-red-500'
                          : categoryAlerts.warnings > 0
                            ? 'text-amber-500'
                            : isComplete
                              ? 'text-green-500'
                              : 'text-primary'
                      }`}
                    >
                      {categoryAlerts.overdue > 0
                        ? 'error'
                        : categoryAlerts.warnings > 0
                          ? 'warning'
                          : isComplete
                            ? 'check_circle'
                            : category.icon}
                    </span>
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {categoryProgress.checked} of {categoryProgress.total} items
                      {(categoryAlerts.overdue > 0 || categoryAlerts.warnings > 0) && (
                        <span className="ml-2">
                          {categoryAlerts.overdue > 0 && (
                            <span className="text-red-500">({categoryAlerts.overdue} overdue)</span>
                          )}
                          {categoryAlerts.warnings > 0 && categoryAlerts.overdue === 0 && (
                            <span className="text-amber-500">({categoryAlerts.warnings} due soon)</span>
                          )}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <span className="material-icons text-muted-foreground">
                  {isExpanded ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {/* Category Items */}
              {isExpanded && (
                <div className="border-t border-border px-4 pb-4">
                  <div className="mt-3 space-y-2">
                    {category.items.map(item => {
                      const status = getItemStatus(item)
                      const daysUntil = getDaysUntilRecheck(item)

                      return (
                        <div
                          key={item.id}
                          className={`flex items-start gap-3 rounded-lg p-3 transition-colors ${
                            status === 'overdue'
                              ? 'bg-red-50 dark:bg-red-900/10'
                              : status === 'warning'
                                ? 'bg-amber-50 dark:bg-amber-900/10'
                                : item.checked
                                  ? 'bg-green-500/5'
                                  : 'hover:bg-muted'
                          }`}
                        >
                          <label className="flex cursor-pointer items-start gap-3 flex-1">
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={() => toggleItem(category.id, item.id)}
                              className="mt-0.5 h-5 w-5 rounded border-border text-primary focus:ring-primary"
                            />
                            <div className="flex-1">
                              <span
                                className={`text-sm ${
                                  !item.checked ? 'text-foreground' : 'text-foreground'
                                }`}
                              >
                                {item.name}
                              </span>
                              {item.description && (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {item.description}
                                </p>
                              )}
                              {item.checked && item.lastChecked && (
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                  <span className="text-muted-foreground">
                                    Checked: {formatDate(item.lastChecked)}
                                  </span>
                                  {daysUntil !== null && (
                                    <span className={`font-medium ${
                                      status === 'overdue'
                                        ? 'text-red-600 dark:text-red-400'
                                        : status === 'warning'
                                          ? 'text-amber-600 dark:text-amber-400'
                                          : 'text-green-600 dark:text-green-400'
                                    }`}>
                                      {status === 'overdue'
                                        ? `${Math.abs(daysUntil)} days overdue`
                                        : `Recheck in ${daysUntil} days`}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </label>
                          {item.checked && (
                            <div className="flex items-center gap-2">
                              {(status === 'overdue' || status === 'warning') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    recheckItem(category.id, item.id)
                                  }}
                                  className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                                    status === 'overdue'
                                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                                  }`}
                                >
                                  Mark Rechecked
                                </button>
                              )}
                              <span className={`material-icons text-lg ${
                                status === 'overdue'
                                  ? 'text-red-500'
                                  : status === 'warning'
                                    ? 'text-amber-500'
                                    : 'text-green-500'
                              }`}>
                                {status === 'overdue' ? 'error' : status === 'warning' ? 'warning' : 'check'}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Tips Section */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <span className="material-icons text-xl text-[#FEB100]">lightbulb</span>
          Tips for Your Emergency Kit
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="material-icons text-sm text-primary">arrow_right</span>
            Store your kit in an easily accessible location that all family members know about.
          </li>
          <li className="flex items-start gap-2">
            <span className="material-icons text-sm text-primary">arrow_right</span>
            Items will show amber warnings 2 weeks before recheck is due, and red alerts when overdue.
          </li>
          <li className="flex items-start gap-2">
            <span className="material-icons text-sm text-primary">arrow_right</span>
            Consider having a smaller &quot;grab bag&quot; ready for quick evacuation.
          </li>
          <li className="flex items-start gap-2">
            <span className="material-icons text-sm text-primary">arrow_right</span>
            Keep a basic kit in your car as well as at home.
          </li>
        </ul>
      </div>
    </div>
  )
}
