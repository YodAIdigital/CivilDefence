# Civil Defence Expo App

A Progressive Web Application (PWA) for community-based emergency coordination, built with Next.js 14+, Supabase, and ShadCN/ui.

## Features

- 📱 **PWA with Offline Support** - Works offline with cached data and sync queue
- 🔐 **Role-Based Access Control** - Public, Member, and Admin access levels
- 🏘️ **Community-Based Accounts** - Users belong to communities (suburbs/districts)
- 🚨 **Real-time Alerts** - Emergency notifications with priority levels
- 📚 **Resource Library** - Emergency preparedness resources
- 🗺️ **Location Services** - Geolocation-based features

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + ShadCN/ui
- **Backend**: Supabase (Auth, Database, Storage, Realtime)
- **State Management**: Zustand + React Query
- **PWA**: next-pwa with Workbox

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd CivilDefence
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Update `.env.local` with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
CivilDefence/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (public)/           # Public routes
│   │   ├── (auth)/             # Authenticated routes
│   │   └── (admin)/            # Admin routes
│   ├── components/
│   │   ├── ui/                 # ShadCN/ui components
│   │   └── custom/             # Custom components
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utilities and configs
│   ├── styles/                 # Global styles
│   └── types/                  # TypeScript definitions
├── public/                     # Static assets
├── memory-bank/                # Project documentation
└── ...config files
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript checks

## Branding

- **Primary Color**: Deep Blue (#1e5b9c)
- **Accent Color**: Safety Orange (#ff9100)
- **Font**: Inter

## PWA Features

The app is configured as a Progressive Web App with:
- Offline support via service worker
- App manifest for installation
- Push notification support (planned)
- Background sync for offline actions

## Contributing

1. Read the Memory Bank documentation in `/memory-bank/`
2. Follow the established patterns in `systemPatterns.md`
3. Update documentation when making significant changes

## License

[To be determined]