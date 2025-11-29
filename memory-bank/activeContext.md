# Civil Defence Expo - Active Context

## Current Focus
Project setup complete. Next.js application structure created with all configuration files, ShadCN/ui components, and PWA support ready for development.

## Recent Changes
- Created comprehensive Memory Bank documentation structure
- Defined core architecture patterns for offline-first PWA
- Established technology stack decisions
- Outlined user roles and permissions system
- **Created comprehensive branding guidelines** (2024-11-29)
- **Designed Civil Defence Expo logo with shield, cross, and community elements**
- **Implemented CSS custom properties system with full color palette**
- **Established typography system with Google Fonts (Inter + JetBrains Mono)**
- **PROJECT SETUP COMPLETE** (2024-11-29):
  - Created complete Next.js 14+ project structure
  - Configured TypeScript with strict settings
  - Set up Tailwind CSS with custom branding theme
  - Configured ShadCN/ui with custom theme
  - Created essential UI components (Button, Card, Input, Alert)
  - Set up PWA manifest and configuration
  - Created route groups for public, auth, and admin areas
  - Implemented offline detection hooks
  - Created TypeScript type definitions

## Next Steps

### Immediate Actions
1. **Install dependencies**
   - Run `npm install` in CivilDefence directory
   - Verify all packages install correctly
   - Start development server with `npm run dev`

2. **Set up Supabase**
   - Create Supabase project
   - Design initial database schema
   - Configure authentication
   - Set up RLS policies

3. **Generate PWA icons**
   - Create icon set from logo SVG
   - Generate various sizes (192x192, 512x512, etc.)
   - Add maskable icons for Android

4. **Enhance UI components**
   - Install additional ShadCN components (Dialog, Dropdown, Toast)
   - Create navigation components
   - Implement mobile-responsive sidebar

### Short-term Goals
- MVP with public information section
- Basic authentication flow
- Community creation and joining
- Offline reading capability
- Push notification setup

## Active Decisions

### Architecture Decisions
- **Next.js over Vite**: Better SSR support, built-in optimizations, easier deployment
- **Zustand + React Query**: Simpler than Redux, better offline support
- **Workbox**: Industry standard for service workers
- **ShadCN/ui**: Highly customizable, accessible by default
- **src/ directory structure**: Better organization for larger projects
- **Route groups**: Clean separation of public/auth/admin areas

### Design Decisions
- Mobile-first approach due to emergency use cases
- Dark mode support from the start
- Focus on performance over visual effects
- Progressive disclosure for complex features
- **Brand Identity Decisions** (2024-11-29):
  - Deep blue primary color for trust and authority
  - Safety orange accent for emergency actions
  - Shield logo symbolizing protection and community
  - Inter font for excellent readability across devices
  - Comprehensive semantic color system for alerts

### Data Structure Decisions
- Communities as the central organizing principle
- Flat structure for better query performance
- Separate tables for real-time features
- Minimal joins for offline efficiency

## Important Patterns

### File Structure Pattern
```
src/
├── app/                    # Next.js App Router
│   ├── (public)/           # Public routes (no auth)
│   ├── (auth)/             # Authenticated routes
│   └── (admin)/            # Admin routes
├── components/
│   ├── ui/                 # ShadCN/ui base components
│   └── custom/             # App-specific components
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities and configs
├── styles/                 # Global CSS
└── types/                  # TypeScript definitions
```

### Offline-First Development
```typescript
// Always assume offline
const data = await getLocalData() || await fetchRemoteData()

// Queue actions when offline
if (!navigator.onLine) {
  queueAction(action)
} else {
  executeAction(action)
}
```

### Component Composition
```tsx
// Prefer composition over inheritance
<Card>
  <CardHeader>
    <CardTitle>Community Update</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### Error Handling
```typescript
// Graceful degradation
try {
  await syncWithServer()
} catch (error) {
  showOfflineNotice()
  continueWithLocalData()
}
```

## Learnings & Insights

### Project Setup Insights
- Manual project setup gives more control than create-next-app
- ShadCN components work well with CSS custom properties
- Route groups enable clean layout separation
- PWA configuration requires careful caching strategy planning

### PWA Considerations
- Service worker updates need careful handling
- Cache invalidation strategy is crucial
- Users need clear offline/online indicators
- Background sync has browser limitations

### Branding Insights
- Shield symbolism resonates with civil defense concept
- Orange accent color provides urgency without alarm
- Community dots in logo represent connection during crisis
- Radio waves symbolize emergency communication
- Comprehensive color system needed for various alert states

### Supabase Best Practices
- Use RLS for all tables from the start
- Batch operations when possible
- Real-time subscriptions need cleanup
- Connection pooling for better performance

## Key Preferences

### Code Style
- TypeScript with strict mode
- Functional components only
- Custom hooks for logic reuse
- Co-locate related code

### Testing Strategy
- Unit tests for utilities
- Integration tests for API routes
- E2E tests for critical paths
- Manual PWA testing

### Documentation
- JSDoc for complex functions
- README for each major feature
- Inline comments for tricky logic
- Maintain Memory Bank actively

## Created Files Summary

### Configuration (Root)
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript config
- `next.config.js` - Next.js + PWA config
- `tailwind.config.js` - Tailwind theme
- `components.json` - ShadCN/ui config
- `.eslintrc.json`, `.prettierrc` - Code style
- `.env.example`, `.gitignore` - Environment
- `README.md` - Project documentation

### Application (src/)
- `app/layout.tsx` - Root layout with fonts/PWA
- `app/page.tsx` - Home page
- `app/(public)/layout.tsx` - Public layout
- `app/(auth)/layout.tsx` - Auth layout
- `app/(admin)/layout.tsx` - Admin layout
- `styles/globals.css` - CSS variables + Tailwind

### Components (src/components/)
- `ui/button.tsx` - Button with variants
- `ui/card.tsx` - Card components
- `ui/input.tsx` - Input component
- `ui/alert.tsx` - Alert with variants
- `custom/offline-indicator.tsx` - Offline status

### Libraries (src/lib/)
- `utils.ts` - Utility functions (cn)
- `supabase/client.ts` - Supabase client

### Hooks (src/hooks/)
- `useOffline.ts` - Offline detection + sync queue

### Types (src/types/)
- `index.ts` - Core type definitions

### Public Assets
- `manifest.json` - PWA manifest

## Risk Mitigation

### Technical Risks
- **Offline sync conflicts**: Implement clear conflict resolution
- **Service worker bugs**: Extensive testing, gradual rollout
- **Database scaling**: Monitor usage, plan for sharding
- **Bundle size growth**: Code splitting, lazy loading

### User Experience Risks
- **Complex onboarding**: Progressive disclosure, good defaults
- **Offline confusion**: Clear status indicators, helpful messages  
- **Permission issues**: Test all role combinations
- **Performance degradation**: Regular audits, monitoring

## Current Blockers
None - project structure complete, ready for npm install and development.

## Questions for Consideration
1. Should we implement push notifications in MVP?
2. What's the community size limit we should plan for?
3. Do we need real-time features in first version?
4. Should we support multiple languages from start?