/**
 * AI Prompt Configuration Library
 *
 * This module handles storing and retrieving AI prompt configurations from Supabase.
 * Configurations are stored in the ai_prompt_configs table.
 */

import { createAdminClient } from '@/lib/supabase/server'
import type { AIPromptConfig, AIFunctionType, CreateAIPromptConfig, UpdateAIPromptConfig } from '@/types/database'

// Default prompt templates for each function
export const DEFAULT_PROMPTS: Record<AIFunctionType, { name: string; description: string; prompt_template: string; model_id: string }> = {
  region_analysis: {
    name: 'Region Analysis',
    description: 'Analyzes a community region for disaster risk assessment',
    model_id: 'gemini-2.0-flash',
    prompt_template: `You are an emergency preparedness expert analyzing regional disaster risks.

Location: {{location}}
{{coordinates}}

Analyze this specific region and provide a comprehensive risk assessment for emergency preparedness planning. Consider:

1. Geographic factors (elevation, proximity to water, geology, climate)
2. Historical disaster patterns in this specific area
3. Seasonal risks and weather patterns
4. Infrastructure and urban planning considerations
5. Regional vulnerabilities

For each relevant disaster type from this list: {{disaster_types}}

Provide your response in this exact JSON format:
{
  "regionalInfo": "A 2-3 sentence overview of the region's geographic and climate context",
  "risks": [
    {
      "type": "earthquake",
      "severity": "high",
      "description": "Brief explanation of why this risk exists in this region",
      "recommendedActions": ["Specific action 1", "Specific action 2", "Specific action 3"]
    }
  ]
}

Rules:
- Only include risks that are genuinely relevant to this specific location
- Severity must be: "low", "medium", or "high"
- Type must match exactly from the list provided
- Include 3-5 specific, actionable recommendations per risk
- Focus on realistic, location-specific threats
- Order risks by severity (high to low)
- Return ONLY the JSON, no additional text

JSON response:`,
  },
  plan_customization: {
    name: 'Response Plan Customization',
    description: 'Customizes emergency response plans for specific communities',
    model_id: 'gemini-2.0-flash',
    prompt_template: `Customize this emergency response plan for the community:

Community: {{communityName}}
Location: {{location}}
Plan Type: {{planType}}
Existing Plan: {{existingContent}}

{{analysisResult}}

Customize the plan to:
1. Include local landmarks and resources
2. Reference local emergency services
3. Account for regional hazards and risks identified in the analysis
4. Account for very localised hazards within the region (based on historical knowledge of towns or villages, and geographical features, within the covered region)
5. Make it specific to the community's needs

- Maintain the original structure but localise the content.
- Write using British English spelling`,
  },
  // Social Post - Community Style
  social_post_community: {
    name: 'Social Post - Community',
    description: 'Warm, welcoming tone for community-focused posts',
    model_id: 'gemini-2.0-flash',
    prompt_template: `Write a warm, welcoming Facebook post to promote a community emergency preparedness group.

Community Name: {{communityName}}
Location: {{location}}
Description: {{description}}

STYLE: Community-focused, warm and welcoming
- Use friendly, inclusive language ("we", "together", "our community")
- Emphasize neighbors helping neighbors
- Focus on connection and belonging
- Warm, inviting tone like welcoming someone to your home

Requirements:
- Start with a friendly emoji and warm greeting
- Mention the community name and location naturally
- List 3-4 benefits focusing on community connection (✅)
- Include an inviting call to action
- Add 4-5 relevant hashtags at the end
- Keep it under 300 words

Write ONLY the post text, no explanations or alternatives.`,
  },
  // Social Post - Professional Style
  social_post_professional: {
    name: 'Social Post - Professional',
    description: 'Trust-inspiring, formal tone for professional posts',
    model_id: 'gemini-2.0-flash',
    prompt_template: `Write a professional, trust-inspiring Facebook post to promote a community emergency preparedness group.

Community Name: {{communityName}}
Location: {{location}}
Description: {{description}}

STYLE: Professional and authoritative
- Use formal, credible language
- Emphasize expertise and preparedness
- Focus on safety, planning, and reliability
- Tone of a trusted emergency services organization

Requirements:
- Start with a professional hook about preparedness
- Mention the community name and location with authority
- List 3-4 benefits focusing on safety and preparedness (✅)
- Include a clear, professional call to action
- Add 4-5 relevant hashtags at the end
- Keep it under 300 words

Write ONLY the post text, no explanations or alternatives.`,
  },
  // Social Post - Emergency Style
  social_post_emergency: {
    name: 'Social Post - Emergency',
    description: 'Safety-focused theme for emergency awareness posts',
    model_id: 'gemini-2.0-flash',
    prompt_template: `Write an urgent, safety-focused Facebook post to promote a community emergency preparedness group.

Community Name: {{communityName}}
Location: {{location}}
Description: {{description}}

STYLE: Emergency-focused, urgent but not alarmist
- Use action-oriented language
- Emphasize being prepared BEFORE emergencies happen
- Focus on safety, protection, and readiness
- Urgent tone that motivates action without causing panic

Requirements:
- Start with attention-grabbing safety message
- Mention the community name and location with urgency
- List 3-4 benefits focusing on emergency readiness (✅)
- Include a strong call to action about preparedness
- Add 4-5 relevant hashtags at the end
- Keep it under 300 words

Write ONLY the post text, no explanations or alternatives.`,
  },
  // Social Post - Modern Style
  social_post_modern: {
    name: 'Social Post - Modern',
    description: 'Minimalist, clean style for modern appeal',
    model_id: 'gemini-2.0-flash',
    prompt_template: `Write a clean, modern Facebook post to promote a community emergency preparedness group.

Community Name: {{communityName}}
Location: {{location}}
Description: {{description}}

STYLE: Modern and minimalist
- Use concise, punchy language
- Short sentences and clean formatting
- Focus on smart, practical benefits
- Contemporary tone appealing to younger demographics

Requirements:
- Start with a bold, concise statement
- Mention the community name and location efficiently
- List 3-4 benefits in short, punchy points (✅)
- Include a simple, direct call to action
- Add 4-5 relevant hashtags at the end
- Keep it under 250 words - brevity is key

Write ONLY the post text, no explanations or alternatives.`,
  },
  // Social Image - Community Style
  social_image_community: {
    name: 'Social Image - Community',
    description: 'Warm, welcoming imagery for community groups',
    model_id: 'gemini-2.0-flash-exp-image-generation',
    prompt_template: `Create a warm, welcoming social media graphic for an emergency preparedness community group.

Community: {{communityName}}
Location: {{location}}

STYLE: Community-focused, warm and welcoming
- Warm color palette (oranges, yellows, soft blues)
- Imagery suggesting togetherness and connection
- Friendly, approachable design
- Icons of people, hands, homes, hearts

Design requirements:
- Include text overlay with the community name
- Tagline: "Together, We're Prepared"
- 1:1 square aspect ratio for Facebook
- Welcoming, inclusive visual style
- Use stylized illustrations, NOT realistic photos
- Do NOT include realistic human faces

Theme: Community connection and mutual support`,
  },
  // Social Image - Professional Style
  social_image_professional: {
    name: 'Social Image - Professional',
    description: 'Trust-inspiring, formal imagery',
    model_id: 'gemini-2.0-flash-exp-image-generation',
    prompt_template: `Create a professional, authoritative social media graphic for an emergency preparedness community group.

Community: {{communityName}}
Location: {{location}}

STYLE: Professional and trustworthy
- Professional color palette (navy, dark blue, silver, white)
- Clean, corporate-style design
- Authority-inspiring imagery
- Icons of shields, checkmarks, official symbols

Design requirements:
- Include text overlay with the community name
- Tagline: "Be Prepared. Stay Protected."
- 1:1 square aspect ratio for Facebook
- Professional, polished visual style
- Use clean geometric shapes and icons
- Do NOT include realistic human faces

Theme: Professional emergency preparedness and safety`,
  },
  // Social Image - Emergency Style
  social_image_emergency: {
    name: 'Social Image - Emergency',
    description: 'Safety-focused emergency preparedness imagery',
    model_id: 'gemini-2.0-flash-exp-image-generation',
    prompt_template: `Create an attention-grabbing, safety-focused social media graphic for an emergency preparedness community group.

Community: {{communityName}}
Location: {{location}}

STYLE: Emergency and safety focused
- Alert color palette (red, orange, yellow, black)
- Bold, attention-grabbing design
- Safety and warning imagery
- Icons of emergency symbols, sirens, shields, first aid

Design requirements:
- Include text overlay with the community name
- Tagline: "Ready When It Matters"
- 1:1 square aspect ratio for Facebook
- Bold, high-contrast visual style
- Use emergency-themed icons and symbols
- Do NOT include realistic human faces

Theme: Emergency readiness and safety awareness`,
  },
  // Social Image - Modern Style
  social_image_modern: {
    name: 'Social Image - Modern',
    description: 'Minimalist, clean modern design',
    model_id: 'gemini-2.0-flash-exp-image-generation',
    prompt_template: `Create a clean, minimalist social media graphic for an emergency preparedness community group.

Community: {{communityName}}
Location: {{location}}

STYLE: Modern and minimalist
- Minimal color palette (2-3 colors max)
- Clean lines and lots of white space
- Simple, elegant typography
- Minimal iconography, abstract shapes

Design requirements:
- Include text overlay with the community name
- Tagline: "Smart. Prepared. Connected."
- 1:1 square aspect ratio for Facebook
- Minimalist, contemporary visual style
- Use simple geometric shapes
- Do NOT include realistic human faces

Theme: Modern, tech-savvy emergency preparedness`,
  },
  emergency_contact_localization: {
    name: 'Emergency Contact Localization',
    description: 'Localizes emergency contacts for specific regions',
    model_id: 'gemini-2.0-flash',
    prompt_template: `Generate localized emergency contacts for this region:

Country: {{country}}
Region/State: {{region}}
City/Area: {{city}}

Provide a JSON array of emergency contacts with:
- name: Service name (e.g., "Emergency Services", "Police", "Fire", "Ambulance")
- number: Local phone number
- description: Brief description

Include:
1. Primary emergency number (like 111, 911, 999)
2. Police non-emergency
3. Fire service
4. Medical/Ambulance
5. Local council/Civil Defence if applicable

Return ONLY valid JSON, no markdown or explanation.`,
  },
}

