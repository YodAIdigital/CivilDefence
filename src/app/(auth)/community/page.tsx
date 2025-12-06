'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { useCommunity } from '@/contexts/community-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Community, UserRole } from '@/types/database'
import { Users, Plus, Search, Globe, Lock, Loader2, MapPin, LogOut, FileText, Trash2, AlertTriangle } from 'lucide-react'
import { OnboardingWizard, type WizardData } from '@/components/community/onboarding-wizard'

const WIZARD_STORAGE_KEY = 'civildefence_wizard_draft'

interface CommunityWithMembership extends Community {
  isMember: boolean
  memberRole: UserRole | undefined
}

export default function CommunityPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { refreshCommunities, setActiveCommunity } = useCommunity()
  const [communities, setCommunities] = useState<CommunityWithMembership[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [leavingId, setLeavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showCreateWizard, setShowCreateWizard] = useState(false)
  const [hasSavedDraft, setHasSavedDraft] = useState(false)

  // Check for saved wizard draft
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WIZARD_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Check if it has meaningful progress
        const hasProgress = parsed.data && (
          parsed.data.communityName?.trim() !== '' ||
          parsed.data.meetingPointName?.trim() !== '' ||
          parsed.data.meetingPointAddress?.trim() !== '' ||
          (parsed.data.selectedRisks && parsed.data.selectedRisks.length > 0) ||
          (parsed.data.regionPolygon && parsed.data.regionPolygon.length > 0) ||
          (parsed.data.groups && parsed.data.groups.length > 0)
        )
        setHasSavedDraft(hasProgress)
      }
    } catch (error) {
      console.error('Error checking for saved draft:', error)
    }
  }, [showCreateWizard]) // Re-check when wizard closes

  const fetchData = useCallback(async () => {
    if (!user) return

    try {
      setIsLoading(true)

      // Fetch all public communities and communities user is a member of
      const [communitiesResult, membershipsResult] = await Promise.all([
        supabase
          .from('communities')
          .select('*')
          .order('member_count', { ascending: false }),
        supabase
          .from('community_members')
          .select('*')
          .eq('user_id', user.id)
      ])

      if (communitiesResult.error) throw communitiesResult.error
      if (membershipsResult.error) throw membershipsResult.error

      const memberships = membershipsResult.data || []
      const membershipMap = new Map(memberships.map(m => [m.community_id, m]))

      const communitiesWithMembership: CommunityWithMembership[] = (communitiesResult.data || []).map(c => ({
        ...c,
        isMember: membershipMap.has(c.id),
        memberRole: membershipMap.get(c.id)?.role
      }))

      setCommunities(communitiesWithMembership)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load communities')
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const joinCommunity = async (communityId: string) => {
    if (!user) return

    try {
      setJoiningId(communityId)
      setError(null)

      const { error } = await supabase
        .from('community_members')
        .insert({
          community_id: communityId,
          user_id: user.id,
          role: 'member'
        })

      if (error) throw error

      await fetchData()
      setSuccess('Successfully joined community!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error joining community:', err)
      setError('Failed to join community')
    } finally {
      setJoiningId(null)
    }
  }

  const leaveCommunity = async (communityId: string) => {
    if (!user) return

    try {
      setLeavingId(communityId)
      setError(null)

      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', communityId)
        .eq('user_id', user.id)

      if (error) throw error

      await fetchData()
      setSuccess('Left community successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error leaving community:', err)
      setError('Failed to leave community')
    } finally {
      setLeavingId(null)
    }
  }

  const deleteCommunity = async (communityId: string) => {
    if (!user) return

    try {
      setDeletingId(communityId)
      setError(null)

      // Delete related data first (order matters due to foreign keys)
      // Delete community map points
      await supabase
        .from('community_map_points')
        .delete()
        .eq('community_id', communityId)

      // Delete community groups
      await supabase
        .from('community_groups')
        .delete()
        .eq('community_id', communityId)

      // Delete community guides
      await supabase
        .from('community_guides')
        .delete()
        .eq('community_id', communityId)

      // Delete community members
      await supabase
        .from('community_members')
        .delete()
        .eq('community_id', communityId)

      // Delete community events
      await supabase
        .from('community_events')
        .delete()
        .eq('community_id', communityId)

      // Delete invitations
      await supabase
        .from('community_invitations')
        .delete()
        .eq('community_id', communityId)

      // Delete alert rules (table not in typed schema yet)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('community_alert_rules')
        .delete()
        .eq('community_id', communityId)

      // Finally delete the community itself
      const { error } = await supabase
        .from('communities')
        .delete()
        .eq('id', communityId)
        .eq('created_by', user.id) // Ensure only creator can delete

      if (error) throw error

      await fetchData()
      setConfirmDeleteId(null)
      setSuccess('Community deleted successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error deleting community:', err)
      setError('Failed to delete community. Make sure you are the community creator.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleWizardComplete = async (wizardData: WizardData) => {
    if (!user) return

    try {
      setError(null)

      // Create community with all wizard data
      const { data: community, error: communityError } = await supabase
        .from('communities')
        .insert({
          name: wizardData.communityName,
          description: wizardData.description || null,
          location: wizardData.location || null,
          latitude: wizardData.meetingPointLat,
          longitude: wizardData.meetingPointLng,
          is_public: true,
          created_by: user.id,
          meeting_point_name: wizardData.meetingPointName,
          meeting_point_address: wizardData.meetingPointAddress,
          meeting_point_lat: wizardData.meetingPointLat,
          meeting_point_lng: wizardData.meetingPointLng,
          region_polygon: wizardData.regionPolygon,
          region_color: wizardData.regionColor,
          region_opacity: wizardData.regionOpacity,
        })
        .select()
        .single()

      if (communityError) throw communityError

      // Join as admin
      await supabase
        .from('community_members')
        .insert({
          community_id: community.id,
          user_id: user.id,
          role: 'admin'
        })

      // Create the meeting point as a map point so it shows on the dashboard map
      if (wizardData.meetingPointLat && wizardData.meetingPointLng) {
        await supabase.from('community_map_points').insert({
          community_id: community.id,
          name: wizardData.meetingPointName || 'Meeting Point',
          description: 'Community emergency meeting point',
          point_type: 'meeting_point',
          icon: 'location_on',
          color: '#22C55E',
          address: wizardData.meetingPointAddress || null,
          lat: wizardData.meetingPointLat,
          lng: wizardData.meetingPointLng,
          is_active: true,
          created_by: user.id,
        })
      }

      // Create groups if any
      if (wizardData.groups.length > 0) {
        const groupInserts = wizardData.groups.map(group => ({
          community_id: community.id,
          name: group.name,
          description: group.description,
          color: group.color,
          icon: group.icon,
          created_by: user.id,
        }))

        await supabase.from('community_groups').insert(groupInserts)
      }

      // Create disaster guides from selected risks
      if (wizardData.selectedRisks.length > 0) {
        // Import guide templates
        const { guideTemplates } = await import('@/data/guide-templates')

        type GuideSection = { id: string; title: string; content: string; icon?: string }
        const guideInserts: Array<{
          community_id: string
          name: string
          description: string
          icon: string
          color: string
          guide_type: string
          template_id: string
          sections: { before: GuideSection[]; during: GuideSection[]; after: GuideSection[] }
          supplies: string[]
          emergency_contacts: { name: string; number: string; description: string }[]
          custom_notes: string | null
          local_resources: string[] | null
          is_active: boolean
          display_order: number
          created_by: string
        }> = []

        wizardData.selectedRisks.forEach((riskType, index) => {
          const template = guideTemplates.find(t => t.type === riskType)
          if (!template) return

          // Get customization for this risk type if available
          const customization = wizardData.guideCustomizations?.[riskType]

          // Merge template sections with enhanced sections if customized
          let sections = template.sections
          if (customization?.enhancedSections) {
            sections = {
              before: [...template.sections.before, ...(customization.enhancedSections.before || [])],
              during: [...template.sections.during, ...(customization.enhancedSections.during || [])],
              after: [...template.sections.after, ...(customization.enhancedSections.after || [])],
            }
          }

          // Merge supplies
          const supplies = customization?.additionalSupplies
            ? [...template.supplies, ...customization.additionalSupplies]
            : template.supplies

          // Use customized emergency contacts if available, otherwise use template defaults
          const emergencyContacts = customization?.emergencyContacts?.length > 0
            ? customization.emergencyContacts
            : template.emergencyContacts

          guideInserts.push({
            community_id: community.id,
            name: template.name,
            description: template.description,
            icon: template.icon,
            color: template.color,
            guide_type: riskType,
            template_id: template.id,
            sections,
            supplies,
            emergency_contacts: emergencyContacts,
            custom_notes: customization?.customNotes || null,
            local_resources: customization?.localResources || null,
            is_active: true,
            display_order: index,
            created_by: user.id,
          })
        })

        if (guideInserts.length > 0) {
          await supabase.from('community_guides').insert(guideInserts)
        }

        // Also store AI analysis in community settings
        if (wizardData.aiAnalysis) {
          await supabase
            .from('communities')
            .update({
              settings: {
                ai_analysis: wizardData.aiAnalysis,
              }
            })
            .eq('id', community.id)
        }
      }

      // Send invitations if any were added
      if (wizardData.invitations && wizardData.invitations.length > 0) {
        const invitationPromises = wizardData.invitations.map(async (invitation) => {
          const token = crypto.randomUUID()
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

          // Create invitation record in database
          const { data: invitationRecord, error: invitationError } = await supabase
            .from('community_invitations')
            .insert({
              community_id: community.id,
              email: invitation.email,
              role: invitation.role,
              invited_by: user.id,
              token,
              status: 'pending',
              expires_at: expiresAt,
            })
            .select()
            .single()

          if (invitationError) {
            console.error('Error creating invitation:', invitationError)
            return null
          }

          // Send invitation email
          try {
            await fetch('/api/invite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                invitationId: invitationRecord.id,
                communityId: community.id,
                email: invitation.email,
                role: invitation.role,
                invitedBy: user.id,
                token,
              }),
            })
          } catch (emailError) {
            console.error('Error sending invitation email:', emailError)
          }

          return invitationRecord
        })

        await Promise.all(invitationPromises)
      }

      await fetchData()

      // Refresh the community context and set the new community as active
      await refreshCommunities()

      // Set the new community as active in context and localStorage
      // Use type assertion since we know the community object is valid
      const newCommunityWithRole = {
        ...community,
        member_count: 1,
        userRole: 'admin' as const,
      }
      setActiveCommunity(newCommunityWithRole as Parameters<typeof setActiveCommunity>[0])

      // Don't close the wizard or redirect - let the wizard show the promotion step
      // The wizard will call onCancel when the user clicks "Done" on the promo step
    } catch (err) {
      console.error('Error creating community:', err)
      setError('Failed to create community. Please try again.')
    }
  }

  const myCommunities = communities.filter(c => c.isMember)
  const discoverCommunities = communities.filter(c =>
    !c.isMember &&
    c.is_public &&
    (c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     c.location?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Communities</h1>
          <p className="text-muted-foreground">
            Join or create communities for local emergency coordination.
          </p>
        </div>
        <Button onClick={() => setShowCreateWizard(true)} className={hasSavedDraft ? 'relative' : ''}>
          {hasSavedDraft ? (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Resume Draft
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-orange-500 rounded-full animate-pulse" />
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Create Community
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* My Communities */}
      <Card>
        <CardHeader>
          <CardTitle>Your Communities</CardTitle>
          <CardDescription>
            Communities you are a member of
          </CardDescription>
        </CardHeader>
        <CardContent>
          {myCommunities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No communities yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Join a community to coordinate with your neighbors during emergencies.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myCommunities.map((community) => (
                <div key={community.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{community.name}</h3>
                      {community.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {community.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                    {community.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {community.location}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {community.member_count} members
                    </div>
                  </div>
                  {/* Delete confirmation inline */}
                  {confirmDeleteId === community.id && (
                    <div className="mt-4 p-3 rounded-lg border-2 border-destructive bg-destructive/5">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-destructive">Delete this community?</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            This will permanently delete all data including members, events, guides, and map points.
                          </p>
                          <div className="flex gap-2 mt-3">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteCommunity(community.id)}
                              disabled={deletingId === community.id}
                            >
                              {deletingId === community.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <Trash2 className="h-4 w-4 mr-1" />
                              )}
                              Yes, Delete
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={deletingId === community.id}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    {community.memberRole === 'admin' ? (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.location.href = `/community/${community.id}/manage`}
                        >
                          Manage
                        </Button>
                        {community.created_by === user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setConfirmDeleteId(community.id)}
                            disabled={deletingId === community.id || confirmDeleteId === community.id}
                            title="Delete community"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.location.href = `/community/${community.id}/contacts`}
                      >
                        View Contacts
                      </Button>
                    )}
                    {community.memberRole !== 'admin' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => leaveCommunity(community.id)}
                        disabled={leavingId === community.id}
                        title="Leave community"
                      >
                        {leavingId === community.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <LogOut className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discover Communities */}
      <Card>
        <CardHeader>
          <CardTitle>Discover Communities</CardTitle>
          <CardDescription>
            Find and join public communities in your area
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search communities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {discoverCommunities.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No communities found. Try a different search or create your own!
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {discoverCommunities.map((community) => (
                <div key={community.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{community.name}</h3>
                      {community.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {community.description}
                        </p>
                      )}
                    </div>
                    {community.is_public ? (
                      <Globe className="h-4 w-4 text-green-500" />
                    ) : (
                      <Lock className="h-4 w-4 text-orange-500" />
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                    {community.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {community.location}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {community.member_count} members
                    </div>
                  </div>
                  <Button
                    className="mt-4 w-full"
                    size="sm"
                    onClick={() => joinCommunity(community.id)}
                    disabled={joiningId === community.id}
                  >
                    {joiningId === community.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Join Community
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Onboarding Wizard */}
      {showCreateWizard && (
        <OnboardingWizard
          userId={user?.id || ''}
          onComplete={handleWizardComplete}
          onCancel={() => setShowCreateWizard(false)}
          onDone={() => {
            // Called when user finishes the promo step after community creation
            setShowCreateWizard(false)
            router.push('/dashboard')
          }}
        />
      )}
    </div>
  )
}
