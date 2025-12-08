'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Plus, Trash2, Edit2, Phone, Loader2, Sparkles } from 'lucide-react'
import type { WizardData } from '../onboarding-wizard'
import {
  EMERGENCY_CONTACT_CATEGORY_CONFIG,
  EMERGENCY_CONTACT_ICON_OPTIONS,
  SUGGESTED_COMMUNITY_CONTACTS,
  type EmergencyContactCategory,
} from '@/types/database'

interface StepContactsProps {
  data: WizardData
  updateData: (updates: Partial<WizardData>) => void
}

interface WizardContact {
  id: string
  name: string
  phone: string
  description: string
  icon: string
  category: EmergencyContactCategory
}

interface ResearchedContact {
  name: string
  phone: string
  description: string
  icon: string
  category: EmergencyContactCategory
  isImportant: boolean
}

const DEFAULT_FORM: Omit<WizardContact, 'id'> = {
  name: '',
  phone: '',
  description: '',
  icon: 'call',
  category: 'local',
}

export function StepContacts({ data, updateData }: StepContactsProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Omit<WizardContact, 'id'>>(DEFAULT_FORM)
  const [isResearching, setIsResearching] = useState(false)
  const [researchedContacts, setResearchedContacts] = useState<ResearchedContact[]>([])
  const [regionIdentified, setRegionIdentified] = useState<string | null>(null)
  const [researchError, setResearchError] = useState<string | null>(null)
  const hasAutoResearched = useRef(false)

  const contacts = data.emergencyContacts || []

  // Auto-research contacts when component mounts if we have location data
  useEffect(() => {
    if (!hasAutoResearched.current && data.location && contacts.length === 0) {
      hasAutoResearched.current = true
      handleResearchContacts()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleResearchContacts = async () => {
    if (!data.location) return

    setIsResearching(true)
    setResearchError(null)
    setResearchedContacts([])

    try {
      const response = await fetch('/api/research-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: data.location,
          regionMapImage: data.regionMapImage,
          aiAnalysis: data.aiAnalysis,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to research contacts')
      }

      const result = await response.json()
      setRegionIdentified(result.regionIdentified)
      setResearchedContacts(result.contacts || [])

      // Auto-add important contacts
      const importantContacts = (result.contacts || []).filter((c: ResearchedContact) => c.isImportant)
      if (importantContacts.length > 0) {
        const newContacts = importantContacts.map((c: ResearchedContact, index: number) => ({
          id: `ai-contact-${Date.now()}-${index}`,
          name: c.name,
          phone: c.phone,
          description: c.description,
          icon: c.icon,
          category: c.category,
        }))
        updateData({ emergencyContacts: newContacts })
      }
    } catch (err) {
      console.error('[StepContacts] Research error:', err)
      setResearchError('Failed to research local contacts. You can add them manually.')
    } finally {
      setIsResearching(false)
    }
  }

  const handleAddContact = () => {
    if (!formData.name.trim() || !formData.phone.trim()) return

    const newContacts = [...contacts]

    if (editingId) {
      // Update existing
      const index = newContacts.findIndex(c => c.id === editingId)
      if (index >= 0) {
        newContacts[index] = { ...formData, id: editingId }
      }
    } else {
      // Add new
      newContacts.push({
        ...formData,
        id: `wizard-contact-${Date.now()}`,
      })
    }

    updateData({ emergencyContacts: newContacts })
    setFormData(DEFAULT_FORM)
    setIsEditing(false)
    setEditingId(null)
  }

  const handleEditContact = (contact: WizardContact) => {
    setFormData({
      name: contact.name,
      phone: contact.phone,
      description: contact.description,
      icon: contact.icon,
      category: contact.category,
    })
    setEditingId(contact.id)
    setIsEditing(true)
  }

  const handleDeleteContact = (id: string) => {
    updateData({ emergencyContacts: contacts.filter(c => c.id !== id) })
  }

  const handleAddSuggested = (suggested: typeof SUGGESTED_COMMUNITY_CONTACTS[number]) => {
    // Check if already added
    if (contacts.some(c => c.name === suggested.name)) return

    setFormData({
      name: suggested.name,
      phone: '',
      description: suggested.description,
      icon: suggested.icon,
      category: suggested.category,
    })
    setIsEditing(true)
    setEditingId(null)
  }

  const handleAddResearched = (researched: ResearchedContact) => {
    // Check if already added
    if (contacts.some(c => c.name === researched.name)) return

    const newContact: WizardContact = {
      id: `researched-${Date.now()}`,
      name: researched.name,
      phone: researched.phone,
      description: researched.description,
      icon: researched.icon,
      category: researched.category,
    }
    updateData({ emergencyContacts: [...contacts, newContact] })
  }

  const handleCancel = () => {
    setFormData(DEFAULT_FORM)
    setIsEditing(false)
    setEditingId(null)
  }

  // Get researched contacts that haven't been added yet
  const availableResearchedContacts = researchedContacts.filter(
    r => !contacts.some(c => c.name === r.name)
  )

  // Group contacts by category for display
  const groupedContacts = contacts.reduce<Record<string, WizardContact[]>>((acc, contact) => {
    const category = contact.category
    if (!acc[category]) acc[category] = []
    acc[category]!.push(contact)
    return acc
  }, {})

  // Show loading screen while researching
  if (isResearching) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Researching Local Contacts</h3>
          <p className="text-muted-foreground text-sm">
            AI is finding emergency contacts for your region...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Regional Emergency Contacts</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Add local emergency contacts specific to your region (e.g., local council, power company, medical centres).
        </p>
      </div>

      {/* AI Research Results Banner */}
      {regionIdentified && (
        <Card className="p-3 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-700 dark:text-green-300">
              AI identified region: <strong>{regionIdentified}</strong>
              {contacts.length > 0 && ` - ${contacts.length} contacts added`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResearchContacts}
              className="ml-auto h-7 text-xs"
            >
              Re-research
            </Button>
          </div>
        </Card>
      )}

      {researchError && (
        <Card className="p-3 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <span className="text-sm text-amber-700 dark:text-amber-300">{researchError}</span>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column - AI Suggestions & Custom Form */}
        <div className="space-y-4">
          {/* AI Researched Contacts */}
          {availableResearchedContacts.length > 0 && !isEditing && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                AI-researched contacts for your area:
              </p>
              <div className="space-y-2">
                {availableResearchedContacts.map((researched, index) => {
                  const categoryConfig = EMERGENCY_CONTACT_CATEGORY_CONFIG[researched.category]
                  return (
                    <Card key={index} className="p-3 border-dashed hover:border-primary transition-colors">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${categoryConfig?.color || '#6b7280'}15` }}
                        >
                          <span
                            className="material-icons text-lg"
                            style={{ color: categoryConfig?.color || '#6b7280' }}
                          >
                            {researched.icon}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium text-sm">{researched.name}</h5>
                          <p className="text-xs text-muted-foreground">{researched.phone}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddResearched(researched)}
                          className="h-8 gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* Suggested Contacts */}
          {!isEditing && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Quick add common contacts:</p>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTED_COMMUNITY_CONTACTS.map((suggested, index) => {
                  const isAdded = contacts.some(c => c.name === suggested.name)
                  const categoryConfig = EMERGENCY_CONTACT_CATEGORY_CONFIG[suggested.category]
                  return (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddSuggested(suggested)}
                      disabled={isAdded}
                      className="justify-start h-auto py-2 text-left"
                    >
                      <span
                        className="material-icons text-sm mr-2 flex-shrink-0"
                        style={{ color: categoryConfig?.color || '#6b7280' }}
                      >
                        {suggested.icon}
                      </span>
                      <span className="text-xs font-medium truncate">
                        {isAdded ? '+ ' : ''}{suggested.name}
                      </span>
                    </Button>
                  )
                })}
              </div>

              <Button onClick={() => setIsEditing(true)} variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Custom Contact
              </Button>
            </div>
          )}

          {/* Contact Form */}
          {isEditing && (
            <Card className="p-4 border-2 border-primary">
              <h4 className="font-medium mb-4">
                {editingId ? 'Edit Contact' : 'Add Contact'}
              </h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name *</Label>
                  <Input
                    id="contactName"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Timaru District Council"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Phone Number *</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g., 03 687 7200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactDescription">Description</Label>
                  <Input
                    id="contactDescription"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this contact"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as EmergencyContactCategory })}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {Object.entries(EMERGENCY_CONTACT_CATEGORY_CONFIG).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Icon</Label>
                    <select
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {EMERGENCY_CONTACT_ICON_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={handleCancel} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddContact}
                    disabled={!formData.name.trim() || !formData.phone.trim()}
                    className="flex-1"
                  >
                    {editingId ? 'Update' : 'Add Contact'}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column - Added Contacts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Added Contacts ({contacts.length})</p>
          </div>

          {contacts.length > 0 ? (
            <div className="space-y-4">
              {Object.entries(EMERGENCY_CONTACT_CATEGORY_CONFIG).map(([categoryKey, categoryConfig]) => {
                const categoryContacts = groupedContacts[categoryKey]
                if (!categoryContacts || categoryContacts.length === 0) return null

                return (
                  <div key={categoryKey}>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <span className="material-icons text-sm" style={{ color: categoryConfig.color }}>
                        {categoryConfig.icon}
                      </span>
                      {categoryConfig.label}
                    </p>
                    <div className="space-y-2">
                      {categoryContacts.map((contact) => (
                        <Card key={contact.id} className="p-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${categoryConfig.color}15` }}
                            >
                              <span
                                className="material-icons text-lg"
                                style={{ color: categoryConfig.color }}
                              >
                                {contact.icon}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h5 className="font-medium text-sm">{contact.name}</h5>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {contact.phone}
                              </p>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditContact(contact)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteContact(contact.id)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Card className="p-6 text-center border-dashed">
              <Phone className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">
                No contacts yet. Add regional contacts for your community.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                (Optional - you can add these later)
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Info Box */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex gap-3">
          <span className="material-icons text-blue-500">info</span>
          <div className="text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              These contacts will be shown to all community members
            </p>
            <p className="text-blue-700 dark:text-blue-300 mt-1">
              Default NZ emergency numbers (111, Healthline, etc.) are automatically included.
              Add local contacts like your council, power company, or regional services here.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
