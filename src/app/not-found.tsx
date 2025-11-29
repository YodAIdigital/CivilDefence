import Link from 'next/link'
import { Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-12 w-12 text-primary" />
        </div>
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <h2 className="mb-4 text-xl text-muted-foreground">Page Not Found</h2>
        <p className="mb-8 text-muted-foreground">
          The page you are looking for does not exist or has been moved.
        </p>
        <Button asChild>
          <Link href="/">Return Home</Link>
        </Button>
      </div>
    </div>
  )
}
