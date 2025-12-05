# Response Plans - Implementation Guide

## Overview

The onboarding wizard now includes AI-powered response plan customization that researches the local area and customizes emergency guides with location-specific information.

## How It Works

### 1. Risk Analysis (Step 2)
When users reach Step 2 of the onboarding wizard, they can:

1. **Auto-detect risks** using "Analyze My Region" button
   - Uses Gemini AI to analyze the location
   - Identifies relevant disaster risks
   - Provides severity ratings and recommendations
   - Automatically selects appropriate response plans

2. **Manual risk selection**
   - Browse 9 disaster types
   - Select relevant risks manually
   - Can add/remove risks after AI analysis

### 2. Response Plan Customization
After selecting risks, users see a new "Customize Response Plans" button:

**What it does:**
- Analyzes each selected risk type
- Researches location-specific information:
  - Local emergency services and contact numbers
  - Geographical considerations (terrain, water bodies)
  - Local evacuation routes and shelter locations
  - Region-specific preparation steps
  - Local resources and community centers

**What gets customized:**
- **Custom Notes**: 2-3 paragraphs about location-specific considerations
- **Local Resources**: Shelters, hospitals, supply points, meeting points
- **Additional Supplies**: Location-specific items to add to checklists
- **Enhanced Sections**: Additional before/during/after guidance

### 3. Guide Creation
When the community is created:
- Base template guides are loaded for each selected risk
- Customizations are merged with templates:
  - Template sections + Enhanced sections
  - Template supplies + Additional supplies
  - Custom notes added to guide
  - Local resources stored for reference
- Guides are saved to `community_guides` table
- All guides are set to `is_active = true`

## API Endpoints

### POST `/api/analyze-risks`
Analyzes regional disaster risks using Gemini AI.

**Request:**
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
      "description": "Explanation of why this risk exists",
      "recommendedActions": ["Action 1", "Action 2", "Action 3"]
    }
  ]
}
```

### POST `/api/customize-guides`
Customizes response plans with location-specific information.

**Request:**
```json
{
  "location": "Wellington, New Zealand",
  "latitude": -41.2865,
  "longitude": 174.7762,
  "selectedRisks": ["earthquake", "tsunami"],
  "aiAnalysis": { /* previous analysis result */ }
}
```

**Response:**
```json
{
  "customizedGuides": [
    {
      "riskType": "earthquake",
      "template": { /* original template */ },
      "customization": {
        "customNotes": "Location-specific information...",
        "localResources": [
          {
            "name": "Wellington Emergency Services",
            "type": "hospital",
            "address": "123 Main St",
            "phone": "+64 4 123 4567",
            "notes": "24/7 emergency department"
          }
        ],
        "additionalSupplies": ["Item 1", "Item 2"],
        "enhancedSections": {
          "before": [{ "title": "...", "content": "...", "icon": "..." }],
          "during": [],
          "after": []
        }
      }
    }
  ]
}
```

## Database Schema

### community_guides Table
```sql
- id: UUID
- community_id: UUID (FK to communities)
- name: VARCHAR(255) -- e.g., "Earthquake Emergency"
- description: TEXT
- icon: VARCHAR(100)
- color: VARCHAR(100)
- guide_type: VARCHAR(50) -- disaster type
- template_id: VARCHAR(100) -- reference to original template
- sections: JSONB -- { before: [], during: [], after: [] }
- supplies: JSONB -- array of supply items
- emergency_contacts: JSONB -- array of contacts
- custom_notes: TEXT -- AI-generated location-specific notes
- local_resources: JSONB -- AI-generated local resources
- is_active: BOOLEAN -- whether guide is visible to members
- display_order: INTEGER
- created_by: UUID
- updated_by: UUID
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

## User Flow

1. **Step 1**: Enter basic community info and meeting point
2. **Step 2**:
   - Click "Analyze My Region" (optional but recommended)
   - Review identified risks
   - Add/remove risks manually
   - Click "Customize Response Plans" (optional but recommended)
   - Wait for AI to research and customize guides
   - See confirmation message
3. **Step 3**: Define community area on map
4. **Step 4**: Setup member groups (optional)
5. **Finish**: Community created with customized guides

## Features

### Automatic Risk Detection
- Uses location to identify relevant disasters
- Considers geographical factors
- Provides severity ratings
- Suggests preparedness actions

### Plan Customization
- Real location-specific information
- Local emergency contacts
- Area-specific evacuation routes
- Regional shelter locations
- Terrain and infrastructure considerations

### Fallback Handling
- If AI is unavailable, uses default templates
- Customization is optional
- Manual risk selection always works
- Graceful error handling

## Configuration

Add to `.env.local`:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

Get a key from: https://makersuite.google.com/app/apikey

## Testing

1. Create a new community with location "Wellington, New Zealand"
2. Click "Analyze My Region" in Step 2
3. Review the identified risks (should include earthquake, tsunami, strong winds)
4. Click "Customize Response Plans"
5. Wait 10-20 seconds for customization
6. Complete wizard and create community
7. Navigate to community guides page
8. Verify guides include location-specific information in:
   - Custom notes section
   - Local resources
   - Additional supplies
   - Enhanced guidance sections

## Troubleshooting

**Issue**: "AI analysis not configured" error
- **Solution**: Add `GEMINI_API_KEY` to `.env.local` and restart server

**Issue**: Customization takes too long
- **Solution**: Normal - processing multiple guides can take 15-30 seconds
- **Workaround**: Skip customization, use default templates

**Issue**: Guides not showing in community
- **Solution**: Check `is_active = true` in database
- **Verify**: User is member of community

**Issue**: No local resources showing
- **Solution**: AI may not have found specific info for small locations
- **Note**: Larger cities will have more detailed customizations

## Future Enhancements

- [ ] Cache customizations for common locations
- [ ] Allow manual editing of AI-generated content
- [ ] Add more resource types (gas stations, pharmacies, etc.)
- [ ] Include real-time data (weather, traffic, alerts)
- [ ] Multi-language support for guides
- [ ] Export guides as PDF with customizations
- [ ] Community-sourced local resource updates
