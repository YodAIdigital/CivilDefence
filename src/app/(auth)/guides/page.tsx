'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { useCommunity } from '@/contexts/community-context'
import { useOffline } from '@/hooks/useOffline'
import { getGuides, saveGuides } from '@/lib/offline/indexedDB'
import { guideTemplates, GuideTemplate } from '@/data/guide-templates'
import { GuideEditor } from '@/components/guides/guide-editor'
import type { CommunityGuide, GuideSection, GuideEmergencyContact } from '@/types/database'

type ViewMode = 'list' | 'view' | 'edit' | 'create'

export default function GuidesPage() {
  const { user } = useAuth()
  const { activeCommunity, canManageActiveCommunity } = useCommunity()
  const { isOffline } = useOffline()

  const [guides, setGuides] = useState<CommunityGuide[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedGuide, setSelectedGuide] = useState<CommunityGuide | null>(null)
  const [activeTab, setActiveTab] = useState<'before' | 'during' | 'after' | 'supplies' | 'contacts'>('before')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showTemplates, setShowTemplates] = useState(false)
  const [usingCachedData, setUsingCachedData] = useState(false)

  // Check if user can edit (admin or team_member)
  const canEdit = canManageActiveCommunity && !isOffline // Can't edit when offline

  const fetchGuides = useCallback(async () => {
    if (!user || !activeCommunity) {
      setGuides([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setUsingCachedData(false)

      // If offline, load from IndexedDB cache
      if (isOffline) {
        const cachedGuides = await getGuides(activeCommunity.id)
        if (cachedGuides.length > 0) {
          setGuides(cachedGuides)
          setUsingCachedData(true)
        } else {
          setError('No cached data available while offline')
        }
        setIsLoading(false)
        return
      }

      // Fetch guides - admins see all, members see only active
      const query = supabase
        .from('community_guides' as 'profiles')
        .select('*')
        .eq('community_id', activeCommunity.id)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false })

      // Only filter by is_active for non-admin users
      if (!canManageActiveCommunity) {
        (query as unknown as { eq: (col: string, val: boolean) => unknown }).eq('is_active', true)
      }

      const { data: guidesData, error: guidesError } = await (query as unknown as Promise<{ data: CommunityGuide[] | null; error: Error | null }>)

      if (guidesError) {
        console.warn('Could not fetch guides:', guidesError)
        // Try to load from cache on error
        const cachedGuides = await getGuides(activeCommunity.id)
        if (cachedGuides.length > 0) {
          setGuides(cachedGuides)
          setUsingCachedData(true)
        } else {
          setGuides([])
        }
      } else if (guidesData) {
        // Parse JSON fields if needed
        const parsedGuides = guidesData.map((g: CommunityGuide) => ({
          ...g,
          sections: typeof g.sections === 'string' ? JSON.parse(g.sections as unknown as string) : g.sections,
          supplies: typeof g.supplies === 'string' ? JSON.parse(g.supplies as unknown as string) : g.supplies,
          emergency_contacts: typeof g.emergency_contacts === 'string' ? JSON.parse(g.emergency_contacts as unknown as string) : g.emergency_contacts,
          local_resources: typeof g.local_resources === 'string' ? JSON.parse(g.local_resources as unknown as string) : g.local_resources,
        }))
        setGuides(parsedGuides)
        // Cache the guides for offline use
        try {
          await saveGuides(parsedGuides)
        } catch (cacheErr) {
          console.warn('Could not cache guides:', cacheErr)
        }
      }
    } catch (err) {
      console.error('Error fetching guides:', err)
      // Try to load from cache on error
      try {
        const cachedGuides = await getGuides(activeCommunity.id)
        if (cachedGuides.length > 0) {
          setGuides(cachedGuides)
          setUsingCachedData(true)
        } else {
          setError('Failed to load response plans')
        }
      } catch {
        setError('Failed to load response plans')
      }
    } finally {
      setIsLoading(false)
    }
  }, [user, activeCommunity, canManageActiveCommunity, isOffline])

  useEffect(() => {
    fetchGuides()
  }, [fetchGuides])

  // Create new guide from template
  const createFromTemplate = async (template: GuideTemplate) => {
    if (!user || !activeCommunity) return

    const newGuide: Partial<CommunityGuide> = {
      community_id: activeCommunity.id,
      name: template.name,
      description: template.description,
      icon: template.icon,
      color: template.color,
      guide_type: template.type,
      template_id: template.id,
      sections: template.sections,
      supplies: template.supplies,
      emergency_contacts: template.emergencyContacts,
      local_resources: [],
      is_active: false,
      display_order: guides.length,
      created_by: user.id,
    }

    setSelectedGuide(newGuide as CommunityGuide)
    setViewMode('edit')
    setShowTemplates(false)
  }

  // Create blank custom guide
  const createCustomGuide = () => {
    if (!user || !activeCommunity) return

    const newGuide: Partial<CommunityGuide> = {
      community_id: activeCommunity.id,
      name: '',
      description: '',
      icon: 'menu_book',
      color: '#3b82f6',
      guide_type: 'custom',
      sections: { before: [], during: [], after: [] },
      supplies: [],
      emergency_contacts: [],
      local_resources: [],
      is_active: false,
      display_order: guides.length,
      created_by: user.id,
    }

    setSelectedGuide(newGuide as CommunityGuide)
    setViewMode('edit')
    setShowTemplates(false)
  }

  // Save guide
  const handleSaveGuide = async (guideData: Partial<CommunityGuide>) => {
    if (!user || !activeCommunity) throw new Error('Not authenticated')

    const isNew = !guideData.id

    const dataToSave = {
      community_id: activeCommunity.id,
      name: guideData.name,
      description: guideData.description,
      icon: guideData.icon,
      color: guideData.color,
      guide_type: guideData.guide_type,
      template_id: guideData.template_id,
      sections: guideData.sections,
      supplies: guideData.supplies,
      emergency_contacts: guideData.emergency_contacts,
      custom_notes: guideData.custom_notes,
      local_resources: guideData.local_resources,
      is_active: guideData.is_active,
      display_order: guideData.display_order ?? guides.length,
      ...(isNew ? { created_by: user.id } : { updated_by: user.id }),
    }

    if (isNew) {
      const { data, error } = await (supabase
        .from('community_guides' as 'profiles')
        .insert(dataToSave as never)
        .select()
        .single() as unknown as Promise<{ data: CommunityGuide | null; error: Error | null }>)

      if (error) throw error
      if (data) {
        setGuides((prev) => [...prev, data])
        setSuccess('Response plan created successfully!')
      }
    } else {
      const { data, error } = await (supabase
        .from('community_guides' as 'profiles')
        .update(dataToSave as never)
        .eq('id', guideData.id as string)
        .select()
        .single() as unknown as Promise<{ data: CommunityGuide | null; error: Error | null }>)

      if (error) throw error
      if (data) {
        setGuides((prev) =>
          prev.map((g) => (g.id === guideData.id ? data : g))
        )
        setSuccess('Response plan saved successfully!')
      }
    }

    setViewMode('list')
    setSelectedGuide(null)
    setTimeout(() => setSuccess(null), 3000)
  }

  // Delete guide
  const handleDeleteGuide = async (guideId: string) => {
    if (!confirm('Are you sure you want to delete this response plan? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await (supabase
        .from('community_guides' as 'profiles')
        .delete()
        .eq('id', guideId) as unknown as Promise<{ error: Error | null }>)

      if (error) throw error

      setGuides((prev) => prev.filter((g) => g.id !== guideId))
      setSuccess('Response plan deleted successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error deleting guide:', err)
      setError('Failed to delete response plan')
    }
  }

  // Toggle guide active status
  const toggleGuideActive = async (guide: CommunityGuide) => {
    if (!user) return

    try {
      const { error } = await (supabase
        .from('community_guides' as 'profiles')
        .update({ is_active: !guide.is_active, updated_by: user.id } as never)
        .eq('id', guide.id) as unknown as Promise<{ error: Error | null }>)

      if (error) throw error

      setGuides((prev) =>
        prev.map((g) => (g.id === guide.id ? { ...g, is_active: !g.is_active } : g))
      )
    } catch (err) {
      console.error('Error toggling guide:', err)
      setError('Failed to update response plan')
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="material-icons animate-spin text-4xl text-primary">sync</span>
      </div>
    )
  }

  // Offline/cached data banner component
  const OfflineBanner = () => {
    if (!isOffline && !usingCachedData) return null
    return (
      <div className={`rounded-lg border px-4 py-3 mb-4 flex items-center gap-2 ${
        isOffline
          ? 'border-amber-500/30 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
          : 'border-blue-500/30 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
      }`}>
        <span className="material-icons text-lg">{isOffline ? 'cloud_off' : 'cached'}</span>
        <span className="text-sm">
          {isOffline
            ? 'You are offline. Showing cached data.'
            : 'Showing cached data due to connection issues.'}
        </span>
      </div>
    )
  }

  // Edit mode for admins
  if (viewMode === 'edit' && selectedGuide && canEdit) {
    return (
      <div className="h-[calc(100vh-12rem)]">
        <GuideEditor
          guide={selectedGuide}
          onSave={handleSaveGuide}
          onCancel={() => {
            setViewMode('list')
            setSelectedGuide(null)
          }}
          isNew={!selectedGuide.id}
        />
      </div>
    )
  }

  // If viewing a guide
  if (selectedGuide && viewMode === 'view') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setSelectedGuide(null)
              setViewMode('list')
            }}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <span className="material-icons">arrow_back</span>
            Back to Response Plans
          </button>
          {canEdit && (
            <button
              onClick={() => setViewMode('edit')}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <span className="material-icons text-lg">edit</span>
              Edit Plan
            </button>
          )}
        </div>

        {/* Guide Header */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-xl"
              style={{ backgroundColor: selectedGuide.color?.startsWith('#') ? selectedGuide.color : '#3b82f6' }}
            >
              <span className="material-icons text-3xl text-white">{selectedGuide.icon}</span>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{selectedGuide.name}</h1>
              {selectedGuide.description && (
                <p className="mt-1 text-muted-foreground">{selectedGuide.description}</p>
              )}
              {selectedGuide.custom_notes && (
                <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Community Note:</strong> {selectedGuide.custom_notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'before', label: 'Before', icon: 'event' },
            { id: 'during', label: 'During', icon: 'warning' },
            { id: 'after', label: 'After', icon: 'healing' },
            { id: 'supplies', label: 'Supplies', icon: 'inventory_2' },
            { id: 'contacts', label: 'Contacts', icon: 'contacts' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
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
        <div className="space-y-4">
          {(activeTab === 'before' || activeTab === 'during' || activeTab === 'after') && (
            <>
              {selectedGuide.sections[activeTab]?.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                  <span className="material-icons text-4xl text-muted-foreground">info</span>
                  <p className="mt-2 text-muted-foreground">No sections added for this phase yet.</p>
                </div>
              ) : (
                selectedGuide.sections[activeTab]?.map((section: GuideSection) => (
                  <div key={section.id} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-start gap-4">
                      {section.icon && (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                          <span className="material-icons text-2xl text-primary">{section.icon}</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{section.title}</h3>
                        <p className="mt-2 text-muted-foreground whitespace-pre-wrap">{section.content}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'supplies' && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <span className="material-icons text-primary">checklist</span>
                Emergency Supplies Checklist
              </h3>
              {selectedGuide.supplies?.length === 0 ? (
                <p className="text-muted-foreground">No supplies listed for this guide.</p>
              ) : (
                <ul className="space-y-2">
                  {selectedGuide.supplies?.map((supply, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="material-icons text-muted-foreground">check_box_outline_blank</span>
                      <span>{supply}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <span className="material-icons text-primary">emergency</span>
                  Emergency Contacts
                </h3>
                {selectedGuide.emergency_contacts?.length === 0 ? (
                  <p className="text-muted-foreground">No emergency contacts listed.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedGuide.emergency_contacts?.map((contact: GuideEmergencyContact, index: number) => (
                      <div key={index} className="flex items-center justify-between rounded-lg bg-muted p-4">
                        <div>
                          <p className="font-medium">{contact.name}</p>
                          <p className="text-sm text-muted-foreground">{contact.description}</p>
                        </div>
                        <a
                          href={`tel:${contact.number}`}
                          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          <span className="material-icons text-lg">call</span>
                          {contact.number}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Local Resources */}
              {selectedGuide.local_resources && selectedGuide.local_resources.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <span className="material-icons text-primary">place</span>
                    Local Resources
                  </h3>
                  <div className="space-y-3">
                    {selectedGuide.local_resources.map((resource) => (
                      <div key={resource.id} className="rounded-lg bg-muted p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{resource.name}</p>
                            <p className="text-sm text-muted-foreground capitalize">{resource.type.replace('_', ' ')}</p>
                            {resource.address && (
                              <p className="text-sm text-muted-foreground mt-1">{resource.address}</p>
                            )}
                            {resource.notes && (
                              <p className="text-sm text-muted-foreground mt-1">{resource.notes}</p>
                            )}
                          </div>
                          {resource.phone && (
                            <a
                              href={`tel:${resource.phone}`}
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <span className="material-icons text-lg">call</span>
                              {resource.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Template selection modal for creating new guide
  if (showTemplates) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Create New Response Plan</h1>
            <p className="mt-1 text-muted-foreground">
              Start from a template or create a custom response plan
            </p>
          </div>
          <button
            onClick={() => setShowTemplates(false)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Custom Guide Option */}
        <button
          onClick={createCustomGuide}
          className="w-full rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 p-6 text-left transition-colors hover:border-primary hover:bg-primary/10"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#000542]">
              <span className="material-icons text-2xl text-white">add</span>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Create Custom Plan</h3>
              <p className="text-sm text-muted-foreground">
                Start from scratch and create a fully customized response plan
              </p>
            </div>
          </div>
        </button>

        {/* Templates */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Or start from a template</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guideTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => createFromTemplate(template)}
                className="rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${template.color}`}>
                  <span className="material-icons text-2xl text-white">{template.icon}</span>
                </div>
                <h3 className="mt-4 font-semibold">{template.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="material-icons text-sm">article</span>
                    {template.sections.before.length + template.sections.during.length + template.sections.after.length} sections
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-icons text-sm">inventory_2</span>
                    {template.supplies.length} supplies
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // No community selected
  if (!activeCommunity) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Emergency Response Plans</h1>
          <p className="mt-1 text-muted-foreground">
            View emergency response plans for your community.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <span className="material-icons text-5xl text-muted-foreground">groups</span>
          <h2 className="mt-4 text-lg font-semibold">No Community Selected</h2>
          <p className="mt-2 text-muted-foreground">
            Join or select a community to view their emergency response plans.
          </p>
          <Link
            href="/community"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <span className="material-icons text-lg">groups</span>
            Browse Communities
          </Link>
        </div>
      </div>
    )
  }

  // No guides available
  if (guides.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Emergency Response Plans</h1>
            <p className="mt-1 text-muted-foreground">
              {canEdit
                ? `Create and manage emergency response plans for ${activeCommunity.name}.`
                : `View emergency response plans for ${activeCommunity.name}.`}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowTemplates(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <span className="material-icons text-lg">add</span>
              Create Plan
            </button>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <span className="material-icons text-5xl text-muted-foreground">menu_book</span>
          <h2 className="mt-4 text-lg font-semibold">No Response Plans Available</h2>
          <p className="mt-2 text-muted-foreground">
            {canEdit
              ? 'Create your first response plan to help your community prepare.'
              : `No response plans have been published for ${activeCommunity.name} yet.`}
          </p>
          {canEdit && (
            <button
              onClick={() => setShowTemplates(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <span className="material-icons text-lg">add</span>
              Create Plan
            </button>
          )}
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Emergency Response Plans</h1>
          <p className="mt-1 text-muted-foreground">
            {canEdit
              ? `Create and manage emergency response plans for ${activeCommunity.name}.`
              : `Emergency response plans for ${activeCommunity.name}.`}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <span className="material-icons text-lg">add</span>
            Create Plan
          </button>
        )}
      </div>

      <OfflineBanner />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-500/30 bg-green-50 p-4 text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Response Plan Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {guides.map((guide) => (
          <div
            key={guide.id}
            className={`rounded-xl border bg-card p-5 transition-all hover:shadow-md ${
              !guide.is_active && canEdit ? 'border-amber-500/50 opacity-75' : 'border-border'
            }`}
          >
            <div className="flex items-start justify-between">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: guide.color?.startsWith('#') ? guide.color : '#3b82f6' }}
              >
                <span className="material-icons text-2xl text-white">{guide.icon}</span>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleGuideActive(guide)}
                    className={`rounded-lg p-1.5 transition-colors ${
                      guide.is_active
                        ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                    title={guide.is_active ? 'Published' : 'Draft'}
                  >
                    <span className="material-icons text-xl">
                      {guide.is_active ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>
                  <button
                    onClick={() => handleDeleteGuide(guide.id)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Delete"
                  >
                    <span className="material-icons text-xl">delete</span>
                  </button>
                </div>
              )}
            </div>

            <h3 className="mt-4 font-semibold">{guide.name}</h3>
            {guide.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {guide.description}
              </p>
            )}

            {!guide.is_active && canEdit && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                <span className="material-icons text-xs">visibility_off</span>
                Draft
              </span>
            )}

            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="material-icons text-sm">article</span>
                {(guide.sections?.before?.length || 0) +
                  (guide.sections?.during?.length || 0) +
                  (guide.sections?.after?.length || 0)}{' '}
                sections
              </span>
              <span className="flex items-center gap-1">
                <span className="material-icons text-sm">inventory_2</span>
                {guide.supplies?.length || 0} supplies
              </span>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setSelectedGuide(guide)
                  setViewMode('view')
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border bg-background py-2 text-sm font-medium hover:bg-muted"
              >
                <span className="material-icons text-lg">visibility</span>
                View
              </button>
              {canEdit && (
                <button
                  onClick={() => {
                    setSelectedGuide(guide)
                    setViewMode('edit')
                  }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <span className="material-icons text-lg">edit</span>
                  Edit
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
