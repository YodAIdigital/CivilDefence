'use client'

export const dynamic = 'force-dynamic'

import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useCommunity } from '@/contexts/community-context'
import { Logo } from '@/components/custom/logo'
import type { Route } from 'next'

interface AuthLayoutProps {
  children: ReactNode
}

interface NavItem {
  href: string
  icon: string
  label: string
  badge?: number
}

const navItems: NavItem[] = [
  { href: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/profile', icon: 'person', label: 'My Profile' },
  { href: '/guides', icon: 'menu_book', label: 'Response Plans' },
  { href: '/checklist', icon: 'checklist', label: 'Emergency Kit' },
  { href: '/contacts', icon: 'contact_phone', label: 'Emergency Contacts' },
]

// Community nav item is handled separately to use dynamic href based on active community

const adminNavItems: NavItem[] = [
  { href: '/admin/templates', icon: 'edit_note', label: 'Manage Templates' },
]

export default function AuthLayout({ children }: AuthLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading, profile, signOut } = useAuth()
  const { communities, activeCommunity, setActiveCommunity } = useCommunity()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isCommunityDropdownOpen, setIsCommunityDropdownOpen] = useState(false)

  // Generate Gravatar URL from email
  const getGravatarUrl = (email: string, size: number = 80) => {
    const hash = email.toLowerCase().trim()
    // Simple hash for Gravatar - in production use MD5
    let hashCode = 0
    for (let i = 0; i < hash.length; i++) {
      hashCode = hash.charCodeAt(i) + ((hashCode << 5) - hashCode)
    }
    const hashHex = Math.abs(hashCode).toString(16).padStart(32, '0').slice(0, 32)
    return `https://www.gravatar.com/avatar/${hashHex}?s=${size}&d=identicon`
  }

  // Get user avatar - prioritize uploaded avatar, then Gravatar
  const getUserAvatar = () => {
    if (profile?.avatar_url) {
      return profile.avatar_url
    }
    if (profile?.email) {
      return getGravatarUrl(profile.email)
    }
    return null
  }

  const avatarUrl = getUserAvatar()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const handleCommunitySelect = (community: typeof activeCommunity) => {
    if (community) {
      setActiveCommunity(community)
    }
    setIsCommunityDropdownOpen(false)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <span className="material-icons animate-spin text-4xl text-primary">sync</span>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-card transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Logo & Collapse Button */}
        <div className="flex h-16 items-center justify-between px-3">
          {isCollapsed ? (
            <Logo size="sm" showText={false} className="mx-auto" />
          ) : (
            <Logo size="sm" />
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground ${
              isCollapsed ? 'absolute -right-3 top-5 z-50 bg-card border border-border shadow-sm' : ''
            }`}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="material-icons text-lg">
              {isCollapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        </div>

        {/* Community Selector */}
        {communities.length > 0 && (
          <div className={`px-3 pb-3 ${isCollapsed ? 'hidden' : ''}`}>
            <div className="relative">
              <button
                onClick={() => setIsCommunityDropdownOpen(!isCommunityDropdownOpen)}
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-background p-2.5 text-sm hover:bg-muted"
              >
                <span className="material-icons text-xl text-[#000542]">groups</span>
                <div className="flex-1 overflow-hidden text-left">
                  <p className="truncate font-medium">{activeCommunity?.name || 'Select Community'}</p>
                </div>
                <span className="material-icons text-lg text-muted-foreground">
                  {isCommunityDropdownOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {/* Dropdown */}
              {isCommunityDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-card py-1 shadow-lg">
                  {communities.map((community) => (
                    <button
                      key={community.id}
                      onClick={() => handleCommunitySelect(community)}
                      className={`flex w-full items-center px-3 py-2 text-sm hover:bg-muted ${
                        activeCommunity?.id === community.id ? 'bg-primary/10 text-primary' : ''
                      }`}
                    >
                      <span className="truncate text-left">{community.name}</span>
                    </button>
                  ))}
                  <div className="border-t border-border mt-1 pt-1">
                    <Link
                      href="/community"
                      onClick={() => setIsCommunityDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <span className="material-icons text-lg">add</span>
                      <span>Community</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href as Route}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <span className={`material-icons-outlined text-xl ${isActive ? '' : 'opacity-70'}`}>
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <>
                    {item.label}
                    {isActive && (
                      <span className="material-icons ml-auto text-lg">arrow_forward</span>
                    )}
                  </>
                )}
              </Link>
            )
          })}

          {/* Community Nav Item - Dynamic based on active community */}
          {(() => {
            // If there's an active community, link to its manage page
            // Otherwise, link to the community list page
            const communityHref = activeCommunity
              ? `/community/${activeCommunity.id}/manage`
              : '/community'
            const isCommunityActive = pathname?.startsWith('/community') ?? false

            return (
              <Link
                href={communityHref as Route}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isCommunityActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                title={isCollapsed ? 'Community' : undefined}
              >
                <span className={`material-icons-outlined text-xl ${isCommunityActive ? '' : 'opacity-70'}`}>
                  groups
                </span>
                {!isCollapsed && (
                  <>
                    Community
                    {isCommunityActive && (
                      <span className="material-icons ml-auto text-lg">arrow_forward</span>
                    )}
                  </>
                )}
              </Link>
            )
          })()}

          {/* Admin Navigation - Only visible to super admins */}
          {profile?.role === 'super_admin' && (
            <>
              {!isCollapsed && (
                <div className="mt-4 mb-2 px-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Admin
                  </p>
                </div>
              )}
              {adminNavItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href as Route}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#FEB100] text-white'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <span className={`material-icons-outlined text-xl ${isActive ? '' : 'opacity-70'}`}>
                      {item.icon}
                    </span>
                    {!isCollapsed && (
                      <>
                        {item.label}
                        {isActive && (
                          <span className="material-icons ml-auto text-lg">arrow_forward</span>
                        )}
                      </>
                    )}
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        {/* User Section */}
        <div className="border-t border-border p-3">
          <Link
            href="/profile"
            className={`flex items-center gap-3 rounded-lg p-1.5 hover:bg-muted transition-colors ${isCollapsed ? 'justify-center' : ''}`}
          >
            <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary to-accent">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={profile?.full_name || 'User'}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    // Fallback to initials on error
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : null}
              <div className={`flex h-full w-full items-center justify-center text-sm font-medium text-white ${avatarUrl ? 'hidden' : ''}`}>
                {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
            {!isCollapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{profile?.full_name || 'User'}</p>
                <p className="truncate text-xs text-muted-foreground capitalize">
                  {profile?.role || 'member'}
                </p>
              </div>
            )}
          </Link>
          {!isCollapsed && (
            <button
              onClick={handleSignOut}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted hover:text-destructive"
            >
              <span className="material-icons-outlined text-lg">logout</span>
              Sign Out
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={`flex flex-1 flex-col transition-all duration-300 ${
          isCollapsed ? 'ml-16' : 'ml-56'
        }`}
      >
        {/* Page Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
