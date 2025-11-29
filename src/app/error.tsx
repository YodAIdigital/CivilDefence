'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Shield, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10">
          <Shield className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="mb-4 text-4xl font-bold">Something went wrong</h1>
        <p className="mb-8 text-muted-foreground">
          An unexpected error occurred. Please try again.
        </p>
        <div className="flex justify-center gap-4">
          <Button onClick={reset} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button asChild>
            <Link href="/">Return Home</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
