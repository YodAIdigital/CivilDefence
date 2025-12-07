'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Droplet,
  Wind,
  Activity,
  Waves,
  Snowflake,
  Biohazard,
  Zap,
  Shield,
  Phone,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Edit2,
  Mountain,
  Tornado,
  Thermometer,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { WizardData } from '../onboarding-wizard'
import type { DisasterType } from '@/data/guide-templates'
import { guideTemplates } from '@/data/guide-templates'

interface EmergencyContact {
  name: string
  number: string
  description: string
}

interface StepTwoProps {
  data: WizardData
  updateData: (updates: Partial<WizardData>) => void
}

const DISASTER_ICONS: Record<DisasterType, typeof Flame> = {
  fire: Flame,
  flood: Droplet,
  strong_winds: Wind,
  earthquake: Activity,
  tsunami: Waves,
  snow: Snowflake,
  pandemic: Biohazard,
  solar_storm: Zap,
  invasion: Shield,
  volcano: Mountain,
  tornado: Tornado,
  heat_wave: Thermometer,
}

export function StepTwo({ data, updateData }: StepTwoProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEmergencyContacts, setShowEmergencyContacts] = useState(false)
  const [editingContactIndex, setEditingContactIndex] = useState<number | null>(null)
  const [mapImageReady, setMapImageReady] = useState(!!data.regionMapImage)
  const hasAutoAnalyzed = useRef(false)
  const hasGeneratedMapImage = useRef(false)

  // Auto-analyze when map image is ready (or no polygon exists)
  useEffect(() => {
    const shouldAnalyze = !hasAutoAnalyzed.current &&
                          !data.aiAnalysis &&
                          data.location &&
                          !isAnalyzing &&
                          (mapImageReady || !data.regionPolygon || data.regionPolygon.length < 3)

    if (shouldAnalyze) {
      hasAutoAnalyzed.current = true
      handleAnalyze()
    }
  }, [mapImageReady]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnalyze = async () => {
    if (!data.location) {
      setError('Please set a location in Step 1 first')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    console.log('[StepTwo] Analyzing risks with map image:', !!data.regionMapImage, data.regionMapImage ? `(${data.regionMapImage.length} chars)` : '')

    try {
      const response = await fetch('/api/analyze-risks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: data.location,
          latitude: data.meetingPointLat,
          longitude: data.meetingPointLng,
          regionMapImage: data.regionMapImage, // Pass the map image for visual context
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to analyze risks')
      }

      const analysis = await response.json()
      updateData({
        aiAnalysis: analysis,
        selectedRisks: analysis.risks.map((r: any) => r.type)
      })
    } catch (err) {
      console.error('Error analyzing risks:', err)
      setError('Failed to analyze regional risks. Please select risks manually.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const toggleRisk = (riskType: DisasterType) => {
    const isSelected = data.selectedRisks.includes(riskType)
    updateData({
      selectedRisks: isSelected
        ? data.selectedRisks.filter(r => r !== riskType)
        : [...data.selectedRisks, riskType],
    })
  }

  const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950'
      case 'medium':
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950'
      case 'low':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950'
    }
  }

  // Get all emergency contacts from customizations, grouped across all risk types
  const getAllEmergencyContacts = (): EmergencyContact[] => {
    if (!data.guideCustomizations) return []

    const contactsMap = new Map<string, EmergencyContact>()

    // Collect unique contacts from all risk customizations
    Object.values(data.guideCustomizations).forEach((customization: any) => {
      if (customization?.emergencyContacts) {
        customization.emergencyContacts.forEach((contact: EmergencyContact) => {
          // Use name + number as key to dedupe
          const key = `${contact.name}-${contact.number}`
          if (!contactsMap.has(key)) {
            contactsMap.set(key, contact)
          }
        })
      }
    })

    return Array.from(contactsMap.values())
  }

  const updateContactField = (index: number, field: keyof EmergencyContact, value: string) => {
    const contacts = getAllEmergencyContacts()
    const updated: EmergencyContact[] = contacts.map((c, i) =>
      i === index ? { ...c, [field]: value } : c
    )

    if (data.guideCustomizations) {
      const updatedCustomizations = { ...data.guideCustomizations }
      Object.keys(updatedCustomizations).forEach(riskType => {
        updatedCustomizations[riskType] = {
          ...updatedCustomizations[riskType],
          emergencyContacts: updated
        }
      })
      updateData({ guideCustomizations: updatedCustomizations })
    }
  }

  const addEmergencyContact = () => {
    const newContact: EmergencyContact = {
      name: '',
      number: '',
      description: ''
    }
    const contacts = getAllEmergencyContacts()
    const updatedContacts = [...contacts, newContact]

    // Update all customizations with the new contacts list
    if (data.guideCustomizations) {
      const updatedCustomizations = { ...data.guideCustomizations }
      Object.keys(updatedCustomizations).forEach(riskType => {
        updatedCustomizations[riskType] = {
          ...updatedCustomizations[riskType],
          emergencyContacts: updatedContacts
        }
      })
      updateData({ guideCustomizations: updatedCustomizations })
    } else {
      // If no customizations exist, create a base structure
      const baseCustomization: Record<string, any> = {}
      data.selectedRisks.forEach(riskType => {
        baseCustomization[riskType] = { emergencyContacts: updatedContacts }
      })
      updateData({ guideCustomizations: baseCustomization })
    }
    setEditingContactIndex(updatedContacts.length - 1)
  }

  const removeEmergencyContact = (index: number) => {
    const contacts = getAllEmergencyContacts()
    const updatedContacts = contacts.filter((_, i) => i !== index)

    // Update all customizations with the new contacts list
    if (data.guideCustomizations) {
      const updatedCustomizations = { ...data.guideCustomizations }
      Object.keys(updatedCustomizations).forEach(riskType => {
        updatedCustomizations[riskType] = {
          ...updatedCustomizations[riskType],
          emergencyContacts: updatedContacts
        }
      })
      updateData({ guideCustomizations: updatedCustomizations })
    }
    setEditingContactIndex(null)
  }

  const emergencyContacts = getAllEmergencyContacts()

  // Auto-generate map image if we have a polygon but no image (e.g., resuming from saved state)
  // Use ref to prevent infinite loop from updateData dependency
  useEffect(() => {
    const generateMapImage = async () => {
      if (hasGeneratedMapImage.current) return

      // If map image already exists, mark as ready
      if (data.regionMapImage) {
        setMapImageReady(true)
        return
      }

      // If no polygon, mark as ready (analysis can proceed without image)
      if (!data.regionPolygon || data.regionPolygon.length < 3) {
        setMapImageReady(true)
        return
      }

      hasGeneratedMapImage.current = true
      console.log('[StepTwo] Polygon exists but no map image - generating...')
      try {
        const response = await fetch('/api/generate-map-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coordinates: data.regionPolygon,
            meetingPoint: data.meetingPointLat && data.meetingPointLng
              ? { lat: data.meetingPointLat, lng: data.meetingPointLng }
              : null,
            regionColor: data.regionColor || '#FEB100',
          }),
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success && result.imageUrl) {
            console.log('[StepTwo] Map image generated successfully, size:', result.imageUrl.length, 'chars')
            updateData({ regionMapImage: result.imageUrl })
            setMapImageReady(true)
          }
        } else {
          // Even if image generation fails, allow analysis to proceed
          setMapImageReady(true)
        }
      } catch (error) {
        console.error('[StepTwo] Failed to generate map image:', error)
        // Even if image generation fails, allow analysis to proceed
        setMapImageReady(true)
      }
    }

    generateMapImage()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Show loading state while analyzing
  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Analysing Your Region</h3>
          <p className="text-muted-foreground text-sm">
            AI is identifying potential risks and hazards for your area...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Risk Assessment</h3>
        <p className="text-muted-foreground text-sm">
          {data.aiAnalysis
            ? 'AI has analyzed your region. Review the identified risks below.'
            : 'Select the risks relevant to your community area.'}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* AI Analysis Results */}
      {data.aiAnalysis && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h4 className="font-semibold">Analysis Complete</h4>
          </div>

          {/* Regional Information */}
          {data.aiAnalysis.regionalInfo && (
            <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200">
              <h5 className="font-medium text-sm mb-2">Regional Context</h5>
              <p className="text-sm text-muted-foreground">{data.aiAnalysis.regionalInfo}</p>
            </Card>
          )}

          {/* Identified Risks */}
          <div>
            <h5 className="font-medium mb-3">Identified Risks for Your Area</h5>
            <div className="space-y-3">
              {data.aiAnalysis.risks.map((risk, index) => {
                const Icon = DISASTER_ICONS[risk.type]
                const template = guideTemplates.find(t => t.type === risk.type)

                return (
                  <Card key={index} className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`rounded-lg p-2 ${getSeverityColor(risk.severity)}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h6 className="font-medium">{template?.name || risk.type}</h6>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getSeverityColor(risk.severity)}`}>
                            {risk.severity.toUpperCase()} RISK
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{risk.description}</p>
                        {risk.recommendedActions.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium mb-1">Recommended Actions:</p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              {risk.recommendedActions.map((action, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <span className="text-primary">•</span>
                                  <span>{action}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Manual Risk Selection */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h5 className="font-medium">
            {data.aiAnalysis ? 'Adjust Selected Risks' : 'Or Select Risks Manually'}
          </h5>
          <span className="text-sm text-muted-foreground">
            {data.selectedRisks.length} selected
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {guideTemplates.map((template) => {
            const Icon = DISASTER_ICONS[template.type]
            const isSelected = data.selectedRisks.includes(template.type)

            return (
              <Card
                key={template.id}
                className={`p-4 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary'
                    : 'hover:border-primary/50'
                }`}
                onClick={() => toggleRisk(template.type)}
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 bg-gradient-to-br ${template.color}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{(template.name.split('&')[0] ?? template.name).trim()}</p>
                    {isSelected && (
                      <CheckCircle2 className="h-4 w-4 text-primary mt-1" />
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Emergency Contacts Section */}
      {(emergencyContacts.length > 0 || data.guideCustomizations) && (
        <Card className="p-6 border-2">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowEmergencyContacts(!showEmergencyContacts)}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 dark:bg-green-900 p-2">
                <Phone className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h4 className="font-semibold">Emergency Contacts</h4>
                <p className="text-sm text-muted-foreground">
                  {emergencyContacts.length} contact{emergencyContacts.length !== 1 ? 's' : ''} configured for your area
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              {showEmergencyContacts ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </Button>
          </div>

          {showEmergencyContacts && (
            <div className="mt-4 space-y-3">
              {emergencyContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No emergency contacts configured yet. Click &quot;Customize Response Plans&quot; above to auto-populate local emergency contacts, or add them manually.
                </p>
              ) : (
                emergencyContacts.map((contact, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 group"
                  >
                    {editingContactIndex === index ? (
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Contact Name"
                          value={contact.name}
                          onChange={(e) => updateContactField(index, 'name', e.target.value)}
                          className="text-sm"
                        />
                        <Input
                          placeholder="Phone Number"
                          value={contact.number}
                          onChange={(e) => updateContactField(index, 'number', e.target.value)}
                          className="text-sm"
                        />
                        <Input
                          placeholder="Description"
                          value={contact.description}
                          onChange={(e) => updateContactField(index, 'description', e.target.value)}
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => setEditingContactIndex(null)}
                          >
                            Done
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeEmergencyContact(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{contact.name || 'Unnamed Contact'}</span>
                            <span className="text-sm text-primary font-mono">{contact.number}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{contact.description}</p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingContactIndex(index)
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeEmergencyContact(index)
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={addEmergencyContact}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Emergency Contact
              </Button>
            </div>
          )}
        </Card>
      )}

      {data.selectedRisks.length === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please select at least one risk type to continue. You can use AI analysis or select manually.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
