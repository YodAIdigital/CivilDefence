'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase/client'
import {
  type DefaultEmergencyContact,
  type CommunityEmergencyContact,
  type UserEmergencyContact,
  type CommunityHiddenContact,
  type DisplayEmergencyContact,
  type EmergencyContactCategory,
  EMERGENCY_CONTACT_CATEGORY_CONFIG,
  EMERGENCY_CONTACT_ICON_OPTIONS,
  SUGGESTED_COMMUNITY_CONTACTS,
} from '@/types/database'

// Type assertion helper for new tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

type ContactFormMode = 'user' | 'community' | 'default'

interface ContactFormData {
  name: string
  phone: string
  description: string
  icon: string
  category: EmergencyContactCategory
}

const defaultUserFormData: ContactFormData = {
  name: '',
  phone: '',
  description: '',
  icon: 'person',
  category: 'personal',
}

const defaultCommunityFormData: ContactFormData = {
  name: '',
  phone: '',
  description: '',
  icon: 'call',
  category: 'local',
}

export default function ContactsPage() {
  const { user } = useAuth()
  const [defaultContacts, setDefaultContacts] = useState<DefaultEmergencyContact[]>([])
  const [communityContacts, setCommunityContacts] = useState<CommunityEmergencyContact[]>([])
  const [userContacts, setUserContacts] = useState<UserEmergencyContact[]>([])
  const [hiddenContacts, setHiddenContacts] = useState<CommunityHiddenContact[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formMode, setFormMode] = useState<ContactFormMode>('user')
  const [editingUserContact, setEditingUserContact] = useState<UserEmergencyContact | null>(null)
  const [editingCommunityContact, setEditingCommunityContact] = useState<CommunityEmergencyContact | null>(null)
  const [editingDefaultContact, setEditingDefaultContact] = useState<DefaultEmergencyContact | null>(null)
  const [formData, setFormData] = useState<ContactFormData>(defaultUserFormData)
  const [activeCommunityId, setActiveCommunityId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)

  // Fetch user's active community and admin status
  const fetchActiveCommunity = useCallback(async () => {
    if (!user) return { communityId: null, isAdmin: false }

    const { data } = await supabase
      .from('community_members')
      .select('community_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    const communityId = data?.community_id || null
    const adminStatus = data?.role === 'admin'

    setActiveCommunityId(communityId)
    setIsAdmin(adminStatus)

    return { communityId, isAdmin: adminStatus }
  }, [user])

  // Fetch all contacts
  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch default contacts
      const { data: defaults } = await db
        .from('default_emergency_contacts')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('display_order')

      setDefaultContacts((defaults || []) as DefaultEmergencyContact[])

      // Get active community
      const { communityId } = await fetchActiveCommunity()

      if (communityId) {
        // Fetch community contacts
        const { data: community } = await db
          .from('community_emergency_contacts')
          .select('*')
          .eq('community_id', communityId)
          .eq('is_active', true)
          .order('category')
          .order('display_order')

        setCommunityContacts((community || []) as CommunityEmergencyContact[])

        // Fetch hidden contacts
        const { data: hidden } = await db
          .from('community_hidden_contacts')
          .select('*')
          .eq('community_id', communityId)

        setHiddenContacts((hidden || []) as CommunityHiddenContact[])
      }

      // Fetch user contacts
      if (user) {
        const { data: userConts } = await db
          .from('user_emergency_contacts')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('category')
          .order('display_order')

        setUserContacts((userConts || []) as UserEmergencyContact[])
      }
    } catch (err) {
      console.error('Error fetching contacts:', err)
    } finally {
      setLoading(false)
    }
  }, [user, fetchActiveCommunity])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  // Merge and dedupe contacts for display
  const displayContacts = useMemo((): DisplayEmergencyContact[] => {
    const result: DisplayEmergencyContact[] = []
    const hiddenIds = new Set(hiddenContacts.map(h => h.default_contact_id))
    const overriddenIds = new Set(communityContacts.filter(c => c.overrides_default_id).map(c => c.overrides_default_id))

    // Add default contacts (not hidden, not overridden)
    for (const contact of defaultContacts) {
      if (!hiddenIds.has(contact.id) && !overriddenIds.has(contact.id)) {
        result.push({
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          description: contact.description,
          icon: contact.icon,
          category: contact.category as EmergencyContactCategory,
          display_order: contact.display_order,
          source: 'default',
          isEditable: false,
          isHideable: contact.allow_community_override,
        })
      }
    }

    // Add community contacts
    for (const contact of communityContacts) {
      const displayContact: DisplayEmergencyContact = {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        description: contact.description,
        icon: contact.icon,
        category: contact.category as EmergencyContactCategory,
        display_order: contact.display_order,
        source: 'community',
        isEditable: false,
        isHideable: false,
      }
      if (contact.overrides_default_id) {
        displayContact.overridesDefaultId = contact.overrides_default_id
      }
      result.push(displayContact)
    }

    // Add user contacts
    for (const contact of userContacts) {
      result.push({
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        description: contact.description,
        icon: contact.icon,
        category: contact.category as EmergencyContactCategory,
        display_order: contact.display_order,
        source: 'user',
        isEditable: true,
        isHideable: false,
      })
    }

    return result
  }, [defaultContacts, communityContacts, userContacts, hiddenContacts])

  // Group contacts by category
  const groupedContacts = useMemo(() => {
    return displayContacts.reduce<Record<string, DisplayEmergencyContact[]>>((acc, contact) => {
      const category = contact.category
      if (!acc[category]) acc[category] = []
      acc[category]!.push(contact)
      return acc
    }, {})
  }, [displayContacts])

  // Category order
  const categoryOrder = Object.entries(EMERGENCY_CONTACT_CATEGORY_CONFIG)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key]) => key)

  // Save user contact
  const handleSaveUserContact = async () => {
    if (!user || !formData.name || !formData.phone) return

    try {
      setSaving(true)

      if (editingUserContact) {
        // Update existing
        const { error } = await db
          .from('user_emergency_contacts')
          .update({
            name: formData.name,
            phone: formData.phone,
            description: formData.description || null,
            icon: formData.icon,
            category: formData.category,
          })
          .eq('id', editingUserContact.id)

        if (error) throw error
      } else {
        // Create new
        const maxOrder = userContacts
          .filter(c => c.category === formData.category)
          .reduce((max, c) => Math.max(max, c.display_order), 0)

        const { error } = await db
          .from('user_emergency_contacts')
          .insert({
            user_id: user.id,
            name: formData.name,
            phone: formData.phone,
            description: formData.description || null,
            icon: formData.icon,
            category: formData.category,
            display_order: maxOrder + 1,
          })

        if (error) throw error
      }

      await fetchContacts()
      setShowAddForm(false)
      setEditingUserContact(null)
      setFormData(defaultUserFormData)
    } catch (err) {
      console.error('Error saving contact:', err)
    } finally {
      setSaving(false)
    }
  }

  // Save community contact (admin only)
  const handleSaveCommunityContact = async () => {
    if (!user || !isAdmin || !activeCommunityId || !formData.name || !formData.phone) return

    try {
      setSaving(true)

      if (editingCommunityContact) {
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
          .eq('id', editingCommunityContact.id)

        if (error) throw error
      } else {
        // Create new
        const maxOrder = communityContacts
          .filter(c => c.category === formData.category)
          .reduce((max, c) => Math.max(max, c.display_order), 0)

        const { error } = await db
          .from('community_emergency_contacts')
          .insert({
            community_id: activeCommunityId,
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
      setEditingCommunityContact(null)
      setFormData(defaultCommunityFormData)
    } catch (err) {
      console.error('Error saving community contact:', err)
    } finally {
      setSaving(false)
    }
  }

  // Save default contact edit (admin only)
  const handleSaveDefaultContact = async () => {
    if (!user || !isAdmin || !editingDefaultContact || !formData.name || !formData.phone) return

    try {
      setSaving(true)

      const { error } = await db
        .from('default_emergency_contacts')
        .update({
          name: formData.name,
          phone: formData.phone,
          description: formData.description || null,
          icon: formData.icon,
          category: formData.category,
          updated_by: user.id,
        })
        .eq('id', editingDefaultContact.id)

      if (error) throw error

      await fetchContacts()
      setShowAddForm(false)
      setEditingDefaultContact(null)
      setFormData(defaultCommunityFormData)
    } catch (err) {
      console.error('Error saving default contact:', err)
    } finally {
      setSaving(false)
    }
  }

  // Handle save based on form mode
  const handleSaveContact = () => {
    if (formMode === 'default') {
      handleSaveDefaultContact()
    } else if (formMode === 'community') {
      handleSaveCommunityContact()
    } else {
      handleSaveUserContact()
    }
  }

  // Delete user contact
  const handleDeleteUserContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return

    try {
      setSaving(true)
      const { error } = await db
        .from('user_emergency_contacts')
        .delete()
        .eq('id', contactId)

      if (error) throw error
      await fetchContacts()
    } catch (err) {
      console.error('Error deleting contact:', err)
    } finally {
      setSaving(false)
    }
  }

  // Delete community contact (admin only)
  const handleDeleteCommunityContact = async (contactId: string) => {
    if (!isAdmin) return
    if (!confirm('Are you sure you want to delete this community contact?')) return

    try {
      setSaving(true)
      const { error } = await db
        .from('community_emergency_contacts')
        .delete()
        .eq('id', contactId)

      if (error) throw error
      await fetchContacts()
    } catch (err) {
      console.error('Error deleting community contact:', err)
    } finally {
      setSaving(false)
    }
  }

  // Edit user contact
  const handleEditUserContact = (contact: DisplayEmergencyContact) => {
    const userContact = userContacts.find(c => c.id === contact.id)
    if (!userContact) return

    setFormData({
      name: userContact.name,
      phone: userContact.phone,
      description: userContact.description || '',
      icon: userContact.icon,
      category: userContact.category as EmergencyContactCategory,
    })
    setEditingUserContact(userContact)
    setFormMode('user')
    setShowAddForm(true)
  }

  // Edit community contact (admin only)
  const handleEditCommunityContact = (contact: CommunityEmergencyContact) => {
    if (!isAdmin) return

    setFormData({
      name: contact.name,
      phone: contact.phone,
      description: contact.description || '',
      icon: contact.icon,
      category: contact.category as EmergencyContactCategory,
    })
    setEditingCommunityContact(contact)
    setFormMode('community')
    setShowAddForm(true)
  }

  // Edit default contact (admin only)
  const handleEditDefaultContact = (contact: DefaultEmergencyContact) => {
    if (!isAdmin) return

    setFormData({
      name: contact.name,
      phone: contact.phone,
      description: contact.description || '',
      icon: contact.icon,
      category: contact.category as EmergencyContactCategory,
    })
    setEditingDefaultContact(contact)
    setFormMode('default')
    setShowAddForm(true)
  }

  // Hide/unhide default contact (admin only)
  const handleToggleHideDefault = async (defaultContact: DefaultEmergencyContact) => {
    if (!user || !isAdmin || !activeCommunityId || !defaultContact.allow_community_override) return

    try {
      setSaving(true)
      const isHidden = hiddenContacts.some(h => h.default_contact_id === defaultContact.id)

      if (isHidden) {
        // Unhide
        const { error } = await db
          .from('community_hidden_contacts')
          .delete()
          .eq('community_id', activeCommunityId)
          .eq('default_contact_id', defaultContact.id)

        if (error) throw error
      } else {
        // Hide
        const { error } = await db
          .from('community_hidden_contacts')
          .insert({
            community_id: activeCommunityId,
            default_contact_id: defaultContact.id,
            hidden_by: user.id,
          })

        if (error) throw error
      }

      await fetchContacts()
    } catch (err) {
      console.error('Error toggling hide:', err)
    } finally {
      setSaving(false)
    }
  }

  // Add suggested community contact
  const handleAddSuggested = (suggested: typeof SUGGESTED_COMMUNITY_CONTACTS[number]) => {
    setFormData({
      name: suggested.name,
      phone: '',
      description: suggested.description,
      icon: suggested.icon,
      category: suggested.category,
    })
    setFormMode('community')
    setEditingCommunityContact(null)
    setShowAddForm(true)
  }

  // Source badge
  const getSourceBadge = (source: 'default' | 'community' | 'user') => {
    switch (source) {
      case 'default':
        return null // Don't show badge for defaults
      case 'community':
        return (
          <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Community
          </span>
        )
      case 'user':
        return (
          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            Personal
          </span>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Emergency Contacts</h1>
          <p className="mt-1 text-muted-foreground">
            Important phone numbers for emergencies and essential services.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowAdminPanel(!showAdminPanel)}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                showAdminPanel
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-foreground hover:bg-muted'
              }`}
            >
              <span className="material-icons text-lg">admin_panel_settings</span>
              Admin
            </button>
          )}
          <button
            onClick={() => {
              setShowAddForm(true)
              setFormMode('user')
              setEditingUserContact(null)
              setFormData(defaultUserFormData)
            }}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <span className="material-icons text-lg">add</span>
            Add Personal
          </button>
        </div>
      </div>

      {/* Admin Panel */}
      {isAdmin && showAdminPanel && (
        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="material-icons text-xl text-primary">admin_panel_settings</span>
              <h2 className="font-semibold text-lg">Community Admin Controls</h2>
            </div>
            <button
              onClick={() => {
                setShowAddForm(true)
                setFormMode('community')
                setEditingCommunityContact(null)
                setFormData(defaultCommunityFormData)
              }}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <span className="material-icons text-lg">add</span>
              Add Community Contact
            </button>
          </div>

          {/* Suggested Contacts */}
          {communityContacts.length === 0 && (
            <div className="mb-4 rounded-lg border border-border bg-card p-4">
              <h4 className="flex items-center gap-2 text-sm font-medium mb-2">
                <span className="material-icons text-[#FEB100]">lightbulb</span>
                Suggested Regional Contacts
              </h4>
              <div className="flex flex-wrap gap-2">
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

          {/* Community Contacts List */}
          {communityContacts.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                Community Contacts ({communityContacts.length})
              </h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {communityContacts.map(contact => {
                  const categoryConfig = EMERGENCY_CONTACT_CATEGORY_CONFIG[contact.category as keyof typeof EMERGENCY_CONTACT_CATEGORY_CONFIG]
                  return (
                    <div key={contact.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center gap-2">
                        <span className="material-icons text-lg" style={{ color: categoryConfig?.color || '#6b7280' }}>
                          {contact.icon}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{contact.name}</p>
                          <p className="text-xs text-muted-foreground">{contact.phone}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditCommunityContact(contact)}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Edit"
                        >
                          <span className="material-icons text-lg">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteCommunityContact(contact.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                          title="Delete"
                        >
                          <span className="material-icons text-lg">delete</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Default Contacts Management */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">
              Default Contacts ({defaultContacts.length - hiddenContacts.length} shown, {hiddenContacts.length} hidden)
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Edit contact details or hide contacts not relevant to your region.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {defaultContacts.map(contact => {
                const isHidden = hiddenContacts.some(h => h.default_contact_id === contact.id)
                const categoryConfig = EMERGENCY_CONTACT_CATEGORY_CONFIG[contact.category as keyof typeof EMERGENCY_CONTACT_CATEGORY_CONFIG]
                return (
                  <div
                    key={contact.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      isHidden ? 'border-border bg-muted/50 opacity-60' : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-icons text-lg" style={{ color: categoryConfig?.color || '#6b7280' }}>
                        {contact.icon}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{contact.name}</p>
                        <p className="text-xs text-muted-foreground">{contact.phone}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditDefaultContact(contact)}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Edit contact"
                      >
                        <span className="material-icons text-lg">edit</span>
                      </button>
                      {contact.allow_community_override && (
                        <button
                          onClick={() => handleToggleHideDefault(contact)}
                          disabled={saving}
                          className={`rounded p-1 ${
                            isHidden
                              ? 'text-muted-foreground hover:bg-muted hover:text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-destructive'
                          }`}
                          title={isHidden ? 'Show contact' : 'Hide contact'}
                        >
                          <span className="material-icons text-lg">
                            {isHidden ? 'visibility' : 'visibility_off'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Emergency Banner */}
      <div className="rounded-xl border-2 border-red-500/30 bg-red-50 p-4 dark:bg-red-900/10">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500">
            <span className="material-icons text-2xl text-white">emergency</span>
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-red-700 dark:text-red-400">
              For life-threatening emergencies, always call 111
            </h2>
            <p className="text-sm text-red-600 dark:text-red-300">
              Police, Fire, Ambulance - Available 24/7
            </p>
          </div>
          <a
            href="tel:111"
            className="flex items-center gap-2 rounded-lg bg-red-500 px-6 py-3 font-bold text-white hover:bg-red-600"
          >
            <span className="material-icons">call</span>
            111
          </a>
        </div>
      </div>

      {/* Add/Edit Contact Form */}
      {showAddForm && (
        <div className={`rounded-xl border p-5 ${
          formMode === 'community' || formMode === 'default'
            ? 'border-2 border-primary/30 bg-primary/5'
            : 'border-border bg-card'
        }`}>
          <h3 className="flex items-center gap-2 font-semibold">
            <span className="material-icons text-primary">
              {editingUserContact || editingCommunityContact || editingDefaultContact ? 'edit' : 'person_add'}
            </span>
            {formMode === 'default'
              ? 'Edit Default Contact'
              : formMode === 'community'
              ? (editingCommunityContact ? 'Edit Community Contact' : 'Add Community Contact')
              : (editingUserContact ? 'Edit Personal Contact' : 'Add Personal Contact')
            }
            {(formMode === 'community' || formMode === 'default') && (
              <span className="ml-2 rounded bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                Admin
              </span>
            )}
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={formMode === 'community' ? 'e.g., Timaru District Council' : 'e.g., Family Doctor'}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Phone Number *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="e.g., 09 123 4567"
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground">Description (optional)</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={formMode === 'community' ? 'e.g., Council services and local information' : 'e.g., Dr Smith at Medical Centre'}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Category</label>
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
              <label className="block text-sm font-medium text-foreground">Icon</label>
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
                setEditingUserContact(null)
                setEditingCommunityContact(null)
                setEditingDefaultContact(null)
                setFormData(formMode === 'community' || formMode === 'default' ? defaultCommunityFormData : defaultUserFormData)
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Contact Categories */}
      <div className="space-y-6">
        {categoryOrder.map(category => {
          const categoryContacts = groupedContacts[category]
          if (!categoryContacts || categoryContacts.length === 0) return null

          const categoryConfig = EMERGENCY_CONTACT_CATEGORY_CONFIG[category as keyof typeof EMERGENCY_CONTACT_CATEGORY_CONFIG]
          if (!categoryConfig) return null

          return (
            <div key={category}>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <span className="material-icons text-xl" style={{ color: categoryConfig.color }}>
                  {categoryConfig.icon}
                </span>
                {categoryConfig.label}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categoryContacts.map(contact => (
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
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{contact.name}</h3>
                            {getSourceBadge(contact.source)}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {contact.description}
                          </p>
                        </div>
                      </div>
                      {contact.isEditable && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditUserContact(contact)}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Edit"
                          >
                            <span className="material-icons text-lg">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteUserContact(contact.id)}
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
        })}
      </div>

      {/* Tips Section */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <span className="material-icons text-xl text-[#FEB100]">lightbulb</span>
          Emergency Contact Tips
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="material-icons text-sm text-primary">arrow_right</span>
            Save these numbers in your phone and keep a printed copy in your emergency kit.
          </li>
          <li className="flex items-start gap-2">
            <span className="material-icons text-sm text-primary">arrow_right</span>
            Set up &quot;ICE&quot; (In Case of Emergency) contacts in your phone.
          </li>
          <li className="flex items-start gap-2">
            <span className="material-icons text-sm text-primary">arrow_right</span>
            Teach children how to call 111 and give their address.
          </li>
          <li className="flex items-start gap-2">
            <span className="material-icons text-sm text-primary">arrow_right</span>
            Add your local council, doctor, and neighbours to your personal contacts.
          </li>
        </ul>
      </div>
    </div>
  )
}
