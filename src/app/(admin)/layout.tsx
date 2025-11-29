'use client'

import { ReactNode, useEffect } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { usePathname, useRouter } from 'next/navigation'
import { Shield, LogOut, Loader2, LayoutDashboard, Users, Building2, Bell, FileText, Settings, ClipboardList } from 'lucide-react'
import { useAuth, useRole } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface AdminLayoutProps {
  children: ReactNode
}

interface NavItem {
  href: Route
  label: string
  icon: LucideIcon
}

interface NavSection {
  title: string
  items: NavItem[]
}

const sidebarNavItems: NavSection[] = [
  {
    title: 'Management',
    items: [
      { href: '/admin/dashboard' as Route, label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/users' as Route, label: 'User Management', icon: Users },
      { href: '/admin/communities' as Route, label: 'Communities', icon: Building2 },
    ]
  },
  {
    title: 'Content',
    items: [
      { href: '/admin/alerts' as Route, label: 'Alert Management', icon: Bell },
      { href: '/admin/resources' as Route, label: 'Resource Library', icon: FileText },
    ]
  },
  {
    title: 'System',
    items: [
      { href: '/admin/settings' as Route, label: 'Settings', icon: Settings },
      { href: '/admin/logs' as Route, label: 'Audit Logs', icon: ClipboardList },
    ]
  }
]

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading, signOut } = useAuth()
  const { isAdmin, isSuperAdmin } = useRole()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    } else if (!isLoading && isAuthenticated && !isAdmin) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, isLoading, isAdmin, router])

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated || !isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link href="/admin/dashboard" className="flex items-center gap-2">
              <Shield className="h-6 w-6" />
              <span className="text-xl font-bold">Civil Defence</span>
            </Link>
            <span className="rounded-md bg-white/20 px-2 py-1 text-xs font-medium">
              {isSuperAdmin ? 'Super Admin' : 'Admin'}
            </span>
          </div>
          <nav className="hidden items-center gap-4 md:flex">
            <Link
              href="/admin/dashboard"
              className="text-sm text-primary-foreground/80 hover:text-primary-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/users"
              className="text-sm text-primary-foreground/80 hover:text-primary-foreground"
            >
              Users
            </Link>
            <Link
              href="/admin/communities"
              className="text-sm text-primary-foreground/80 hover:text-primary-foreground"
            >
              Communities
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-primary-foreground/80 hover:text-primary-foreground"
            >
              Back to App
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </nav>
        </div>
      </header>
      <div className="flex">
        <aside className="hidden w-64 border-r bg-muted/30 lg:block">
          <nav className="p-4">
            {sidebarNavItems.map((section) => (
              <div key={section.title}>
                <div className="mb-4 mt-6 first:mt-0 text-xs font-semibold uppercase text-muted-foreground">
                  {section.title}
                </div>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted',
                            isActive && 'bg-muted font-medium'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
