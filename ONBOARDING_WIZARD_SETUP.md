# Community Onboarding Wizard - Setup Guide

## Overview

The new Community Onboarding Wizard provides a comprehensive 4-step process for creating emergency response communities with AI-powered risk assessment, interactive mapping, and organizational group setup.

## Features

### Step 1: Basic Information
- Community name and description
- General location with autocomplete
- Meeting point setup with:
  - Address search with Google Maps autocomplete
  - Interactive map with click-to-place marker
  - Coordinates display

### Step 2: AI-Powered Risk Assessment
- **Gemini AI Integration**: Analyzes your region for specific disaster risks
- Regional context and geographical analysis
- Identifies relevant risks from:
  - Fire & Wildfires
  - Flooding
  - Strong Winds/Hurricanes
  - Earthquakes
  - Tsunamis
  - Snow/Winter Storms
  - Pandemics
  - Solar Storms
  - Invasion/Security Threats
- Provides:
  - Risk severity ratings (low/medium/high)
  - Detailed descriptions
  - Recommended preparedness actions
- Manual risk selection as fallback

### Step 3: Map-Based Area Definition
- Interactive polygon drawing on Google Maps
- Click to add boundary points (minimum 3)
- Visual customization:
  - Color picker with presets
  - Opacity slider
- Area calculation (displays in km² or m²)
- Meeting point overlay for reference

### Step 4: Member Groups Setup
- Create custom organizational groups
- Quick-add suggested groups:
  - Leadership Team
  - First Responders
  - Communication Team
  - Logistics Team
  - Vulnerable Members
  - Volunteers
- Each group includes:
  - Name and description
  - Color coding
  - Icon selection

## Setup Instructions

### 1. Install Dependencies

The required package has already been installed:

```bash
npm install @google/generative-ai
```

### 2. Get Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key

### 3. Configure Environment Variables

Add to your `.env.local` file:

```bash
# Google Gemini AI Configuration
GEMINI_API_KEY=your_actual_api_key_here
```

**Important**: Never commit your actual API key to version control!

### 4. Verify Google Maps Setup

Ensure you have Google Maps configured in `.env.local`:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

Make sure your Google Maps API key has these APIs enabled:
- Maps JavaScript API
- Places API
- Geocoding API

### 5. Database Tables

The wizard uses existing tables from `supabase_fix.sql`:
- `communities` - Main community data
- `community_members` - Member relationships
- `community_groups` - Organizational groups
- `community_group_members` - Group membership

All necessary columns are already in place:
- `meeting_point_name`, `meeting_point_address`, `meeting_point_lat`, `meeting_point_lng`
- `region_polygon`, `region_color`, `region_opacity`
- `settings` (JSON) - Stores enabled guides and AI analysis

### 6. Test the Wizard

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/community`

3. Click "Create Community"

4. Complete all 4 steps:
   - ✅ Step 1: Enter basic info and set meeting point
   - ✅ Step 2: Click "Analyze My Region" (requires valid Gemini API key)
   - ✅ Step 3: Draw your community boundary on the map
   - ✅ Step 4: Add member groups (optional)

5. Click "Finish" to create the community

## API Endpoints

### POST `/api/analyze-risks`

Analyzes regional disaster risks using Gemini AI.

**Request Body:**
```json
{
  "location": "Wellington, New Zealand",
  "latitude": -41.2865,
  "longitude": 174.7762
}
```

**Response:**
```json
{
  "regionalInfo": "Wellington is located on active fault lines...",
  "risks": [
    {
      "type": "earthquake",
      "severity": "high",
      "description": "Wellington sits on the Pacific Ring of Fire...",
      "recommendedActions": [
        "Secure heavy furniture to walls",
        "Create evacuation plans",
        "Stockpile emergency supplies"
      ]
    }
  ]
}
```

## Component Structure

```
src/components/community/
├── onboarding-wizard.tsx        # Main wizard container
└── wizard-steps/
    ├── step-one.tsx             # Basic info & meeting point
    ├── step-two.tsx             # AI risk assessment
    ├── step-three.tsx           # Area definition
    └── step-four.tsx            # Groups setup

src/app/api/
└── analyze-risks/
    └── route.ts                 # Gemini AI integration endpoint
```

## Usage in Code

```tsx
import { OnboardingWizard, type WizardData } from '@/components/community/onboarding-wizard'

function MyComponent() {
  const handleComplete = async (data: WizardData) => {
    // Create community with wizard data
    console.log(data)
  }

  return (
    <OnboardingWizard
      userId={currentUserId}
      onComplete={handleComplete}
      onCancel={() => setShowWizard(false)}
    />
  )
}
```

## Troubleshooting

### AI Analysis Not Working

1. **Check API Key**: Verify `GEMINI_API_KEY` is set in `.env.local`
2. **API Quota**: Check you haven't exceeded Gemini's free tier limits
3. **Restart Server**: After adding env variables, restart Next.js dev server
4. **Check Console**: Look for errors in browser console and server logs

### Map Not Loading

1. **API Key**: Verify `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set
2. **APIs Enabled**: Ensure Maps JavaScript API is enabled in Google Cloud Console
3. **Billing**: Verify billing is enabled for your Google Cloud project

### Polygon Drawing Issues

- Minimum 3 points required to create a valid area
- Click "Finish Drawing" after placing at least 3 points
- Use "Clear & Redraw" to start over

## Future Enhancements

- [ ] Import KML/GeoJSON for area boundaries
- [ ] Pre-fill groups based on community size
- [ ] Save partial progress (draft communities)
- [ ] Export wizard data as PDF summary
- [ ] Integration with existing emergency plans
- [ ] Multi-language support for AI analysis

## Support

For issues or questions:
1. Check the console for error messages
2. Verify all environment variables are set
3. Ensure database tables exist (run `supabase_fix.sql`)
4. Check that Google Maps and Gemini APIs are accessible

## License

Part of the Civil Defence Expo project.
