# ShadCN/UI Components Context

## Overview
This document tracks all ShadCN/UI and MagicUI components used in the Civil Defence Expo project, including their configuration, customizations, and usage patterns.

## Project Configuration

### ShadCN/ui Setup (components.json)
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/styles/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

## Installed Components ✓

### Manually Created Components (2024-11-29)

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Button | `src/components/ui/button.tsx` | ✅ Installed | Custom accent variant added |
| Card | `src/components/ui/card.tsx` | ✅ Installed | Full component set |
| Input | `src/components/ui/input.tsx` | ✅ Installed | Standard implementation |
| Alert | `src/components/ui/alert.tsx` | ✅ Installed | Custom warning/success/info variants |

### Components To Install
```bash
# Use these commands after npm install
npx shadcn-ui@latest add form
npx shadcn-ui@latest add label
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add navigation-menu
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add skeleton
npx shadcn-ui@latest add tabs
```

## Component Implementations

### Button Component
**File**: `src/components/ui/button.tsx`

**Variants**:
- `default` - Primary blue button
- `destructive` - Red danger button
- `outline` - Bordered button
- `secondary` - Gray secondary button
- `ghost` - Transparent hover button
- `link` - Text link style
- `accent` - Safety orange accent button (CUSTOM)

**Sizes**: default, sm, lg, icon

```tsx
import { Button } from '@/components/ui/button'

// Primary action
<Button>Join Community</Button>

// Emergency action with accent
<Button variant="accent">Report Emergency</Button>

// Loading state
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Please wait
</Button>
```

### Card Component
**File**: `src/components/ui/card.tsx`

**Exports**: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

<Card>
  <CardHeader>
    <CardTitle>Community Update</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### Input Component
**File**: `src/components/ui/input.tsx`

Standard input with focus ring and accessibility support.

```tsx
import { Input } from '@/components/ui/input'

<Input type="email" placeholder="Email address" />
```

### Alert Component
**File**: `src/components/ui/alert.tsx`

**Variants** (CUSTOM for Civil Defence):
- `default` - Standard alert
- `destructive` - Critical emergency (red)
- `warning` - Caution/prepare (yellow/orange)
- `success` - Safe/operational (green)
- `info` - Informational (blue)

```tsx
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

// Emergency alert
<Alert variant="destructive">
  <AlertTitle>Critical Alert</AlertTitle>
  <AlertDescription>
    Evacuation order in effect.
  </AlertDescription>
</Alert>

// Warning alert
<Alert variant="warning">
  <AlertTitle>Weather Warning</AlertTitle>
  <AlertDescription>
    Severe weather expected.
  </AlertDescription>
</Alert>
```

## Custom Components

### Offline Indicator
**File**: `src/components/custom/offline-indicator.tsx`

Displays offline status warning when network is unavailable.

```tsx
import { OfflineIndicator } from '@/components/custom/offline-indicator'

// Add to layout
<OfflineIndicator />
```

## Theme Configuration

### CSS Variables (src/styles/globals.css)
The theme is configured using HSL CSS variables for full customization:

**Light Mode**:
- `--primary`: Deep blue (221.2 83.2% 53.3%)
- `--accent`: Safety orange (38 100% 50%)
- `--warning`: Alert orange (38 92% 50%)
- `--success`: Safe green (142.1 76.2% 36.3%)
- `--info`: Info blue (199.4 95.5% 53.8%)

**Dark Mode**:
- Inverted scales for readability
- Higher saturation for visibility

### Custom Color Classes
```css
/* Alert-specific utilities */
.alert-critical { ... }
.alert-warning { ... }
.alert-success { ... }
.alert-info { ... }
```

## Usage Guidelines

### Do's ✅
- Use ShadCN components for all UI elements
- Customize via className when needed
- Create composite components from primitives
- Follow the established patterns
- Use the custom alert variants for emergency states

### Don'ts ❌
- Don't modify component source directly (after initial setup)
- Don't create duplicate components
- Don't ignore accessibility features
- Don't override CSS variables globally without updating this doc

## Lucide Icons Used
```tsx
import { 
  Shield,      // Logo, protection
  AlertCircle, // Alerts, warnings
  Wifi,        // Online status
  WifiOff,     // Offline status
  Users,       // Community
  Bell,        // Notifications
  MapPin,      // Location
  Phone,       // Emergency contact
  FileText,    // Resources
  Settings,    // Settings
  LogOut       // Sign out
} from 'lucide-react'
```

## Performance Optimizations

### Lazy Loading Pattern
```tsx
import { lazy, Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

const HeavyComponent = lazy(() => import('./HeavyComponent'))

<Suspense fallback={<Skeleton className="h-48 w-full" />}>
  <HeavyComponent />
</Suspense>
```

### Icon Optimization
Only import the specific icons needed to minimize bundle size.

## Documentation Links

### ShadCN/UI
- [Documentation](https://ui.shadcn.com)
- [Components](https://ui.shadcn.com/docs/components)
- [Themes](https://ui.shadcn.com/themes)

### MagicUI (Planned)
- [Documentation](https://magicui.design)
- [Components](https://magicui.design/docs/components)

## Component Tracking Summary

| Component | Status | Location | Custom Variants |
|-----------|--------|----------|-----------------|
| Button | ✅ Created | ui/button.tsx | accent |
| Card | ✅ Created | ui/card.tsx | - |
| Input | ✅ Created | ui/input.tsx | - |
| Alert | ✅ Created | ui/alert.tsx | warning, success, info |
| OfflineIndicator | ✅ Created | custom/offline-indicator.tsx | - |
| Form | 📋 Planned | - | - |
| Toast | 📋 Planned | - | - |
| Dialog | 📋 Planned | - | - |
| Navigation Menu | 📋 Planned | - | - |
| Badge | 📋 Planned | - | - |
| Skeleton | 📋 Planned | - | - |
| Tabs | 📋 Planned | - | - |

## Next Steps
1. ✅ ~~Initialize ShadCN/UI in the project~~
2. ✅ ~~Create core components (Button, Card, Input, Alert)~~
3. ✅ ~~Configure custom theme colors~~
4. 📋 Install additional components via CLI after npm install
5. 📋 Create component showcase page for testing
6. 📋 Document any additional custom variants