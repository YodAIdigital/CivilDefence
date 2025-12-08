'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/custom/logo'

interface PublicLink {
  id: string
  community_id: string
  code: string
  role: 'member' | 'team_member'
  is_active: boolean
  uses_count: number
  max_uses: number | null
  expires_at: string | null
  community?: {
    id: string
    name: string
    description: string | null
    location: string | null
  }
}

export default function JoinCommunityPage() {
  const params = useParams()
  const code = (params?.code as string)?.toUpperCase()
  const { user, isLoading: authLoading } = useAuth()

  const [linkData, setLinkData] = useState<PublicLink | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [alreadyMember, setAlreadyMember] = useState(false)

  useEffect(() => {
    async function fetchLink() {
      if (!code) {
        setError('Invalid invite link')
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/public-link?code=${code}`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Invalid invite link')
          setIsLoading(false)
          return
        }

        setLinkData(data.link)
      } catch (err) {
        console.error('Error fetching link:', err)
        setError('Failed to load invite link')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLink()
  }, [code])

  // Check if user is already a member when they're logged in
  useEffect(() => {
    async function checkMembership() {
      if (!user || !linkData?.community_id) return

      const { data: existingMember } = await supabase
        .from('community_members')
        .select('id')
        .eq('community_id', linkData.community_id)
        .eq('user_id', user.id)
        .single()

      if (existingMember) {
        setAlreadyMember(true)
      }
    }

    checkMembership()
  }, [user, linkData?.community_id])

  const handleJoin = async () => {
    if (!linkData || !user) return

    setIsJoining(true)
    setError(null)

    try {
      // Check if already a member
      const { data: existingMember } = await supabase
        .from('community_members')
        .select('id')
        .eq('community_id', linkData.community_id)
        .eq('user_id', user.id)
        .single()

      if (existingMember) {
        setAlreadyMember(true)
        setSuccess(true)
        setTimeout(() => {
          window.location.href = `/community/${linkData.community_id}`
        }, 2000)
        return
      }

      // Add user to community
      const { error: memberError } = await supabase
        .from('community_members')
        .insert({
          community_id: linkData.community_id,
          user_id: user.id,
          role: linkData.role,
        })

      if (memberError) throw memberError

      // Increment uses count
      await fetch('/api/public-link', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      setSuccess(true)
      setTimeout(() => {
        window.location.href = `/community/${linkData.community_id}`
      }, 2000)
    } catch (err) {
      console.error('Error joining community:', err)
      setError('Failed to join community. Please try again.')
    } finally {
      setIsJoining(false)
    }
  }

  if (isLoading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-slate-900">
        <div className="text-center">
          <span className="material-icons animate-spin text-4xl text-primary">sync</span>
          <p className="mt-4 text-muted-foreground">Loading invite...</p>
        </div>
      </div>
    )
  }

  if (error && !linkData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 dark:bg-slate-900 p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-lg">
          <span className="material-icons text-5xl text-destructive">error</span>
          <h1 className="mt-4 text-xl font-semibold">Invalid Invite Link</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
          <Link href="/">
            <Button className="mt-6">Go to Home</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 dark:bg-slate-900 p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-lg">
          <span className="material-icons text-5xl text-green-500">check_circle</span>
          <h1 className="mt-4 text-xl font-semibold">
            {alreadyMember ? 'Already a Member!' : `Welcome to ${linkData?.community?.name}!`}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {alreadyMember
              ? 'You\'re already a member of this community. Redirecting...'
              : 'You\'ve successfully joined the community. Redirecting...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>

        {/* Join Card */}
        <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
          <div className="text-center">
            <span className="material-icons text-5xl text-primary">groups</span>
            <h1 className="mt-4 text-xl font-semibold">Join Community</h1>
          </div>

          <div className="mt-6 rounded-lg bg-muted p-4">
            <p className="text-center text-sm text-muted-foreground">
              You&apos;ve been invited to join
            </p>
            <p className="mt-1 text-center text-lg font-semibold">
              {linkData?.community?.name}
            </p>
            {linkData?.community?.description && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {linkData.community.description}
              </p>
            )}
            {linkData?.community?.location && (
              <p className="mt-2 text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
                <span className="material-icons text-sm">location_on</span>
                {linkData.community.location}
              </p>
            )}
            <p className="mt-3 text-center text-sm">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {linkData?.role === 'team_member' ? 'Team Member' : 'Member'}
              </span>
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!user ? (
            <div className="mt-6 space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                Sign in or create an account to join this community
              </p>
              <div className="flex gap-3">
                <Link href={`/login?redirect=/join/${code}`} className="flex-1">
                  <Button variant="outline" className="w-full">Sign In</Button>
                </Link>
                <Link href={`/register?redirect=/join/${code}`} className="flex-1">
                  <Button className="w-full">Create Account</Button>
                </Link>
              </div>
            </div>
          ) : alreadyMember ? (
            <div className="mt-6 space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                You&apos;re already a member of this community!
              </p>
              <Button
                className="w-full"
                onClick={() => window.location.href = `/community/${linkData?.community_id}`}
              >
                Go to Community
              </Button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                Signed in as <strong>{user.email}</strong>
              </p>
              <Button
                onClick={handleJoin}
                disabled={isJoining}
                className="w-full"
              >
                {isJoining ? (
                  <>
                    <span className="material-icons animate-spin mr-2 text-lg">sync</span>
                    Joining...
                  </>
                ) : (
                  <>
                    <span className="material-icons mr-2 text-lg">group_add</span>
                    Join Community
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Invite code: <span className="font-mono font-medium">{code}</span>
        </p>
      </div>
    </div>
  )
}
