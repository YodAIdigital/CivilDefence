'use client'

import { useState, useEffect } from 'react'
import type {
  CommunityGuide,
  GuideSection,
  GuideEmergencyContact,
  GuideLocalResource,
  SOPTemplateTask,
  SOPTemplate,
} from '@/types/database'
import { IconPicker } from '@/components/ui/icon-picker'
import { ColorPicker } from '@/components/ui/color-picker'
import { SOPTemplateEditor } from '@/components/sop/sop-template-editor'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'

// Convert legacy Tailwind gradient classes to hex colors
function normalizeColor(color: string): string {
  // If it's already a hex color, return it
  if (color.startsWith('#')) {
    return color
  }

  // Map of gradient class patterns to solid hex colors
  const gradientToHex: Record<string, string> = {
    'from-orange-500 to-red-600': '#ea580c',      // Fire - orange
    'from-blue-500 to-cyan-600': '#0891b2',       // Flood - cyan
    'from-slate-500 to-gray-700': '#64748b',      // Strong winds - slate
    'from-amber-600 to-yellow-700': '#d97706',    // Earthquake - amber
    'from-blue-600 to-indigo-700': '#4f46e5',     // Tsunami - indigo
    'from-sky-400 to-blue-600': '#0ea5e9',        // Snow - sky blue
    'from-green-500 to-emerald-700': '#059669',   // Pandemic - emerald
    'from-yellow-500 to-orange-600': '#eab308',   // Solar storm - yellow
    'from-red-600 to-rose-800': '#dc2626',        // Invasion - red
    'from-red-500 to-orange-600': '#ef4444',      // Volcano - red-orange
    'from-gray-500 to-slate-700': '#475569',      // Tornado - gray-slate
    'from-orange-400 to-red-500': '#f97316',      // Heat wave - orange
  }

  // Check if the color matches a known gradient
  const hex = gradientToHex[color]
  if (hex) {
    return hex
  }

  // Default fallback
  return '#3b82f6'
}

interface GuideEditorProps {
  guide: Partial<CommunityGuide>
  onSave: (guide: Partial<CommunityGuide>) => Promise<CommunityGuide | void>
  onCancel: () => void
  isNew?: boolean
  communityId?: string
}

