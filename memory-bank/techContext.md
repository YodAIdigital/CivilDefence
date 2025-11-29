# Civil Defence Expo - Technology Context

## Core Technology Stack

### Frontend Framework
**Next.js 14+ with App Router**
- Server components for better performance
- Built-in API routes
- Optimized image handling
- PWA support via next-pwa
- TypeScript for type safety

### UI Component Library
**ShadCN/ui + MagicUI**
- Radix UI primitives
- Tailwind CSS styling
- Fully customizable components
- Accessibility built-in
- Tree-shakeable

### State Management
**Zustand + React Query**
- Zustand for client state
- React Query (TanStack Query) for server state
- Optimistic updates
- Cache management
- Offline queue handling

### Backend Services
**Supabase**
- PostgreSQL database
- Real-time subscriptions
- Authentication & authorization
- File storage with CDN
- Row Level Security (RLS)
- Edge Functions for custom logic

### PWA & Offline
**Workbox + Custom Service Worker**
- Workbox for caching strategies
- Background sync API
- Push notifications
- App manifest
- Install prompts

### Build Tools & Dev Environment
**Vite (Alternative) or Next.js Built-in**
- Fast HMR (Hot Module Replacement)
- ESBuild for fast builds
- PostCSS for CSS processing
- PWA plugin integration

## Development Setup

### Prerequisites
```json
{
  "node": ">=18.0.0",
  "npm": ">=9.0.0",
  "git": ">=2.0.0"
}
```

### Environment Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME="Civil Defence Expo"

# PWA Config
NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY=your_vapid_public_key
WEB_PUSH_PRIVATE_KEY=your_vapid_private_key
WEB_PUSH_EMAIL=admin@civildefence.app
```

### Project Structure
```
civil-defence-expo/
├── app/                    # Next.js app directory
│   ├── (public)/          # Public routes
│   ├── (auth)/            # Auth-required routes
│   ├── (admin)/           # Admin routes
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── components/
│   ├── ui/                # ShadCN components
│   └── features/          # Feature components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities
│   ├── supabase/         # Supabase client
│   └── utils/            # Helper functions
├── public/               # Static assets
│   ├── manifest.json     # PWA manifest
│   └── icons/            # App icons
├── styles/               # Global styles
├── types/                # TypeScript types
└── workers/              # Service worker files
```

## Technical Constraints

### Browser Support
- Chrome/Edge: Last 2 versions
- Firefox: Last 2 versions  
- Safari: Last 2 versions
- Mobile Safari: iOS 12+
- Chrome Android: Last 2 versions

### Performance Budget
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3.5s
- Lighthouse Score: > 90
- Bundle Size: < 200KB (initial)

### Offline Constraints
- Max offline data: 50MB
- Sync queue limit: 100 actions
- Cache expiry: 7 days
- Background sync: Every 5 minutes

### Security Requirements
- HTTPS required
- CSP headers configured
- XSS protection
- SQL injection prevention (via Supabase)
- Rate limiting: 100 req/min

## Dependencies

### Core Dependencies
```json
{
  "next": "^14.0.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "typescript": "^5.0.0",
  "@supabase/supabase-js": "^2.38.0",
  "@tanstack/react-query": "^5.0.0",
  "zustand": "^4.4.0",
  "next-pwa": "^5.6.0"
}
```

### UI Dependencies
```json
{
  "@radix-ui/react-*": "latest",
  "tailwindcss": "^3.3.0",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.0.0",
  "tailwind-merge": "^2.0.0",
  "lucide-react": "^0.290.0"
}
```

### Development Dependencies
```json
{
  "@types/react": "^18.2.0",
  "@types/node": "^20.0.0",
  "eslint": "^8.0.0",
  "prettier": "^3.0.0",
  "husky": "^8.0.0",
  "lint-staged": "^15.0.0",
  "@testing-library/react": "^14.0.0",
  "vitest": "^0.34.0"
}
```

## Deployment & Infrastructure

### Hosting Options
1. **Vercel** (Recommended for Next.js)
   - Automatic deployments
   - Edge functions
   - Global CDN
   - Preview deployments

2. **Netlify** (Alternative)
   - Similar features
   - Good PWA support
   
3. **Self-hosted**
   - Docker containerization
   - Nginx reverse proxy
   - PM2 for process management

### Database Considerations
- Supabase hosted (recommended)
- Connection pooling enabled
- Read replicas for scaling
- Daily backups configured

### Monitoring & Analytics
- Vercel Analytics
- Sentry for error tracking
- Google Analytics (privacy-compliant)
- Custom metrics via Supabase

## Tool Usage Patterns

### Component Development
```bash
# Generate new component
npx shadcn-ui@latest add [component]

# Create custom component
npm run generate:component MyComponent
```

### Database Migrations
```bash
# Create migration
supabase migration new [name]

# Apply migrations
supabase db push

# Generate types
supabase gen types typescript
```

### PWA Development
```bash
# Test PWA locally
npm run build && npm run start

# Update service worker
npm run sw:update

# Test offline mode
# Browser DevTools > Network > Offline
```

### Testing Patterns
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# PWA audit
npm run lighthouse
```

## Integration Points

### Supabase Integration
- Client-side SDK for real-time
- Server-side SDK for secure operations
- RLS policies for authorization
- Edge functions for complex logic

### PWA Integration  
- Service worker registration in app
- Offline detection hooks
- Sync queue management
- Push notification setup

### Component Library Integration
- Custom theme configuration
- Component composition patterns
- Accessibility testing
- Dark mode support