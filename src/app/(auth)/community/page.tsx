'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Community, UserRole } from '@/types/database'
import { Users, Plus, Search, Globe, Lock, Loader2, MapPin, LogOut, Crown, X } from 'lucide-react'

interface CommunityWithMembership extends Community {
  isMember: boolean
  memberRole: UserRole | undefined
}

export default function CommunityPage() {
  const { user } = useAuth()
  const [communities, setCommunities] = useState<CommunityWithMembership[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [leavingId, setLeavingId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newCommunity, setNewCommunity] = useState({
    name: '',
    description: '',
    location: '',
    is_public: true
  })

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

  const createCommunity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      setIsCreating(true)
      setError(null)

      const { data, error } = await supabase
        .from('communities')
        .insert({
          name: newCommunity.name,
          description: newCommunity.description || null,
          location: newCommunity.location || null,
          is_public: newCommunity.is_public,
          created_by: user.id
        })
        .select()
        .single()

      if (error) throw error

      // Automatically join as admin
      await supabase
        .from('community_members')
        .insert({
          community_id: data.id,
          user_id: user.id,
          role: 'admin'
        })

      await fetchData()
      setShowCreateModal(false)
      setNewCommunity({ name: '', description: '', location: '', is_public: true })
      setSuccess('Community created successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error creating community:', err)
      setError('Failed to create community')
    } finally {
      setIsCreating(false)
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
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Community
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
                    {community.memberRole === 'admin' && (
                      <Crown className="h-4 w-4 text-yellow-500" />
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
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      View Details
                    </Button>
                    {community.memberRole !== 'admin' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => leaveCommunity(community.id)}
                        disabled={leavingId === community.id}
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

      {/* Create Community Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Create Community</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={createCommunity} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name *</label>
                <Input
                  value={newCommunity.name}
                  onChange={(e) => setNewCommunity({ ...newCommunity, name: e.target.value })}
                  placeholder="Community name"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={newCommunity.description}
                  onChange={(e) => setNewCommunity({ ...newCommunity, description: e.target.value })}
                  placeholder="Brief description of your community"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Location</label>
                <Input
                  value={newCommunity.location}
                  onChange={(e) => setNewCommunity({ ...newCommunity, location: e.target.value })}
                  placeholder="e.g., Auckland, New Zealand"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={newCommunity.is_public}
                  onChange={(e) => setNewCommunity({ ...newCommunity, is_public: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="is_public" className="text-sm">
                  Make this community public (anyone can join)
                </label>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Community'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
