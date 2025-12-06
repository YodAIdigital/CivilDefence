'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useRole } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  Save,
  RotateCcw,
  Check,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Map,
  FileText,
  Edit3,
  Image,
  Phone,
} from 'lucide-react'
import { AI_FUNCTION_CONFIG, SOCIAL_STYLE_OPTIONS } from '@/types/database'
import type { AIPromptConfig, GeminiModelInfo, AIFunctionType, SocialStyleType } from '@/types/database'

// Menu items to show in the sidebar (grouped view)
interface MenuFunction {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  // For social functions, this maps to the base type (social_post or social_image)
  // For others, it's the actual function type
  baseType: string
  hasStyling: boolean
}

// Available variables for each function type
const FUNCTION_VARIABLES: Record<string, { name: string; description: string }[]> = {
  region_analysis: [
    { name: 'location', description: 'The location name/address being analyzed' },
    { name: 'coordinates', description: 'Formatted coordinates (e.g., "Coordinates: -36.848, 174.763")' },
    { name: 'disaster_types', description: 'Comma-separated list of possible disaster types' },
  ],
  plan_customization: [
    { name: 'communityName', description: 'Name of the community' },
    { name: 'location', description: 'Location/address of the community' },
    { name: 'planType', description: 'Type of emergency plan (e.g., earthquake, flood)' },
    { name: 'existingContent', description: 'The base template content to customize' },
    { name: 'analysisResult', description: 'JSON result from region analysis (risks, regional info)' },
  ],
  social_post: [
    { name: 'communityName', description: 'Name of the community' },
    { name: 'location', description: 'Location/address of the community' },
    { name: 'description', description: 'Community description (optional)' },
  ],
  social_image: [
    { name: 'communityName', description: 'Name of the community' },
    { name: 'location', description: 'Location/address of the community' },
  ],
  emergency_contact_localization: [
    { name: 'country', description: 'Country name' },
    { name: 'region', description: 'Region/State name' },
    { name: 'city', description: 'City or local area name' },
  ],
}

const MENU_FUNCTIONS: MenuFunction[] = [
  {
    id: 'region_analysis',
    label: 'Region Analysis',
    description: 'Analyzes community regions for emergency preparedness',
    icon: <Map className="h-5 w-5" />,
    baseType: 'region_analysis',
    hasStyling: false,
  },
  {
    id: 'plan_customization',
    label: 'Response Plan',
    description: 'Customizes emergency response plans',
    icon: <FileText className="h-5 w-5" />,
    baseType: 'plan_customization',
    hasStyling: false,
  },
  {
    id: 'social_post',
    label: 'Social Post',
    description: 'Generates promotional social media posts',
    icon: <Edit3 className="h-5 w-5" />,
    baseType: 'social_post',
    hasStyling: true,
  },
  {
    id: 'social_image',
    label: 'Social Image',
    description: 'Generates promotional images for social media',
    icon: <Image className="h-5 w-5" />,
    baseType: 'social_image',
    hasStyling: true,
  },
  {
    id: 'emergency_contact_localization',
    label: 'Emergency Contacts',
    description: 'Localizes emergency contacts for regions',
    icon: <Phone className="h-5 w-5" />,
    baseType: 'emergency_contact_localization',
    hasStyling: false,
  },
]


interface ModelsData {
  all: GeminiModelInfo[]
  text: GeminiModelInfo[]
  image: GeminiModelInfo[]
}

