# Onboarding Wizard Fixes

## Issues Fixed

### 1. Step-by-Step Navigation
**Problem**: Wizard was showing all steps at once instead of one at a time.

**Solution**:
- Fixed the layout structure to properly contain each step
- Added visual indicator showing current step number in header
- Improved overflow handling for better responsiveness
- Changed from `min-h-[500px]` to scrollable content area

**Files Modified**:
- [onboarding-wizard.tsx](src/components/community/onboarding-wizard.tsx)

### 2. Region/Area Definition
**Problem**: Step 3 had a custom implementation that didn't match the existing region editor system.

**Solution**:
- Replaced custom polygon drawing implementation with the existing `RegionEditor` component
- This provides the same interface users are familiar with from community management
- Includes all features: drawing, editing, dragging points, search, undo, etc.

**Features Now Available in Step 3**:
- "Start Drawing" button to begin
- Click on map to add points
- Drag points to adjust boundary
- Midpoint markers for adding new points
- Search box to navigate to different areas
- Undo functionality
- Clear and redraw options
- Automatic save to wizard data

**Files Modified**:
- [step-three.tsx](src/components/community/wizard-steps/step-three.tsx)

### 3. Layout and Responsiveness
**Problem**: Wizard layout was not properly responsive and had overflow issues.

**Solutions**:
- Changed outer container to use `min-h-screen flex` layout
- Increased max-width to `max-w-5xl` for better space usage
- Added proper overflow handling for step content
- Fixed nested div structure

## How to Test

1. Navigate to `/community` page
2. Click "Create Community" button
3. Verify the wizard opens in a modal overlay
4. **Step 1 - Basic Information**:
   - Enter community name (e.g., "Geraldine Emergency Response")
   - Add description (optional)
   - Enter location (use autocomplete)
   - Enter meeting point name (e.g., "Community Center")
   - Search for meeting point address OR click on map
   - Verify coordinates appear
   - Click "Next" (should be enabled when required fields are filled)

5. **Step 2 - Risk Assessment**:
   - Click "Analyze My Region" to use AI (requires `GEMINI_API_KEY` in `.env.local`)
   - OR manually select risk types
   - Click "Next" (requires at least 1 risk selected)

6. **Step 3 - Define Area**:
   - Click "Start Drawing"
   - Click on map to add at least 3 points
   - Verify polygon appears
   - Try dragging points to adjust
   - Click "Save Region"
   - Click "Next" (requires polygon with 3+ points)

7. **Step 4 - Setup Groups**:
   - Click suggested groups or create custom
   - Add/edit/delete groups
   - Click "Finish"

8. Verify community is created and redirects to management page

## Validation Rules

Each step has validation that must pass before proceeding:

- **Step 1**: Community name, meeting point name, and coordinates required
- **Step 2**: At least 1 risk type must be selected
- **Step 3**: Polygon with minimum 3 points required
- **Step 4**: Optional (can skip or add groups)

## Known Issues

### Google Maps Console Warnings
You may see these warnings in the console:
```
Google Maps JavaScript API: A mapId is present, map styles are controlled via the Cloud Console
```

These are informational warnings from Google Maps and don't affect functionality. They can be ignored or the map ID can be configured in Google Cloud Console if desired.

### API Key Configuration
Make sure your `.env.local` has:
```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
GEMINI_API_KEY=your_gemini_key_here  # Optional, for AI features
```

And that your Google Maps API key has these APIs enabled:
- Maps JavaScript API
- Places API
- Geocoding API

## Future Enhancements

- [ ] Add progress save/resume capability (draft communities)
- [ ] Add skip option for optional steps
- [ ] Add tooltips for each field
- [ ] Add example communities to learn from
- [ ] Add video tutorial link
- [ ] Add ability to import existing emergency plans

## Component Architecture

```
OnboardingWizard (Main Container)
├── Header (Title + Current Step)
├── Progress Indicator (Steps 1-4)
├── Step Content (Conditional Rendering)
│   ├── StepOne (Basic Info)
│   ├── StepTwo (Risk Assessment)
│   ├── StepThree (Area Definition - uses RegionEditor)
│   └── StepFour (Groups Setup)
└── Footer (Cancel / Back / Next / Finish buttons)
```

## Data Flow

1. User completes each step
2. Data is stored in `wizardData` state
3. On "Finish", `handleWizardComplete` in community page:
   - Creates community record
   - Adds user as admin member
   - Creates groups (if any)
   - Saves selected risks and AI analysis to settings
   - Redirects to community management page