// Initialize default configurations if none exist
export async function initializeDefaults(userId: string): Promise<AIPromptConfig[]> {
  const supabase = createAdminClient()

  // Check if any configs exist
  const { data: existing } = await supabase
    .from('ai_prompt_configs')
    .select('id')
    .limit(1)

  if (existing && existing.length > 0) {
    // Return all existing configs
    const { data: allConfigs } = await supabase
      .from('ai_prompt_configs')
      .select('*')
      .order('function_type')
    return allConfigs || []
  }

  // Insert all default configurations
  const defaults = Object.entries(DEFAULT_PROMPTS).map(([type, config]) => ({
    function_type: type,
    name: config.name,
    description: config.description,
    prompt_template: config.prompt_template,
    model_id: config.model_id,
    is_active: true,
    created_by: userId === 'system' ? null : userId,
  }))

  const { data: inserted, error } = await supabase
    .from('ai_prompt_configs')
    .insert(defaults)
    .select()

  if (error) {
    console.error('Error initializing AI prompt defaults:', error)
    throw error
  }

  return inserted || []
}

// Get all configurations
export async function getAllPromptConfigs(): Promise<AIPromptConfig[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('ai_prompt_configs')
    .select('*')
    .order('function_type')

  if (error) {
    console.error('Error fetching AI prompts:', error)
    throw error
  }

  return data || []
}

