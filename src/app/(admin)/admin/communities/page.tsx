'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Community } from '@/types/database'
import { Search, Building2, Users, Globe, Lock, Loader2, Plus, Trash2, Edit } from 'lucide-react'

export default function CommunitiesManagementPage() {
  const [communities, setCommunities] = useState<Community[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchCommunities = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('communities')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCommunities(data || [])
    } catch (err) {
      console.error('Error fetching communities:', err)
      setError('Failed to load communities')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCommunities()
  }, [])

  const deleteCommunity = async (communityId: string) => {
    if (!confirm('Are you sure you want to delete this community? This action cannot be undone.')) {
      return
    }

    try {
      setDeletingId(communityId)
      setError(null)

      const { error } = await supabase
        .from('communities')
        .delete()
        .eq('id', communityId)

      if (error) throw error

      setCommunities(communities.filter(c => c.id !== communityId))
      setSuccess('Community deleted successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error deleting community:', err)
      setError('Failed to delete community')
    } finally {
      setDeletingId(null)
    }
  }

  const toggleCommunityVisibility = async (communityId: string, currentVisibility: boolean) => {
    try {
      setError(null)

      const { error } = await supabase
        .from('communities')
        .update({ is_public: !currentVisibility })
        .eq('id', communityId)

      if (error) throw error

      setCommunities(communities.map(c =>
        c.id === communityId ? { ...c, is_public: !currentVisibility } : c
      ))
      setSuccess(`Community is now ${!currentVisibility ? 'public' : 'private'}`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error updating community:', err)
      setError('Failed to update community visibility')
    }
  }

  const filteredCommunities = communities.filter(community =>
    community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (community.description?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (community.location?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const totalMembers = communities.reduce((sum, c) => sum + c.member_count, 0)
  const publicCommunities = communities.filter(c => c.is_public).length
  const privateCommunities = communities.filter(c => !c.is_public).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Community Management</h1>
          <p className="text-muted-foreground">
            Manage all communities across the platform.
          </p>
        </div>
        <Button>
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

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Communities</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{communities.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMembers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Public</CardTitle>
            <Globe className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{publicCommunities}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Private</CardTitle>
            <Lock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{privateCommunities}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Communities</CardTitle>
          <CardDescription>
            View and manage all registered communities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, description, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredCommunities.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No communities found.</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">Community</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Location</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Members</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Visibility</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCommunities.map((community) => (
                    <tr key={community.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium">{community.name}</div>
                          {community.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {community.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {community.location || 'Not specified'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{community.member_count}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleCommunityVisibility(community.id, community.is_public)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            community.is_public
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                          }`}
                        >
                          {community.is_public ? (
                            <>
                              <Globe className="h-3 w-3" />
                              Public
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3" />
                              Private
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(community.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteCommunity(community.id)}
                            disabled={deletingId === community.id}
                          >
                            {deletingId === community.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
