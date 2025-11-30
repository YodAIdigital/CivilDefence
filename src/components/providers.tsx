'use client'

import { AuthProvider } from '@/contexts/auth-context'
import { CommunityProvider } from '@/contexts/community-context'
import { type ReactNode, useState, useEffect } from 'react'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Render children without providers during SSR to avoid context issues
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <AuthProvider>
      <CommunityProvider>{children}</CommunityProvider>
    </AuthProvider>
  )
}
