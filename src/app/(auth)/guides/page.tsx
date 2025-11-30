'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { useCommunity } from '@/contexts/community-context'
import type { CommunityGuide, GuideSection, GuideEmergencyContact } from '@/types/database'

export default function GuidesPage() {
  const { user } = useAuth()
  const { activeCommunity } = useCommunity()

  const [guides, setGuides] = useState<CommunityGuide[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedGuide, setSelectedGuide] = useState<CommunityGuide | null>(null)
  const [activeTab, setActiveTab] = useState<'before' | 'during' | 'after' | 'supplies' | 'contacts'>('before')

  const fetchGuides = useCallback(async () => {
    if (!user || !activeCommunity) {
      setGuides([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)

      // Fetch only active guides for the active community
      const { data: guidesData, error: guidesError } = await (supabase
        .from('community_guides' as 'profiles')
        .select('*')
        .eq('community_id', activeCommunity.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false }) as unknown as Promise<{ data: CommunityGuide[] | null; error: Error | null }>)

      if (guidesError) {
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
      console.error('Error fetching guides:', err)
      setError('Failed to load response plans')
    } finally {
      setIsLoading(false)
    }
  }, [user, activeCommunity])

  useEffect(() => {
    fetchGuides()
  }, [fetchGuides])

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="material-icons animate-spin text-4xl text-primary">sync</span>
      </div>
    )
  }

  // If viewing a guide
  if (selectedGuide) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedGuide(null)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <span className="material-icons">arrow_back</span>
            Back to Response Plans
          </button>
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
        <div>
          <h1 className="text-2xl font-bold text-foreground">Emergency Response Plans</h1>
          <p className="mt-1 text-muted-foreground">
            View emergency response plans for {activeCommunity.name}.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <span className="material-icons text-5xl text-muted-foreground">menu_book</span>
          <h2 className="mt-4 text-lg font-semibold">No Response Plans Available</h2>
          <p className="mt-2 text-muted-foreground">
            No response plans have been published for {activeCommunity.name} yet.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Contact your community admin to add response plans.
          </p>
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Emergency Response Plans</h1>
        <p className="mt-1 text-muted-foreground">
          Emergency response plans for {activeCommunity.name}.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Response Plan Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {guides.map((guide) => (
          <div
            key={guide.id}
            className="rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md"
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: guide.color?.startsWith('#') ? guide.color : '#3b82f6' }}
            >
              <span className="material-icons text-2xl text-white">{guide.icon}</span>
            </div>

            <h3 className="mt-4 font-semibold">{guide.name}</h3>
            {guide.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {guide.description}
              </p>
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

            <button
              onClick={() => setSelectedGuide(guide)}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-background py-2 text-sm font-medium hover:bg-muted"
            >
              <span className="material-icons text-lg">visibility</span>
              View Plan
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
