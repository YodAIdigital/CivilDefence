# Civil Defence Expo - Branding Guidelines

## Brand Identity

### Mission Statement
Civil Defence Expo empowers communities with critical emergency information and coordination tools, ensuring preparedness and resilience when it matters most.

### Brand Values
- **Trust**: Reliable information when lives depend on it
- **Community**: Stronger together in times of crisis
- **Accessibility**: Information for everyone, everywhere
- **Resilience**: Built to work when infrastructure fails

## Color Palette

### Primary Colors
```css
/* Deep Blue - Trust, Authority, Stability */
--primary-900: #0f172a;    /* rgb(15, 23, 42) */
--primary-800: #1e293b;    /* rgb(30, 41, 59) */
--primary-700: #334155;    /* rgb(51, 65, 85) */
--primary-600: #475569;    /* rgb(71, 85, 105) */
--primary-500: #64748b;    /* rgb(100, 116, 139) */
--primary-400: #94a3b8;    /* rgb(148, 163, 184) */
--primary-300: #cbd5e1;    /* rgb(203, 213, 225) */
--primary-200: #e2e8f0;    /* rgb(226, 232, 240) */
--primary-100: #f1f5f9;    /* rgb(241, 245, 249) */
--primary-50: #f8fafc;     /* rgb(248, 250, 252) */

/* Safety Orange - Alerts, Emergency, Action */
--accent-900: #7c2d12;     /* rgb(124, 45, 18) */
--accent-800: #9a3412;     /* rgb(154, 52, 18) */
--accent-700: #c2410c;     /* rgb(194, 65, 12) */
--accent-600: #ea580c;     /* rgb(234, 88, 12) */
--accent-500: #f97316;     /* rgb(249, 115, 22) */
--accent-400: #fb923c;     /* rgb(251, 146, 60) */
--accent-300: #fdba74;     /* rgb(253, 186, 116) */
--accent-200: #fed7aa;     /* rgb(254, 215, 170) */
--accent-100: #ffedd5;     /* rgb(255, 237, 213) */
--accent-50: #fff7ed;      /* rgb(255, 247, 237) */
```

### Semantic Colors
```css
/* Success - Safe, Operational, Connected */
--success-900: #14532d;    /* rgb(20, 83, 45) */
--success-700: #15803d;    /* rgb(21, 128, 61) */
--success-500: #22c55e;    /* rgb(34, 197, 94) */
--success-300: #86efac;    /* rgb(134, 239, 172) */
--success-100: #dcfce7;    /* rgb(220, 252, 231) */

/* Warning - Caution, Prepare, Alert */
--warning-900: #713f12;    /* rgb(113, 63, 18) */
--warning-700: #a16207;    /* rgb(161, 98, 7) */
--warning-500: #eab308;    /* rgb(234, 179, 8) */
--warning-300: #fde047;    /* rgb(253, 224, 71) */
--warning-100: #fef3c7;    /* rgb(254, 243, 199) */

/* Danger - Emergency, Critical, Urgent */
--danger-900: #7f1d1d;     /* rgb(127, 29, 29) */
--danger-700: #b91c1c;     /* rgb(185, 28, 28) */
--danger-500: #ef4444;     /* rgb(239, 68, 68) */
--danger-300: #fca5a5;     /* rgb(252, 165, 165) */
--danger-100: #fee2e2;     /* rgb(254, 226, 226) */

/* Neutral - Background, Text, Borders */
--neutral-900: #18181b;    /* rgb(24, 24, 27) */
--neutral-800: #27272a;    /* rgb(39, 39, 42) */
--neutral-700: #3f3f46;    /* rgb(63, 63, 70) */
--neutral-600: #52525b;    /* rgb(82, 82, 91) */
--neutral-500: #71717a;    /* rgb(113, 113, 122) */
--neutral-400: #a1a1aa;    /* rgb(161, 161, 170) */
--neutral-300: #d4d4d8;    /* rgb(212, 212, 216) */
--neutral-200: #e4e4e7;    /* rgb(228, 228, 231) */
--neutral-100: #f4f4f5;    /* rgb(244, 244, 245) */
--neutral-50: #fafafa;     /* rgb(250, 250, 250) */
```

### Dark Mode Colors
```css
/* Inverted scales for dark mode */
--background: var(--neutral-900);
--foreground: var(--neutral-50);
--muted: var(--neutral-800);
--muted-foreground: var(--neutral-400);
--card: var(--neutral-800);
--card-foreground: var(--neutral-50);
```

## Typography

### Font Families
```css
/* Primary Font - Clean, modern, excellent readability */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Monospace - Code, data, technical information */
--font-mono: 'JetBrains Mono', 'Consolas', 'Monaco', monospace;

/* Fallback fonts for maximum compatibility */
--font-system: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;

/* Noto Sans fallback for internationalization */
--font-international: 'Noto Sans', var(--font-system);
```

