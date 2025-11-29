'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { Shield } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'

interface PublicLayoutProps {
  children: ReactNode
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-primary">Civil Defence</span>
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
          <p>&copy; {new Date().getFullYear()} Civil Defence Expo. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}