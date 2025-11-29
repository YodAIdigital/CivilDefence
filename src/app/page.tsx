'use client'

import Link from 'next/link'
import { Shield, Users, Bell, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth()
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-blue-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-16 text-center">
        {/* Logo Section */}
        <div className="mb-8 flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary shadow-lg">
            <Shield className="h-14 w-14 text-white" />
          </div>
        </div>

        {/* Title */}
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl">
          Civil Defence Expo
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mb-12 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Community-based emergency coordination. Stay informed, stay prepared, stay connected.
        </p>

        {/* Feature Cards */}
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Public Information */}
          <Card className="transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="mb-2 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
                  <Bell className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <CardTitle className="text-lg">Emergency Information</CardTitle>
              <CardDescription>
                Access critical civil defense information and emergency preparedness guides.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Community Features */}
          <Card className="transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="mb-2 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                  <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <CardTitle className="text-lg">Community Coordination</CardTitle>
              <CardDescription>
                Join or create communities for local emergency coordination and support.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Offline Support */}
          <Card className="transition-shadow hover:shadow-lg sm:col-span-2 lg:col-span-1">
            <CardHeader>
              <div className="mb-2 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                  <Wifi className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                </div>
              </div>
              <CardTitle className="text-lg">Works Offline</CardTitle>
              <CardDescription>
                Access critical information even when connectivity is limited.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* CTA Buttons */}
        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {isLoading ? (
            <Button size="lg" disabled>
              Loading...
            </Button>
          ) : isAuthenticated ? (
            <Button size="lg" asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button size="lg" asChild>
                <Link href="/register">Get Started</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
            </>
          )}
        </div>

        {/* Status Indicator */}
        <div className="mt-16">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            App Status: Development Preview
          </p>
        </div>
      </div>
    </main>
  )
}