### Font Weights
```css
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### Font Sizes (Mobile First)
```css
/* Base: 16px, Scale: 1.250 (Major Third) */
--text-xs: 0.75rem;     /* 12px */
--text-sm: 0.875rem;    /* 14px */
--text-base: 1rem;      /* 16px */
--text-lg: 1.125rem;    /* 18px */
--text-xl: 1.25rem;     /* 20px */
--text-2xl: 1.5rem;     /* 24px */
--text-3xl: 1.875rem;   /* 30px */
--text-4xl: 2.25rem;    /* 36px */
--text-5xl: 3rem;       /* 48px */
```

### Line Heights
```css
--leading-none: 1;
--leading-tight: 1.25;
--leading-snug: 1.375;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
--leading-loose: 2;
```

## Spacing System

### Base Unit: 4px (0.25rem)
```css
--space-0: 0;
--space-1: 0.25rem;    /* 4px */
--space-2: 0.5rem;     /* 8px */
--space-3: 0.75rem;    /* 12px */
--space-4: 1rem;       /* 16px */
--space-5: 1.25rem;    /* 20px */
--space-6: 1.5rem;     /* 24px */
--space-8: 2rem;       /* 32px */
--space-10: 2.5rem;    /* 40px */
--space-12: 3rem;      /* 48px */
--space-16: 4rem;      /* 64px */
--space-20: 5rem;      /* 80px */
--space-24: 6rem;      /* 96px */
```

## Logo Usage Guidelines

### Logo Variations
1. **Primary Logo**: Shield icon with "Civil Defence Expo" text
2. **Icon Only**: Shield icon for small spaces
3. **Horizontal**: Icon + text side by side
4. **Stacked**: Icon above text

### Clear Space
- Minimum clear space = 1x the height of the shield icon
- No other elements should encroach on this space

### Minimum Sizes
- Icon only: 24px × 24px minimum
- With text: 120px width minimum
- Mobile app icon: Follow platform guidelines (iOS/Android)

### Color Usage
- Primary: Deep blue on light backgrounds
- Inverted: White on dark backgrounds
- Never use gradient versions
- Maintain contrast ratio of at least 4.5:1

### Incorrect Usage
- ❌ Don't rotate or skew the logo
- ❌ Don't change logo colors arbitrarily
- ❌ Don't add effects (shadows, outlines)
- ❌ Don't place on busy backgrounds
- ❌ Don't alter proportions

## UI Copy Tone of Voice

### Writing Principles
1. **Clear and Direct**: Use simple, unambiguous language
2. **Reassuring**: Calm, confident tone especially in emergencies
3. **Action-Oriented**: Tell users what to do, not just what's happening
4. **Inclusive**: Avoid jargon, write for all literacy levels
5. **Concise**: Every word counts, especially on mobile

### Voice Characteristics
- **Professional** but not bureaucratic
- **Friendly** but not casual
- **Urgent** when needed, but never alarmist
- **Supportive** and empowering

### Example Copy Patterns

#### Error Messages
```
❌ "Error 403: Access Denied"
✅ "You don't have permission to view this. Contact your community admin for access."
```

#### Empty States
```
❌ "No data"
✅ "No emergency alerts in your area. We'll notify you if anything changes."
```

#### CTAs (Call to Action)
```
Primary: "Join Community", "Get Started", "View Details"
Secondary: "Learn More", "Maybe Later", "Skip"
Danger: "Leave Community", "Delete", "Report Issue"
```

#### Notifications
```
Success: "Great! You've joined [Community Name]"
Warning: "Your device is offline. Some features may be limited."
Error: "We couldn't save your changes. Please try again."
Info: "New emergency resources available in your area."
```

## Accessibility Requirements

### WCAG 2.1 AA Compliance
1. **Color Contrast**
   - Normal text: 4.5:1 minimum
   - Large text (18px+): 3:1 minimum
   - Interactive elements: 3:1 minimum
   - Focus indicators: 3:1 minimum

2. **Interactive Elements**
   - Touch targets: 44×44px minimum
   - Keyboard navigable
   - Clear focus states
   - Descriptive labels

3. **Content**
   - Alt text for all images
   - Proper heading hierarchy
   - Descriptive link text
   - Error identification and suggestions

4. **Motion**
   - Respect prefers-reduced-motion
   - No auto-playing videos
   - Pauseable animations
   - No seizure-inducing effects

### Testing Requirements
- Screen reader testing (NVDA, JAWS, VoiceOver)
- Keyboard-only navigation
- Color blind simulator testing
- Mobile accessibility testing

## Component Styling Patterns

### Buttons
```css
/* Primary - Main actions */
.btn-primary {
  background: var(--accent-600);
  color: white;
  font-weight: var(--font-weight-semibold);
}

/* Secondary - Alternative actions */
.btn-secondary {
  background: var(--primary-600);
  color: white;
}

/* Ghost - Tertiary actions */
.btn-ghost {
  background: transparent;
  color: var(--primary-700);
  border: 1px solid currentColor;
}
```

### Cards
```css
.card {
  background: var(--card);
  border-radius: var(--radius);
  border: 1px solid var(--neutral-200);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
}
```

### Alerts
```css
.alert-info { 
  background: var(--primary-100);
  border-left: 4px solid var(--primary-600);
}

.alert-warning {
  background: var(--warning-100);
  border-left: 4px solid var(--warning-600);
}

.alert-danger {
  background: var(--danger-100);
  border-left: 4px solid var(--danger-600);
}
```

## Responsive Design

### Breakpoints
```css
--screen-sm: 640px;   /* Mobile landscape */
--screen-md: 768px;   /* Tablet portrait */
--screen-lg: 1024px;  /* Tablet landscape */
--screen-xl: 1280px;  /* Desktop */
--screen-2xl: 1536px; /* Wide desktop */
```

### Mobile-First Approach
1. Design for 320px minimum width
2. Test on real devices, not just browser tools
3. Prioritize touch interactions
4. Ensure readable text without zooming
5. Optimize for one-handed use

## Implementation Checklist

### Design
- [ ] Logo created in all required formats
- [ ] Color variables implemented in CSS
- [ ] Typography system configured
- [ ] Component library themed
- [ ] Dark mode fully supported

### Development
- [ ] CSS custom properties defined
- [ ] Google Fonts integrated
- [ ] Noto fonts fallback configured
- [ ] Theme toggle implemented
- [ ] Accessibility tested

### Documentation
- [ ] Component examples created
- [ ] Copy patterns documented
- [ ] Accessibility guide shared
- [ ] Brand assets organized