// Get configuration by function type
export async function getPromptConfigByType(functionType: AIFunctionType): Promise<AIPromptConfig | null> {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('ai_prompt_configs')
      .select('*')
      .eq('function_type', functionType)
      .eq('is_active', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - try to get from defaults and insert
        const defaultConfig = DEFAULT_PROMPTS[functionType]
        if (defaultConfig) {
          const { data: inserted } = await supabase
            .from('ai_prompt_configs')
            .insert({
              function_type: functionType,
              name: defaultConfig.name,
              description: defaultConfig.description,
              prompt_template: defaultConfig.prompt_template,
              model_id: defaultConfig.model_id,
              is_active: true,
            })
            .select()
            .single()
          return inserted
        }
        return null
      }
      // If table doesn't exist (PGRST205) or other error, return null to use defaults
      if (error.code === 'PGRST205') {
        console.warn('[ai-prompts] Table ai_prompt_configs not found, using defaults')
        return null
      }
      console.error('Error fetching AI prompt by type:', error)
      // Return null instead of throwing - graceful fallback to defaults
      return null
    }

    return data
  } catch (err) {
    // Graceful fallback - if anything goes wrong, use defaults
    console.warn('[ai-prompts] Error fetching prompt config, using defaults:', err)
    return null
  }
}

