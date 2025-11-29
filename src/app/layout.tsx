import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import '@/styles/globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap'
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap'
})

export const metadata: Metadata = {
  title: {
    default: 'Civil Defence Expo',
    template: '%s | Civil Defence Expo'
  },
  description:
    'Community-based emergency coordination app providing critical civil defense information and community coordination capabilities.',
  keywords: [
    'civil defence',
    'emergency preparedness',
    'community coordination',
    'disaster response',
    'emergency management'
  ],
  authors: [{ name: 'Civil Defence Expo Team' }],
  creator: 'Civil Defence Expo',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Civil Defence Expo'
  },
  formatDetection: {
    telephone: true
  },
  openGraph: {
    type: 'website',
    siteName: 'Civil Defence Expo',
    title: 'Civil Defence Expo',
    description: 'Community-based emergency coordination app'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civil Defence Expo',
    description: 'Community-based emergency coordination app'
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1e5b9c' },
    { media: '(prefers-color-scheme: dark)', color: '#0c273f' }
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}