export default function AISettingsPage() {
  const router = useRouter()
  const { isLoading: isAuthLoading } = useAuth()
  const { isSuperAdmin } = useRole()

  // Redirect if not super admin
  useEffect(() => {
    if (!isAuthLoading && !isSuperAdmin) {
      router.push('/dashboard')
    }
  }, [isAuthLoading, isSuperAdmin, router])

  const [configs, setConfigs] = useState<AIPromptConfig[]>([])
  const [models, setModels] = useState<ModelsData | null>(null)
  const [selectedMenuFunction, setSelectedMenuFunction] = useState<MenuFunction | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<SocialStyleType>('community')
  const [selectedConfig, setSelectedConfig] = useState<AIPromptConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingModels, setIsLoadingModels] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prompt_template: '',
    model_id: '',
  })

  // Get the function type for the current selection
  const getCurrentFunctionType = useCallback((): AIFunctionType | null => {
    if (!selectedMenuFunction) return null

    if (selectedMenuFunction.hasStyling) {
      return `${selectedMenuFunction.baseType}_${selectedStyle}` as AIFunctionType
    }
    return selectedMenuFunction.baseType as AIFunctionType
  }, [selectedMenuFunction, selectedStyle])

  // Find config by function type
  const findConfigByType = useCallback((functionType: AIFunctionType): AIPromptConfig | null => {
    return configs.find(c => c.function_type === functionType) || null
  }, [configs])

  // Load configuration for current selection
  const loadCurrentConfig = useCallback(() => {
    const functionType = getCurrentFunctionType()
    if (!functionType) return

    const config = findConfigByType(functionType)
    if (config) {
      setSelectedConfig(config)
      setFormData({
        name: config.name,
        description: config.description || '',
        prompt_template: config.prompt_template,
        model_id: config.model_id,
      })
    }
  }, [getCurrentFunctionType, findConfigByType])

  // Load configurations
  const loadConfigs = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/admin/ai-prompts')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load configurations')
      }

      setConfigs(data.configs)

      // Select first menu function if none selected
      if (data.configs.length > 0 && !selectedMenuFunction) {
        setSelectedMenuFunction(MENU_FUNCTIONS[0]!)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configurations')
    } finally {
      setIsLoading(false)
    }
  }, [selectedMenuFunction])

  // Load available models
  const loadModels = useCallback(async () => {
    try {
      setIsLoadingModels(true)

      const response = await fetch('/api/admin/gemini-models')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load models')
      }

      setModels(data.models)
    } catch (err) {
      console.error('Failed to load models:', err)
      // Don't show error for models, just use fallback
    } finally {
      setIsLoadingModels(false)
    }
  }, [])

  useEffect(() => {
    loadConfigs()
    loadModels()
  }, [loadConfigs, loadModels])

  // Update config when menu function or style changes
  useEffect(() => {
    loadCurrentConfig()
  }, [loadCurrentConfig])

  // Select a menu function
  const selectMenuFunction = (menuFunc: MenuFunction) => {
    setSelectedMenuFunction(menuFunc)
    // Reset style to community when switching to a styled function
    if (menuFunc.hasStyling) {
      setSelectedStyle('community')
    }
    setError(null)
    setSuccessMessage(null)
  }

  // Handle style change
  const handleStyleChange = (style: SocialStyleType) => {
    setSelectedStyle(style)
    setError(null)
    setSuccessMessage(null)
  }

  // Save configuration
  const handleSave = async () => {
    if (!selectedConfig) return

    try {
      setIsSaving(true)
      setError(null)
      setSuccessMessage(null)

      const response = await fetch(`/api/admin/ai-prompts/${selectedConfig.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save configuration')
      }

      // Update local state
      setConfigs(prev =>
        prev.map(c => c.id === selectedConfig.id ? data.config : c)
      )
      setSelectedConfig(data.config)
      setSuccessMessage('Configuration saved successfully')

      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setIsSaving(false)
    }
  }

  // Reset to default
  const handleReset = async () => {
    if (!selectedConfig) return
    if (!confirm('Are you sure you want to reset this configuration to the default?')) return

    try {
      setIsSaving(true)
      setError(null)
      setSuccessMessage(null)

      const response = await fetch(`/api/admin/ai-prompts/${selectedConfig.id}`, {
        method: 'PATCH',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset configuration')
      }

      // Update local state
      setConfigs(prev =>
        prev.map(c => c.id === selectedConfig.id ? data.config : c)
      )
      setSelectedConfig(data.config)
      setFormData({
        name: data.config.name,
        description: data.config.description || '',
        prompt_template: data.config.prompt_template,
        model_id: data.config.model_id,
      })
      setSuccessMessage('Configuration reset to default')

      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset configuration')
    } finally {
      setIsSaving(false)
    }
  }

  // Get models for the selected function type
  const getModelsForFunction = (functionType: AIFunctionType): GeminiModelInfo[] => {
    if (!models) return []

    const config = AI_FUNCTION_CONFIG[functionType]
    if (config?.supportsImage) {
      // For image generation, include all models (some can do both)
      return models.all
    }
    return models.text.length > 0 ? models.text : models.all
  }

  // Show loading while auth is checking or if not super admin
  if (isAuthLoading || !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const currentFunctionType = getCurrentFunctionType()

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Settings</h1>
          <p className="text-muted-foreground">
            Configure AI prompts and models for various functions.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadConfigs()
            loadModels()
          }}
          disabled={isLoading || isLoadingModels}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading || isLoadingModels ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
          <Check className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Function List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI Functions</CardTitle>
            <CardDescription>Select a function to configure</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {MENU_FUNCTIONS.map(menuFunc => {
              const isSelected = selectedMenuFunction?.id === menuFunc.id

              return (
                <button
                  key={menuFunc.id}
                  onClick={() => selectMenuFunction(menuFunc)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:bg-muted'
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    {menuFunc.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{menuFunc.label}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {menuFunc.description}
                    </div>
                  </div>
                </button>
              )
            })}
          </CardContent>
        </Card>

        {/* Configuration Editor */}
        {selectedMenuFunction && selectedConfig ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    {selectedMenuFunction.icon}
                  </div>
                  <div>
                    <CardTitle>{selectedMenuFunction.label}</CardTitle>
                    <CardDescription>
                      {selectedMenuFunction.description}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    disabled={isSaving}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to Default
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Style Selection (only for social functions) */}
              {selectedMenuFunction.hasStyling && (
                <div className="space-y-2">
                  <Label>Style Variant</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SOCIAL_STYLE_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleStyleChange(option.value)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          selectedStyle === option.value
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-muted-foreground/30'
                        }`}
                      >
                        <div className="font-medium text-sm">{option.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Each style has its own prompt template. Select a style to edit its configuration.
                  </p>
                </div>
              )}

              {/* Name and Description */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description"
                  />
                </div>
              </div>

              {/* Model Selection */}
              <div className="space-y-2">
                <Label htmlFor="model">AI Model</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.model_id}
                    onValueChange={(value: string) => setFormData(prev => ({ ...prev, model_id: value }))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingModels ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : currentFunctionType ? (
                        getModelsForFunction(currentFunctionType).map(model => (
                          <SelectItem key={model.name} value={model.name}>
                            <div className="flex flex-col">
                              <span>{model.displayName}</span>
                              {model.inputTokenLimit && (
                                <span className="text-xs text-muted-foreground">
                                  {(model.inputTokenLimit / 1000).toFixed(0)}K input / {(model.outputTokenLimit || 0) / 1000}K output
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      ) : null}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={loadModels}
                    disabled={isLoadingModels}
                    title="Refresh models list"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingModels ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Current model: <code className="bg-muted px-1 py-0.5 rounded">{formData.model_id}</code>
                </p>
              </div>

              {/* Prompt Template */}
              <div className="space-y-2">
                <Label htmlFor="prompt">Prompt Template</Label>
                <Textarea
                  id="prompt"
                  value={formData.prompt_template}
                  onChange={e => setFormData(prev => ({ ...prev, prompt_template: e.target.value }))}
                  rows={16}
                  className="font-mono text-sm"
                  placeholder="Enter the prompt template..."
                />
              </div>

              {/* Available Variables */}
              {selectedMenuFunction && FUNCTION_VARIABLES[selectedMenuFunction.baseType] && (
                <div className="space-y-3">
                  <Label>Available Variables</Label>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Use these variables in your prompt template. They will be replaced with actual values at runtime.
                    </p>
                    <div className="grid gap-2">
                      {FUNCTION_VARIABLES[selectedMenuFunction.baseType]!.map(variable => (
                        <div key={variable.name} className="flex items-start gap-3 text-sm">
                          <code className="bg-primary/10 text-primary px-2 py-1 rounded font-mono whitespace-nowrap">
                            {`{{${variable.name}}}`}
                          </code>
                          <span className="text-muted-foreground pt-1">{variable.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="rounded-lg border bg-muted/50 p-4 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Function Type:</span>{' '}
                    <code className="bg-background px-1 py-0.5 rounded">{selectedConfig.function_type}</code>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Updated:</span>{' '}
                    {new Date(selectedConfig.updated_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Select a function to configure</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
