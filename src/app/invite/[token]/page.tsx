'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/custom/logo'

interface Invitation {
  id: string
  community_id: string
  email: string
  role: string
  status: string
  expires_at: string
  community?: {
    name: string
    description: string | null
  } | undefined
}

export default function AcceptInvitePage() {
  const params = useParams()
  const token = params?.token as string
  const { user, isLoading: authLoading } = useAuth()

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function fetchInvitation() {
      if (!token) {
        setError('Invalid invitation link')
        setIsLoading(false)
        return
      }

      try {
        // Fetch invitation by token
        const { data, error: fetchError } = await (supabase
          .from('community_invitations' as 'profiles')
          .select(`
            id,
            community_id,
            email,
            role,
            status,
            expires_at
          `)
          .eq('token', token)
          .single() as unknown as Promise<{ data: Invitation | null; error: Error | null }>)

        if (fetchError || !data) {
          setError('Invitation not found or has expired')
          setIsLoading(false)
          return
        }

        // Check if expired
        if (new Date(data.expires_at) < new Date()) {
          setError('This invitation has expired')
          setIsLoading(false)
          return
        }

        // Check if already accepted
        if (data.status !== 'pending') {
          setError(`This invitation has already been ${data.status}`)
          setIsLoading(false)
          return
        }

        // Fetch community details
        const { data: community } = await supabase
          .from('communities')
          .select('name, description')
          .eq('id', data.community_id)
          .single()

        setInvitation({
          ...data,
          community: community || undefined,
        })
      } catch (err) {
        console.error('Error fetching invitation:', err)
        setError('Failed to load invitation')
      } finally {
        setIsLoading(false)
      }
    }

    fetchInvitation()
  }, [token])

  const acceptInvitation = async () => {
    if (!invitation || !user) return

    try {
      setIsAccepting(true)
      setError(null)

      // Check if user email matches invitation
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single()

      if (profile?.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        setError(`This invitation was sent to ${invitation.email}. Please sign in with that email address.`)
        setIsAccepting(false)
        return
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('community_members')
        .select('id')
        .eq('community_id', invitation.community_id)
        .eq('user_id', user.id)
        .single()

      if (existingMember) {
        // Already a member, just update invitation status
        await (supabase as unknown as {
          from: (table: string) => {
            update: (data: unknown) => {
              eq: (col: string, val: string) => Promise<{ error: Error | null }>
            }
          }
        })
          .from('community_invitations')
          .update({ status: 'accepted', accepted_at: new Date().toISOString() })
          .eq('id', invitation.id)

        setSuccess(true)
        setTimeout(() => {
          window.location.href = `/community/${invitation.community_id}`
        }, 2000)
        return
      }

      // Add user to community
      const { error: memberError } = await supabase
        .from('community_members')
        .insert({
          community_id: invitation.community_id,
          user_id: user.id,
          role: invitation.role as 'member' | 'team_member' | 'admin',
        })

      if (memberError) throw memberError

      // Update invitation status
      await (supabase as unknown as {
        from: (table: string) => {
          update: (data: unknown) => {
            eq: (col: string, val: string) => Promise<{ error: Error | null }>
          }
        }
      })
        .from('community_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)

      setSuccess(true)
      setTimeout(() => {
        window.location.href = `/community/${invitation.community_id}`
      }, 2000)
    } catch (err) {
      console.error('Error accepting invitation:', err)
      setError('Failed to accept invitation')
    } finally {
      setIsAccepting(false)
    }
  }

  if (isLoading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-slate-900">
        <div className="text-center">
          <span className="material-icons animate-spin text-4xl text-primary">sync</span>
          <p className="mt-4 text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 dark:bg-slate-900 p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-lg">
          <span className="material-icons text-5xl text-destructive">error</span>
          <h1 className="mt-4 text-xl font-semibold">Invitation Error</h1>
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
          <h1 className="mt-4 text-xl font-semibold">Welcome to {invitation?.community?.name}!</h1>
          <p className="mt-2 text-muted-foreground">
            You&apos;ve successfully joined the community. Redirecting...
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

        {/* Invitation Card */}
        <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
          <div className="text-center">
            <span className="material-icons text-5xl text-primary">mail</span>
            <h1 className="mt-4 text-xl font-semibold">You&apos;re Invited!</h1>
          </div>

          <div className="mt-6 rounded-lg bg-muted p-4">
            <p className="text-center text-sm text-muted-foreground">
              You&apos;ve been invited to join
            </p>
            <p className="mt-1 text-center text-lg font-semibold">
              {invitation?.community?.name}
            </p>
            {invitation?.community?.description && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {invitation.community.description}
              </p>
            )}
            <p className="mt-3 text-center text-sm">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {invitation?.role === 'admin' ? 'Admin' : invitation?.role === 'team_member' ? 'Team Member' : 'Member'}
              </span>
            </p>
          </div>

          {!user ? (
            <div className="mt-6 space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                Sign in or create an account to accept this invitation
              </p>
              <div className="flex gap-3">
                <Link href={`/login?redirect=/invite/${token}`} className="flex-1">
                  <Button variant="outline" className="w-full">Sign In</Button>
                </Link>
                <Link href={`/register?redirect=/invite/${token}&email=${encodeURIComponent(invitation?.email || '')}`} className="flex-1">
                  <Button className="w-full">Create Account</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                Signed in as <strong>{user.email}</strong>
              </p>
              <Button
                onClick={acceptInvitation}
                disabled={isAccepting}
                className="w-full"
              >
                {isAccepting ? (
                  <>
                    <span className="material-icons animate-spin mr-2">sync</span>
                    Accepting...
                  </>
                ) : (
                  'Accept Invitation'
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
