'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { guideTemplates, GuideTemplate } from '@/data/guide-templates'
import { GuideEditor } from '@/components/guides/guide-editor'
import type { Community, CommunityGuide, GuideSection, GuideEmergencyContact } from '@/types/database'

type ViewMode = 'list' | 'view' | 'edit' | 'create'

export default function CommunityGuidesPage() {
  const params = useParams()
  const communityId = params?.id as string
  const { user } = useAuth()

  const [community, setCommunity] = useState<Community | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Guides state
  const [guides, setGuides] = useState<CommunityGuide[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedGuide, setSelectedGuide] = useState<CommunityGuide | null>(null)
  const [activeTab, setActiveTab] = useState<'before' | 'during' | 'after' | 'supplies' | 'contacts'>('before')

  // Template selection for new guide
  const [showTemplates, setShowTemplates] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user || !communityId) return

    try {
      setIsLoading(true)

      // Fetch community details
      const { data: communityData, error: communityError } = await supabase
        .from('communities')
        .select('*')
        .eq('id', communityId)
        .single()

      if (communityError) throw communityError
      setCommunity(communityData)

      // Check membership and role
      const { data: membershipData, error: membershipError } = await supabase
        .from('community_members')
        .select('role')
        .eq('community_id', communityId)
        .eq('user_id', user.id)
        .single()

      if (membershipError) {
        setIsMember(false)
        setIsAdmin(false)
      } else {
        setIsMember(true)
        setIsAdmin(membershipData.role === 'admin' || membershipData.role === 'super_admin')
      }

      // Fetch guides - using type assertion since table may be newly created
      const { data: guidesData, error: guidesError } = await (supabase
        .from('community_guides' as 'profiles') // Type assertion for new table
        .select('*')
        .eq('community_id', communityId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false }) as unknown as Promise<{ data: CommunityGuide[] | null; error: Error | null }>)

      if (guidesError) {
        // Table might not exist yet, create empty array
        console.warn('Could not fetch guides:', guidesError)
        setGuides([])
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
      }
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load community data')
    } finally {
      setIsLoading(false)
    }
  }, [user, communityId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter guides for members (only active) or admins (all)
  const visibleGuides = isAdmin ? guides : guides.filter((g) => g.is_active)

  // Create new guide from template
  const createFromTemplate = async (template: GuideTemplate) => {
    if (!user) return

    const newGuide: Partial<CommunityGuide> = {
      community_id: communityId,
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
    if (!user) return

    const newGuide: Partial<CommunityGuide> = {
      community_id: communityId,
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
    if (!user) throw new Error('Not authenticated')

    const isNew = !guideData.id

    const dataToSave = {
      community_id: communityId,
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
        setSuccess('Guide created successfully!')
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
        setSuccess('Guide saved successfully!')
      }
    }

    setViewMode('list')
    setSelectedGuide(null)
    setTimeout(() => setSuccess(null), 3000)
  }

  // Delete guide
  const handleDeleteGuide = async (guideId: string) => {
    if (!confirm('Are you sure you want to delete this guide? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await (supabase
        .from('community_guides' as 'profiles')
        .delete()
        .eq('id', guideId) as unknown as Promise<{ error: Error | null }>)

      if (error) throw error

      setGuides((prev) => prev.filter((g) => g.id !== guideId))
      setSuccess('Guide deleted successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error deleting guide:', err)
      setError('Failed to delete guide')
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
      setError('Failed to update guide')
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="material-icons animate-spin text-4xl text-primary">sync</span>
      </div>
    )
  }

  if (!isMember) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center">
        <span className="material-icons text-6xl text-muted-foreground">lock</span>
        <h1 className="mt-4 text-2xl font-bold">Members Only</h1>
        <p className="mt-2 text-muted-foreground">
          Join this community to access response plans.
        </p>
        <Link
          href="/community"
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Back to Communities
        </Link>
      </div>
    )
  }

  // View/Edit mode
  if ((viewMode === 'edit' || viewMode === 'view') && selectedGuide) {
    if (viewMode === 'edit' && isAdmin) {
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

    // Member view mode
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setViewMode('list')
              setSelectedGuide(null)
            }}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <span className="material-icons">arrow_back</span>
            Back to Response Plans
          </button>
          {isAdmin && (
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

  // Template selection modal
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

  // List view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/community" className="hover:text-foreground">Communities</Link>
            <span className="material-icons text-sm">chevron_right</span>
            <Link href={`/community/${communityId}/manage`} className="hover:text-foreground">
              {community?.name}
            </Link>
            <span className="material-icons text-sm">chevron_right</span>
            <span>Response Plans</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Emergency Response Plans</h1>
          <p className="mt-1 text-muted-foreground">
            {isAdmin
              ? 'Create and manage emergency response plans for your community.'
              : 'Emergency response plans for your community.'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <span className="material-icons text-lg">add</span>
            Create Plan
          </button>
        )}
      </div>

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

      {/* Response Plan List */}
      {visibleGuides.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <span className="material-icons text-5xl text-muted-foreground">menu_book</span>
          <h2 className="mt-4 text-lg font-semibold">No Response Plans Available</h2>
          <p className="mt-2 text-muted-foreground">
            {isAdmin
              ? 'Create your first response plan to help your community prepare.'
              : 'No response plans have been published for this community yet.'}
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowTemplates(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <span className="material-icons text-lg">add</span>
              Create Plan
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleGuides.map((guide) => (
            <div
              key={guide.id}
              className={`rounded-xl border bg-card p-5 transition-all hover:shadow-md ${
                !guide.is_active && isAdmin ? 'border-amber-500/50 opacity-75' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: guide.color?.startsWith('#') ? guide.color : '#3b82f6' }}
                >
                  <span className="material-icons text-2xl text-white">{guide.icon}</span>
                </div>
                {isAdmin && (
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

              {!guide.is_active && isAdmin && (
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
                {isAdmin && (
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
      )}
    </div>
  )
}
