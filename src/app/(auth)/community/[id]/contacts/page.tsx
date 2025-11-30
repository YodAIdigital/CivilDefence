'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { ContactsDisplay } from '@/components/community/contacts-display'
import type { Community, CommunityContact } from '@/types/database'
import { ArrowLeft, MapPin, Users, Settings } from 'lucide-react'

export default function CommunityContactsPage() {
  const params = useParams()
  const communityId = params?.id as string
  const { user } = useAuth()

  const [community, setCommunity] = useState<Community | null>(null)
  const [contacts, setContacts] = useState<CommunityContact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMember, setIsMember] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

      // Load contacts from settings
      const settings = communityData.settings as { contacts?: CommunityContact[] } | null
      if (settings?.contacts) {
        setContacts(settings.contacts)
      }

      // Check membership
      const { data: membershipData } = await supabase
        .from('community_members')
        .select('role')
        .eq('community_id', communityId)
        .eq('user_id', user.id)
        .single()

      if (membershipData) {
        setIsMember(true)
        setIsAdmin(membershipData.role === 'admin' || membershipData.role === 'super_admin')
      }
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load community contacts')
    } finally {
      setIsLoading(false)
    }
  }, [user, communityId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="material-icons animate-spin text-4xl text-primary">sync</span>
      </div>
    )
  }

  if (error || !community) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center">
        <span className="material-icons text-6xl text-destructive">error</span>
        <h1 className="mt-4 text-2xl font-bold">Error</h1>
        <p className="mt-2 text-muted-foreground">{error || 'Community not found'}</p>
        <Link
          href="/community"
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Back to Communities
        </Link>
      </div>
    )
  }

  if (!isMember && !community.is_public) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center">
        <span className="material-icons text-6xl text-amber-500">lock</span>
        <h1 className="mt-4 text-2xl font-bold">Members Only</h1>
        <p className="mt-2 text-muted-foreground">
          You need to be a member of this community to view contacts.
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/community" className="hover:text-foreground">
              Communities
            </Link>
            <span className="material-icons text-sm">chevron_right</span>
            <span>{community.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Key Contacts</h1>
          <p className="mt-1 text-muted-foreground">
            Important contacts and roles for {community.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href={`/community/${communityId}/manage`}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Settings className="h-4 w-4" />
              Manage
            </Link>
          )}
        </div>
      </div>

      {/* Community Info Card */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">{community.name}</h2>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-1">
              {community.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {community.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {community.member_count} members
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Contacts */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span className="material-icons text-[#FEB100]">contact_phone</span>
            Community Contacts
          </h2>
          <p className="text-sm text-muted-foreground">
            Key people to contact during emergencies or for community matters
          </p>
        </div>
        <div className="p-4">
          <ContactsDisplay contacts={contacts} communityName={community.name} />
        </div>
      </div>

      {/* Meeting Point if exists */}
      {community.meeting_point_lat && community.meeting_point_lng && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <MapPin className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold">Emergency Meeting Point</h3>
              <p className="text-sm font-medium mt-0.5">
                {community.meeting_point_name || 'Meeting Point'}
              </p>
              {community.meeting_point_address && (
                <p className="text-sm text-muted-foreground">{community.meeting_point_address}</p>
              )}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${community.meeting_point_lat},${community.meeting_point_lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
              >
                Open in Google Maps
                <span className="material-icons text-sm">open_in_new</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Back button */}
      <div className="pt-2">
        <Link
          href="/community"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Communities
        </Link>
      </div>
    </div>
  )
}
