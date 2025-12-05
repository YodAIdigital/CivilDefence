# Onboarding Wizard Step 1 Simplification

## Changes Made

### 1. Simplified Step 1 Interface

**Removed:**
- Interactive Google Map showing meeting point
- "General Location" field (separate from meeting point)
- MapPin icon and handleLocationSelect function
- GoogleMap component imports

**Kept:**
- Community Name (required)
- Description (optional)
- Meeting Point Name (required)
- Meeting Point Address (required with autocomplete)

**Benefits:**
- Cleaner, more focused interface
- Faster to complete
- Less confusing for users
- Single source of truth for location (meeting point address)

### 2. Fixed Map Not Loading on Dashboard

**Problem:**
The region polygon was being saved correctly, but the map on the dashboard wasn't centering properly because the `latitude` and `longitude` fields were not being set during community creation.

**Root Cause:**
- The wizard saves `meeting_point_lat` and `meeting_point_lng` ✓
- The wizard saves `region_polygon` ✓
- BUT the wizard was NOT setting `latitude` and `longitude` fields ✗

The RegionEditor component in the manage page uses `community.latitude` and `community.longitude` as the map center:

```typescript
// From manage/page.tsx line 2477
center={community?.latitude && community?.longitude
  ? { lat: community.latitude, lng: community.longitude }
  : undefined
}
```

**Solution:**
Added latitude and longitude fields to community creation:

```typescript
// src/app/(auth)/community/page.tsx
const { data: community, error: communityError } = await supabase
  .from('communities')
  .insert({
    name: wizardData.communityName,
    description: wizardData.description || null,
    location: wizardData.location || null,
    latitude: wizardData.meetingPointLat,    // ← ADDED
    longitude: wizardData.meetingPointLng,   // ← ADDED
    is_public: true,
    created_by: user.id,
    meeting_point_name: wizardData.meetingPointName,
    meeting_point_address: wizardData.meetingPointAddress,
    meeting_point_lat: wizardData.meetingPointLat,
    meeting_point_lng: wizardData.meetingPointLng,
    region_polygon: wizardData.regionPolygon,
    region_color: wizardData.regionColor,
    region_opacity: wizardData.regionOpacity,
  })
```

Now both sets of coordinates are saved:
- `latitude`/`longitude` - Used for map centering in RegionEditor
- `meeting_point_lat`/`meeting_point_lng` - Used for meeting point marker

### 3. Improved User Experience in Step 1

**Enhanced feedback:**
- Added visual confirmation when location is selected
- Shows coordinates with a green checkmark icon
- Clearer helper text explaining what to do

```typescript
{data.meetingPointLat && data.meetingPointLng && (
  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
    <MapPinned className="h-3 w-3" />
    Location confirmed: {data.meetingPointLat.toFixed(6)}, {data.meetingPointLng.toFixed(6)}
  </p>
)}
```

**Auto-populate location:**
When user selects a meeting point address, the `location` field (used for AI analysis in Step 2) is automatically populated if it's empty:

```typescript
const handleMeetingPointSelect = (result: AddressResult) => {
  updateData({
    meetingPointAddress: result.formattedAddress,
    meetingPointLat: result.lat,
    meetingPointLng: result.lng,
    // Use meeting point address as location if location is empty
    location: data.location || result.formattedAddress,
  })
}
```

## Files Modified

1. **src/components/community/wizard-steps/step-one.tsx**
   - Removed map and general location field
   - Simplified layout to single column
   - Added location confirmation feedback
   - Auto-populate location from meeting point

2. **src/app/(auth)/community/page.tsx**
   - Added `latitude` and `longitude` to community insert
   - Ensures map centers correctly on dashboard

## Testing

To verify these changes work:

1. **Test Step 1 Simplification:**
   - Navigate to `/community`
   - Click "Create Community"
   - Verify Step 1 shows only: name, description, meeting point name, meeting point address
   - No map should be visible
   - Select a meeting point address from autocomplete
   - Verify green confirmation message appears with coordinates

2. **Test Dashboard Map:**
   - Complete the wizard and create a community
   - Go to Step 3 and draw a region polygon
   - Finish creating the community
   - Navigate to the community management page
   - Scroll to "Community Region" section
   - Verify the map loads and centers on your meeting point
   - Verify the region polygon is visible on the map

## Database Fields

Communities table now properly populates:
- `latitude`, `longitude` - General center point for map views
- `meeting_point_lat`, `meeting_point_lng` - Specific meeting point marker
- `region_polygon` - Boundary polygon
- `region_color` - Polygon fill color
- `region_opacity` - Polygon transparency
- `location` - Text description (auto-populated from meeting point)

All fields work together to provide complete location context.
