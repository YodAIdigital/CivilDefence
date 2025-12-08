'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import {
  type CommunityEmergencyContact,
  type DefaultEmergencyContact,
  type CommunityHiddenContact,
  type EmergencyContactCategory,
  EMERGENCY_CONTACT_CATEGORY_CONFIG,
  EMERGENCY_CONTACT_ICON_OPTIONS,
  SUGGESTED_COMMUNITY_CONTACTS,
} from '@/types/database'

// Type assertion helper for new tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

interface EmergencyContactsManagerProps {
  communityId: string
  isAdmin: boolean
}

interface ContactFormData {
  name: string
  phone: string
  description: string
  icon: string
  category: EmergencyContactCategory
}

const defaultFormData: ContactFormData = {
  name: '',
  phone: '',
  description: '',
  icon: 'call',
  category: 'local',
}

export function EmergencyContactsManager({ communityId, isAdmin }: EmergencyContactsManagerProps) {
  const { user } = useAuth()
  const [defaultContacts, setDefaultContacts] = useState<DefaultEmergencyContact[]>([])
  const [communityContacts, setCommunityContacts] = useState<CommunityEmergencyContact[]>([])
  const [hiddenContacts, setHiddenContacts] = useState<CommunityHiddenContact[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingContact, setEditingContact] = useState<CommunityEmergencyContact | null>(null)
  const [formData, setFormData] = useState<ContactFormData>(defaultFormData)
  const [activeTab, setActiveTab] = useState<'community' | 'defaults'>('community')

  // Fetch all contacts
  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch default contacts
      const { data: defaults, error: defaultsError } = await db
        .from('default_emergency_contacts')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('display_order')

      if (defaultsError) throw defaultsError

      // Fetch community contacts
      const { data: community, error: communityError } = await db
        .from('community_emergency_contacts')
        .select('*')
        .eq('community_id', communityId)
        .order('category')
        .order('display_order')

      if (communityError) throw communityError

      // Fetch hidden contacts
      const { data: hidden, error: hiddenError } = await db
        .from('community_hidden_contacts')
        .select('*')
        .eq('community_id', communityId)

      if (hiddenError) throw hiddenError

      setDefaultContacts((defaults || []) as DefaultEmergencyContact[])
      setCommunityContacts((community || []) as CommunityEmergencyContact[])
      setHiddenContacts((hidden || []) as CommunityHiddenContact[])
    } catch (err) {
      console.error('Error fetching contacts:', err)
      setError('Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }, [communityId])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  // Add or update community contact
  const handleSaveContact = async () => {
    if (!user || !formData.name || !formData.phone) return

    try {
      setSaving(true)
      setError(null)

      if (editingContact) {
        // Update existing
        const { error } = await db
          .from('community_emergency_contacts')
          .update({
            name: formData.name,
            phone: formData.phone,
            description: formData.description || null,
            icon: formData.icon,
            category: formData.category,
            updated_by: user.id,
          })
          .eq('id', editingContact.id)

        if (error) throw error
      } else {
        // Create new
        const maxOrder = communityContacts
          .filter(c => c.category === formData.category)
          .reduce((max, c) => Math.max(max, c.display_order), 0)

        const { error } = await db
          .from('community_emergency_contacts')
          .insert({
            community_id: communityId,
            name: formData.name,
            phone: formData.phone,
            description: formData.description || null,
            icon: formData.icon,
            category: formData.category,
            display_order: maxOrder + 1,
            created_by: user.id,
          })

        if (error) throw error
      }

      await fetchContacts()
      setShowAddForm(false)
      setEditingContact(null)
      setFormData(defaultFormData)
    } catch (err) {
      console.error('Error saving contact:', err)
      setError('Failed to save contact')
    } finally {
      setSaving(false)
    }
  }

  // Delete community contact
  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return

    try {
      setSaving(true)
      const { error } = await db
        .from('community_emergency_contacts')
        .delete()
        .eq('id', contactId)

      if (error) throw error
      await fetchContacts()
    } catch (err) {
      console.error('Error deleting contact:', err)
      setError('Failed to delete contact')
    } finally {
      setSaving(false)
    }
  }

  // Hide/unhide default contact
  const handleToggleHideDefault = async (defaultContact: DefaultEmergencyContact) => {
    if (!user || !defaultContact.allow_community_override) return

    try {
      setSaving(true)
      const isHidden = hiddenContacts.some(h => h.default_contact_id === defaultContact.id)

      if (isHidden) {
        // Unhide
        const { error } = await db
          .from('community_hidden_contacts')
          .delete()
          .eq('community_id', communityId)
          .eq('default_contact_id', defaultContact.id)

        if (error) throw error
      } else {
        // Hide
        const { error } = await db
          .from('community_hidden_contacts')
          .insert({
            community_id: communityId,
            default_contact_id: defaultContact.id,
            hidden_by: user.id,
          })

        if (error) throw error
      }

      await fetchContacts()
    } catch (err) {
      console.error('Error toggling hide:', err)
      setError('Failed to update contact visibility')
    } finally {
      setSaving(false)
    }
  }

  // Add suggested contact
  const handleAddSuggested = (suggested: typeof SUGGESTED_COMMUNITY_CONTACTS[number]) => {
    setFormData({
      name: suggested.name,
      phone: '',
      description: suggested.description,
      icon: suggested.icon,
      category: suggested.category,
    })
    setShowAddForm(true)
    setEditingContact(null)
  }

  // Edit contact
  const handleEditContact = (contact: CommunityEmergencyContact) => {
    setFormData({
      name: contact.name,
      phone: contact.phone,
      description: contact.description || '',
      icon: contact.icon,
      category: contact.category as EmergencyContactCategory,
    })
    setEditingContact(contact)
    setShowAddForm(true)
  }

  // Group contacts by category
  const groupedCommunityContacts = communityContacts.reduce<Record<string, CommunityEmergencyContact[]>>((acc, contact) => {
    const category = contact.category
    if (!acc[category]) acc[category] = []
    acc[category]!.push(contact)
    return acc
  }, {})

  const groupedDefaultContacts = defaultContacts.reduce<Record<string, DefaultEmergencyContact[]>>((acc, contact) => {
    const category = contact.category
    if (!acc[category]) acc[category] = []
    acc[category]!.push(contact)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Emergency Contacts</h2>
          <p className="text-sm text-muted-foreground">
            Manage emergency contacts for your community
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setShowAddForm(true)
              setEditingContact(null)
              setFormData(defaultFormData)
            }}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <span className="material-icons text-lg">add</span>
            Add Contact
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('community')}
            className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
              activeTab === 'community'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Community Contacts ({communityContacts.length})
          </button>
          <button
            onClick={() => setActiveTab('defaults')}
            className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
              activeTab === 'defaults'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Default Contacts ({defaultContacts.length - hiddenContacts.length} shown)
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <span className="material-icons text-primary">
              {editingContact ? 'edit' : 'person_add'}
            </span>
            {editingContact ? 'Edit Contact' : 'Add Community Contact'}
          </h3>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Timaru District Council"
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Phone Number *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="e.g., 03 687 7200"
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g., Council services and local information"
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as EmergencyContactCategory }))}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(EMERGENCY_CONTACT_CATEGORY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Icon</label>
              <select
                value={formData.icon}
                onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {EMERGENCY_CONTACT_ICON_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSaveContact}
              disabled={saving || !formData.name || !formData.phone}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <span className="material-icons text-lg">save</span>
              {saving ? 'Saving...' : 'Save Contact'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setEditingContact(null)
                setFormData(defaultFormData)
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Suggested Contacts */}
      {activeTab === 'community' && !showAddForm && isAdmin && communityContacts.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <span className="material-icons text-[#FEB100]">lightbulb</span>
            Suggested Contacts
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Click to add regional contacts for your community
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTED_COMMUNITY_CONTACTS.map((suggested) => (
              <button
                key={suggested.name}
                onClick={() => handleAddSuggested(suggested)}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:border-primary/50 hover:bg-primary/5"
              >
                <span className="material-icons text-lg text-muted-foreground">{suggested.icon}</span>
                {suggested.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Community Contacts Tab */}
      {activeTab === 'community' && (
        <div className="space-y-6">
          {Object.entries(groupedCommunityContacts).length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <span className="material-icons text-4xl text-muted-foreground">contact_phone</span>
              <p className="mt-2 text-muted-foreground">
                No community contacts added yet
              </p>
              {isAdmin && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="mt-4 text-sm text-primary hover:underline"
                >
                  Add your first contact
                </button>
              )}
            </div>
          ) : (
            Object.entries(EMERGENCY_CONTACT_CATEGORY_CONFIG).map(([categoryKey, categoryConfig]) => {
              const contacts = groupedCommunityContacts[categoryKey]
              if (!contacts || contacts.length === 0) return null

              return (
                <div key={categoryKey}>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <span className="material-icons text-lg" style={{ color: categoryConfig.color }}>
                      {categoryConfig.icon}
                    </span>
                    {categoryConfig.label}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {contacts.map(contact => (
                      <div
                        key={contact.id}
                        className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-lg"
                              style={{ backgroundColor: `${categoryConfig.color}15` }}
                            >
                              <span className="material-icons text-xl" style={{ color: categoryConfig.color }}>
                                {contact.icon}
                              </span>
                            </div>
                            <div>
                              <h4 className="font-semibold">{contact.name}</h4>
                              {contact.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {contact.description}
                                </p>
                              )}
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleEditContact(contact)}
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Edit"
                              >
                                <span className="material-icons text-lg">edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteContact(contact.id)}
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                                title="Delete"
                              >
                                <span className="material-icons text-lg">delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <a
                          href={`tel:${contact.phone.replace(/\s/g, '')}`}
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          <span className="material-icons text-lg">call</span>
                          {contact.phone}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Default Contacts Tab */}
      {activeTab === 'defaults' && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            These are the default emergency contacts shown to all communities.
            {isAdmin && ' You can hide contacts that are not relevant to your region.'}
          </p>

          {Object.entries(EMERGENCY_CONTACT_CATEGORY_CONFIG).map(([categoryKey, categoryConfig]) => {
            const contacts = groupedDefaultContacts[categoryKey]
            if (!contacts || contacts.length === 0) return null

            return (
              <div key={categoryKey}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <span className="material-icons text-lg" style={{ color: categoryConfig.color }}>
                    {categoryConfig.icon}
                  </span>
                  {categoryConfig.label}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {contacts.map(contact => {
                    const isHidden = hiddenContacts.some(h => h.default_contact_id === contact.id)

                    return (
                      <div
                        key={contact.id}
                        className={`rounded-xl border border-border bg-card p-4 transition-all ${
                          isHidden ? 'opacity-50' : 'hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-lg"
                              style={{ backgroundColor: `${categoryConfig.color}15` }}
                            >
                              <span className="material-icons text-xl" style={{ color: categoryConfig.color }}>
                                {contact.icon}
                              </span>
                            </div>
                            <div>
                              <h4 className="font-semibold">{contact.name}</h4>
                              {contact.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {contact.description}
                                </p>
                              )}
                            </div>
                          </div>
                          {isAdmin && contact.allow_community_override && (
                            <button
                              onClick={() => handleToggleHideDefault(contact)}
                              disabled={saving}
                              className={`rounded p-1 text-muted-foreground hover:bg-muted ${
                                isHidden ? 'hover:text-primary' : 'hover:text-destructive'
                              }`}
                              title={isHidden ? 'Show contact' : 'Hide contact'}
                            >
                              <span className="material-icons text-lg">
                                {isHidden ? 'visibility' : 'visibility_off'}
                              </span>
                            </button>
                          )}
                          {!contact.allow_community_override && (
                            <span
                              className="material-icons text-lg text-muted-foreground/50"
                              title="This contact cannot be hidden"
                            >
                              lock
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <a
                            href={`tel:${contact.phone.replace(/\s/g, '')}`}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium ${
                              isHidden
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-primary text-primary-foreground hover:bg-primary/90'
                            }`}
                          >
                            <span className="material-icons text-lg">call</span>
                            {contact.phone}
                          </a>
                        </div>
                        {isHidden && (
                          <p className="mt-2 text-center text-xs text-muted-foreground">
                            Hidden from community members
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
