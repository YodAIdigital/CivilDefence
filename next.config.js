/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['kesnjmlkyvqfrewbdios.supabase.co'],
    formats: ['image/avif', 'image/webp']
  },
  experimental: {
    typedRoutes: true
  },
  // Improve dev server stability
  onDemandEntries: {
    // Keep pages in memory for longer (5 minutes)
    maxInactiveAge: 5 * 60 * 1000,
    // Keep more pages in memory
    pagesBufferLength: 5
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY'
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block'
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin'
        }
      ]
    }
  ]
}

module.exports = nextConfig