type TabType = 'details' | 'before' | 'during' | 'after' | 'supplies' | 'contacts' | 'resources' | 'sop'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function GuideEditor({ guide, onSave, onCancel, isNew = false, communityId }: GuideEditorProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('details')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState(guide.name || '')
  const [description, setDescription] = useState(guide.description || '')
  const [icon, setIcon] = useState(guide.icon || 'menu_book')
  const [color, setColor] = useState(normalizeColor(guide.color || '#3b82f6'))
  const [isActive, setIsActive] = useState(guide.is_active ?? false)
  const [customNotes, setCustomNotes] = useState(guide.custom_notes || '')

  // Picker states
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [sectionIconPicker, setSectionIconPicker] = useState<{
    phase: 'before' | 'during' | 'after'
    index: number
  } | null>(null)

  // Content state
  const [sections, setSections] = useState<CommunityGuide['sections']>(
    guide.sections || { before: [], during: [], after: [] }
  )
  const [supplies, setSupplies] = useState<string[]>(guide.supplies || [])
  const [contacts, setContacts] = useState<GuideEmergencyContact[]>(guide.emergency_contacts || [])
  const [resources, setResources] = useState<GuideLocalResource[]>(
    (guide.local_resources as GuideLocalResource[]) || []
  )

  // SOP state
  const [sopTemplate, setSopTemplate] = useState<SOPTemplate | null>(null)
  const [sopTasks, setSopTasks] = useState<SOPTemplateTask[]>([])
  const [isLoadingSop, setIsLoadingSop] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sopError, _setSopError] = useState<string | null>(null)
  const [sopTeamMembers, setSopTeamMembers] = useState<Array<{
    id: string
    full_name: string | null
    email: string
    role: 'admin' | 'team_member'
  }>>([])

  // Fetch team members for SOP assignment dropdown
  useEffect(() => {
    const fetchTeamMembers = async () => {
      const targetCommunityId = communityId || guide.community_id
      if (!targetCommunityId) return

      try {
        const { data, error } = await supabase
          .from('community_members')
          .select('user_id, role, profiles:profiles(id, full_name, email)')
          .eq('community_id', targetCommunityId)
          .in('role', ['admin', 'team_member'])

        if (error) {
          console.error('Error fetching team members:', error)
          return
        }

        const members = (data || [])
          .map((m) => {
            const profile = m.profiles as unknown as { id: string; full_name: string | null; email: string } | null
            if (!profile) return null
            return {
              id: profile.id,
              full_name: profile.full_name,
              email: profile.email,
              role: m.role as 'admin' | 'team_member',
            }
          })
          .filter(Boolean) as Array<{
            id: string
            full_name: string | null
            email: string
            role: 'admin' | 'team_member'
          }>

        setSopTeamMembers(members)
      } catch (err) {
        console.error('Error fetching team members:', err)
      }
    }

    fetchTeamMembers()
  }, [communityId, guide.community_id])

  // Load existing SOP template when guide has an ID
  useEffect(() => {
    const loadSopTemplate = async () => {
      if (!guide.id) return

      setIsLoadingSop(true)
      try {
        // Use type assertion for new table that doesn't exist in generated types yet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('sop_templates')
          .select('*')
          .eq('guide_id', guide.id)
          .single() as { data: SOPTemplate | null; error: { code: string; message: string } | null }

        if (error && error.code !== 'PGRST116') {
          // PGRST116 = no rows returned (which is fine)
          console.error('Error loading SOP template:', error)
        } else if (data) {
          setSopTemplate(data)
          setSopTasks((data.tasks as SOPTemplateTask[]) || [])
        }
      } catch (err) {
        console.error('Error loading SOP template:', err)
      } finally {
        setIsLoadingSop(false)
      }
    }

    loadSopTemplate()
  }, [guide.id])

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'details', label: 'Details', icon: 'info' },
    { id: 'before', label: 'Before', icon: 'event' },
    { id: 'during', label: 'During', icon: 'warning' },
    { id: 'after', label: 'After', icon: 'healing' },
    { id: 'supplies', label: 'Supplies', icon: 'inventory_2' },
    { id: 'contacts', label: 'Contacts', icon: 'contacts' },
    { id: 'resources', label: 'Local Resources', icon: 'place' },
    { id: 'sop', label: 'Team SOP', icon: 'checklist' },
  ]

  // Section handlers
  const addSection = (phase: 'before' | 'during' | 'after') => {
    const newSection: GuideSection = {
      id: generateId(),
      title: '',
      content: '',
      icon: 'info',
    }
    setSections((prev) => ({
      ...prev,
      [phase]: [...prev[phase], newSection],
    }))
  }

  const updateSection = (
    phase: 'before' | 'during' | 'after',
    index: number,
    field: keyof GuideSection,
    value: string
  ) => {
    setSections((prev) => ({
      ...prev,
      [phase]: prev[phase].map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }))
  }

  const removeSection = (phase: 'before' | 'during' | 'after', index: number) => {
    setSections((prev) => ({
      ...prev,
      [phase]: prev[phase].filter((_, i) => i !== index),
    }))
  }

  const moveSection = (phase: 'before' | 'during' | 'after', index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= sections[phase].length) return

    setSections((prev) => {
      const arr = [...prev[phase]]
      const tempItem = arr[index]
      const swapItem = arr[newIndex]
      if (tempItem && swapItem) {
        arr[index] = swapItem
        arr[newIndex] = tempItem
      }
      return { ...prev, [phase]: arr }
    })
  }

  // Supply handlers
  const addSupply = () => {
    setSupplies((prev) => [...prev, ''])
  }

  const updateSupply = (index: number, value: string) => {
    setSupplies((prev) => prev.map((s, i) => (i === index ? value : s)))
  }

  const removeSupply = (index: number) => {
    setSupplies((prev) => prev.filter((_, i) => i !== index))
  }

  // Contact handlers
  const addContact = () => {
    setContacts((prev) => [...prev, { name: '', number: '', description: '' }])
  }

  const updateContact = (index: number, field: keyof GuideEmergencyContact, value: string) => {
    setContacts((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)))
  }

  const removeContact = (index: number) => {
    setContacts((prev) => prev.filter((_, i) => i !== index))
  }

  // Resource handlers
  const addResource = () => {
    setResources((prev) => [
      ...prev,
      { id: generateId(), name: '', type: 'other' as const, notes: '' },
    ])
  }

  const updateResource = (index: number, field: keyof GuideLocalResource, value: string) => {
    setResources((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    )
  }

  const removeResource = (index: number) => {
    setResources((prev) => prev.filter((_, i) => i !== index))
  }

  // SOP handlers
  const handleSopTasksChange = (tasks: SOPTemplateTask[]) => {
    setSopTasks(tasks)
  }

  const saveSopTemplate = async (guideId: string, userId: string) => {
    // If no tasks, delete existing template
    if (sopTasks.length === 0) {
      if (sopTemplate) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('sop_templates')
          .delete()
          .eq('id', sopTemplate.id)
      }
      return
    }

    const templateData = {
      community_id: communityId || guide.community_id,
      guide_id: guideId,
      name: `${name} - Team SOP`,
      description: `Standard Operating Procedure for ${name}`,
      tasks: sopTasks,
      is_active: true,
    }

    if (sopTemplate) {
      // Update existing template
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('sop_templates')
        .update({
          ...templateData,
          updated_by: userId,
        })
        .eq('id', sopTemplate.id)
    } else {
      // Create new template
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('sop_templates')
        .insert({
          ...templateData,
          created_by: userId,
        })
    }
  }

  // Save handler
  const handleSave = async () => {
    if (!name.trim()) {
      setError('Guide name is required')
      setActiveTab('details')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const savedGuide = await onSave({
        ...guide,
        name: name.trim(),
        description: description.trim() || null,
        guide_type: guide.guide_type || 'custom',
        icon,
        color,
        is_active: isActive,
        custom_notes: customNotes.trim() || null,
        sections,
        supplies: supplies.filter((s) => s.trim()),
        emergency_contacts: contacts.filter((c) => c.name.trim() || c.number.trim()),
        local_resources: resources.filter((r) => r.name.trim()),
      })

      // Save SOP template if we have tasks
      const guideId = savedGuide?.id || guide.id
      if (guideId && user && sopTasks.length > 0) {
        try {
          await saveSopTemplate(guideId, user.id)
        } catch (sopErr) {
          console.error('Error saving SOP template:', sopErr)
          // Don't fail the whole save for SOP errors
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save response plan')
    } finally {
      setIsSaving(false)
    }
  }

  const renderSectionEditor = (phase: 'before' | 'during' | 'after') => {
    const phaseSections = sections[phase]
    const phaseLabels = {
      before: 'Before the Emergency',
      during: 'During the Emergency',
      after: 'After the Emergency',
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{phaseLabels[phase]}</h3>
          <button
            type="button"
            onClick={() => addSection(phase)}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <span className="material-icons text-lg">add</span>
            Add Section
          </button>
        </div>

        {phaseSections.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center bg-muted/50 rounded-lg">
            No sections added yet. Click &quot;Add Section&quot; to get started.
          </p>
        ) : (
          <div className="space-y-4">
            {phaseSections.map((section, index) => (
              <div key={section.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    Section {index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveSection(phase, index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <span className="material-icons text-lg">arrow_upward</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(phase, index, 'down')}
                      disabled={index === phaseSections.length - 1}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <span className="material-icons text-lg">arrow_downward</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSection(phase, index)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <span className="material-icons text-lg">delete</span>
                    </button>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div>
                      <label className="block text-sm font-medium mb-1">Title *</label>
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => updateSection(phase, index, 'title', e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        placeholder="e.g., Evacuate Immediately"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Icon</label>
                      <button
                        type="button"
                        onClick={() => setSectionIconPicker({ phase, index })}
                        className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-muted transition-colors"
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded bg-muted">
                          <span className="material-icons text-base">{section.icon || 'info'}</span>
                        </div>
                        <span className="material-icons text-muted-foreground text-base">edit</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Content *</label>
                    <textarea
                      value={section.content}
                      onChange={(e) => updateSection(phase, index, 'content', e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      placeholder="Detailed instructions for this step..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#000542]">
            <span className="material-icons text-2xl text-white">{icon}</span>
          </div>
          <div>
            <h2 className="text-lg font-bold">{isNew ? 'Create New Response Plan' : 'Edit Response Plan'}</h2>
            <p className="text-sm text-muted-foreground">
              {name || 'Untitled Plan'}
            </p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <span className="material-icons">close</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            <span className="material-icons text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-5 w-5 rounded border-border text-primary"
              />
              <label htmlFor="isActive" className="flex-1">
                <span className="font-medium">{isActive ? 'Active' : 'Draft'}</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-background border border-border hover:bg-muted transition-colors"
                  title="Change icon"
                >
                  <span className="material-icons">{icon}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowColorPicker(true)}
                  className="h-10 w-10 rounded-lg flex-shrink-0 border border-border hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: color }}
                  title="Change color"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Plan Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                placeholder="e.g., Earthquake Response Plan"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                placeholder="Brief description of this response plan..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Community Notes</label>
              <textarea
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                placeholder="Add community-specific notes, local hazards, or special considerations..."
              />
            </div>
          </div>
        )}

        {/* Before/During/After Tabs */}
        {activeTab === 'before' && renderSectionEditor('before')}
        {activeTab === 'during' && renderSectionEditor('during')}
        {activeTab === 'after' && renderSectionEditor('after')}

        {/* Supplies Tab */}
        {activeTab === 'supplies' && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Emergency Supplies Checklist</h3>
              <button
                type="button"
                onClick={addSupply}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <span className="material-icons text-lg">add</span>
                Add Item
              </button>
            </div>

            {supplies.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center bg-muted/50 rounded-lg">
                No supplies added yet. Click &quot;Add Item&quot; to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {supplies.map((supply, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="material-icons text-muted-foreground">inventory_2</span>
                    <input
                      type="text"
                      value={supply}
                      onChange={(e) => updateSupply(index, e.target.value)}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      placeholder="e.g., First aid kit"
                    />
                    <button
                      type="button"
                      onClick={() => removeSupply(index)}
                      className="p-2 text-muted-foreground hover:text-destructive"
                    >
                      <span className="material-icons text-lg">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contacts Tab */}
        {activeTab === 'contacts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Emergency Contacts</h3>
              <button
                type="button"
                onClick={addContact}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <span className="material-icons text-lg">add</span>
                Add Contact
              </button>
            </div>

            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center bg-muted/50 rounded-lg">
                No contacts added yet. Click &quot;Add Contact&quot; to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact, index) => (
                  <div key={index} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        Contact {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeContact(index)}
                        className="p-1 text-muted-foreground hover:text-destructive"
                      >
                        <span className="material-icons text-lg">delete</span>
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input
                          type="text"
                          value={contact.name}
                          onChange={(e) => updateContact(index, 'name', e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          placeholder="e.g., Local Fire Station"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Phone Number</label>
                        <input
                          type="text"
                          value={contact.number}
                          onChange={(e) => updateContact(index, 'number', e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          placeholder="e.g., 111 or 0800 xxx xxx"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <input
                          type="text"
                          value={contact.description}
                          onChange={(e) => updateContact(index, 'description', e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          placeholder="e.g., Emergency services"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Local Resources Tab */}
        {activeTab === 'resources' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Local Resources</h3>
              <button
                type="button"
                onClick={addResource}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <span className="material-icons text-lg">add</span>
                Add Resource
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              Add local shelters, meeting points, supply depots, or other resources specific to your community.
            </p>

            {resources.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center bg-muted/50 rounded-lg">
                No local resources added yet.
              </p>
            ) : (
              <div className="space-y-3">
                {resources.map((resource, index) => (
                  <div key={resource.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        Resource {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeResource(index)}
                        className="p-1 text-muted-foreground hover:text-destructive"
                      >
                        <span className="material-icons text-lg">delete</span>
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input
                          type="text"
                          value={resource.name}
                          onChange={(e) => updateResource(index, 'name', e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          placeholder="e.g., Community Hall"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Type</label>
                        <select
                          value={resource.type}
                          onChange={(e) => updateResource(index, 'type', e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        >
                          <option value="shelter">Emergency Shelter</option>
                          <option value="meeting_point">Meeting Point</option>
                          <option value="supply_depot">Supply Depot</option>
                          <option value="medical">Medical Facility</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Address</label>
                        <input
                          type="text"
                          value={resource.address || ''}
                          onChange={(e) => updateResource(index, 'address', e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          placeholder="Full address"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Phone</label>
                        <input
                          type="text"
                          value={resource.phone || ''}
                          onChange={(e) => updateResource(index, 'phone', e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          placeholder="Contact number"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium mb-1">Notes</label>
                        <input
                          type="text"
                          value={resource.notes || ''}
                          onChange={(e) => updateResource(index, 'notes', e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          placeholder="Opening hours, capacity, etc."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SOP Tab */}
        {activeTab === 'sop' && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            {isLoadingSop ? (
              <div className="flex items-center justify-center py-8">
                <span className="material-icons animate-spin text-2xl text-primary">sync</span>
                <span className="ml-2 text-muted-foreground">Loading SOP template...</span>
              </div>
            ) : (
              <>
                {sopError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive mb-4">
                    {sopError}
                  </div>
                )}

                <SOPTemplateEditor
                  tasks={sopTasks}
                  onChange={handleSopTasksChange}
                  readOnly={false}
                  teamMembers={sopTeamMembers}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-border pt-4 mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <span className="material-icons animate-spin text-lg">sync</span>
              Saving...
            </>
          ) : (
            <>
              <span className="material-icons text-lg">save</span>
              {isNew ? 'Create Plan' : 'Save Changes'}
            </>
          )}
        </button>
      </div>

      {/* Icon Picker Modal */}
      {showIconPicker && (
        <IconPicker
          value={icon}
          onChange={(newIcon) => setIcon(newIcon)}
          onClose={() => setShowIconPicker(false)}
        />
      )}

      {/* Color Picker Modal */}
      {showColorPicker && (
        <ColorPicker
          value={color}
          onChange={(newColor) => setColor(newColor)}
          onClose={() => setShowColorPicker(false)}
        />
      )}

      {/* Section Icon Picker Modal */}
      {sectionIconPicker && (
        <IconPicker
          value={sections[sectionIconPicker.phase][sectionIconPicker.index]?.icon || 'info'}
          onChange={(newIcon) => {
            updateSection(sectionIconPicker.phase, sectionIconPicker.index, 'icon', newIcon)
            setSectionIconPicker(null)
          }}
          onClose={() => setSectionIconPicker(null)}
        />
      )}
    </div>
  )
}
