import type { Metadata, Viewport } from 'next'
import { Noto_Sans, Noto_Sans_Mono } from 'next/font/google'
import '@/styles/globals.css'
import { Providers } from '@/components/providers'

export const dynamic = 'force-dynamic'

const notoSans = Noto_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700']
})

const notoSansMono = Noto_Sans_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap'
})

export const metadata: Metadata = {
  title: {
    default: 'CivilDefencePro',
    template: '%s | CivilDefencePro'
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
  authors: [{ name: 'CivilDefencePro Team' }],
  creator: 'CivilDefencePro',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CivilDefencePro'
  },
  formatDetection: {
    telephone: true
  },
  openGraph: {
    type: 'website',
    siteName: 'CivilDefencePro',
    title: 'CivilDefencePro',
    description: 'Community-based emergency coordination app'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CivilDefencePro',
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
        <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons|Material+Icons+Outlined"
          rel="stylesheet"
        />
      </head>
      <body className={`${notoSans.variable} ${notoSansMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}