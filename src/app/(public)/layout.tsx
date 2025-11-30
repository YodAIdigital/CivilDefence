'use client'

export const dynamic = 'force-dynamic'

import { ReactNode } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/custom/logo'

interface PublicLayoutProps {
  children: ReactNode
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/alerts"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Alerts
            </Link>
            {isLoading ? null : isAuthenticated ? (
              <Button size="sm" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-primary hover:text-primary/80"
                >
                  Sign In
                </Link>
                <Button size="sm" asChild>
                  <Link href="/register">Get Started</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t bg-muted/50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} CivilDefencePro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}