// Get configuration by ID
export async function getPromptConfigById(id: string): Promise<AIPromptConfig | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('ai_prompt_configs')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching AI prompt by ID:', error)
    throw error
  }

  return data
}

// Create a new configuration
export async function createPromptConfig(data: CreateAIPromptConfig): Promise<AIPromptConfig> {
  const supabase = createAdminClient()

  const { data: created, error } = await supabase
    .from('ai_prompt_configs')
    .insert({
      function_type: data.function_type,
      name: data.name,
      description: data.description || null,
      prompt_template: data.prompt_template,
      model_id: data.model_id,
      is_active: data.is_active ?? true,
      created_by: data.created_by === 'system' ? null : data.created_by,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating AI prompt:', error)
    throw error
  }

  return created
}

// Update a configuration
export async function updatePromptConfig(id: string, data: UpdateAIPromptConfig): Promise<AIPromptConfig | null> {
  const supabase = createAdminClient()

  // Build update object with only defined values
  const updates: Record<string, unknown> = {}
  if (data.name !== undefined) updates.name = data.name
  if (data.description !== undefined) updates.description = data.description
  if (data.prompt_template !== undefined) updates.prompt_template = data.prompt_template
  if (data.model_id !== undefined) updates.model_id = data.model_id
  if (data.is_active !== undefined) updates.is_active = data.is_active
  if (data.updated_by !== undefined) updates.updated_by = data.updated_by === 'system' ? null : data.updated_by

  const { data: updated, error } = await supabase
    .from('ai_prompt_configs')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error updating AI prompt:', error)
    throw error
  }

  return updated
}

// Delete a configuration
export async function deletePromptConfig(id: string): Promise<boolean> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('ai_prompt_configs')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting AI prompt:', error)
    throw error
  }

  return true
}

// Reset a configuration to default
export async function resetPromptConfigToDefault(functionType: AIFunctionType, userId: string): Promise<AIPromptConfig | null> {
  const defaultConfig = DEFAULT_PROMPTS[functionType]
  if (!defaultConfig) {
    return null
  }

  const supabase = createAdminClient()

  // Update the existing config or insert if not exists
  const { data: existing } = await supabase
    .from('ai_prompt_configs')
    .select('id')
    .eq('function_type', functionType)
    .single()

  if (existing) {
    // Update existing
    const { data: updated, error } = await supabase
      .from('ai_prompt_configs')
      .update({
        name: defaultConfig.name,
        description: defaultConfig.description,
        prompt_template: defaultConfig.prompt_template,
        model_id: defaultConfig.model_id,
        is_active: true,
        updated_by: userId === 'system' ? null : userId,
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      console.error('Error resetting AI prompt:', error)
      throw error
    }

    return updated
  } else {
    // Insert new
    const { data: inserted, error } = await supabase
      .from('ai_prompt_configs')
      .insert({
        function_type: functionType,
        name: defaultConfig.name,
        description: defaultConfig.description,
        prompt_template: defaultConfig.prompt_template,
        model_id: defaultConfig.model_id,
        is_active: true,
        created_by: userId === 'system' ? null : userId,
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting default AI prompt:', error)
      throw error
    }

    return inserted
  }
}
