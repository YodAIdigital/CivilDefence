'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Loader2,
  Sparkles,
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
  Shield
} from 'lucide-react'
import type { WizardData } from '../onboarding-wizard'
import type { DisasterType } from '@/data/guide-templates'
import { guideTemplates } from '@/data/guide-templates'

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
}

export function StepTwo({ data, updateData }: StepTwoProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCustomizing, setIsCustomizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customizationSuccess, setCustomizationSuccess] = useState(false)

  const handleAnalyze = async () => {
    if (!data.location) {
      setError('Please set a location in Step 1 first')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/analyze-risks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: data.location,
          latitude: data.meetingPointLat,
          longitude: data.meetingPointLng,
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
      setError('Failed to analyze regional risks. Please try again or select risks manually.')
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

  const handleCustomizeGuides = async () => {
    if (data.selectedRisks.length === 0) {
      setError('Please select at least one risk type first')
      return
    }

    setIsCustomizing(true)
    setError(null)
    setCustomizationSuccess(false)

    try {
      const response = await fetch('/api/customize-guides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: data.location,
          latitude: data.meetingPointLat,
          longitude: data.meetingPointLng,
          selectedRisks: data.selectedRisks,
          aiAnalysis: data.aiAnalysis,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to customize guides')
      }

      const result = await response.json()

      // Convert array to record keyed by risk type
      const customizations: Record<string, any> = {}
      result.customizedGuides.forEach((guide: any) => {
        if (guide && guide.customization) {
          customizations[guide.riskType] = guide.customization
        }
      })

      updateData({
        guideCustomizations: customizations
      })

      setCustomizationSuccess(true)
      setTimeout(() => setCustomizationSuccess(false), 3000)
    } catch (err) {
      console.error('Error customizing guides:', err)
      setError('Failed to customize response plans. Default templates will be used.')
    } finally {
      setIsCustomizing(false)
    }
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Risk Assessment</h3>
        <p className="text-muted-foreground text-sm">
          Let AI analyze your region to identify potential risks and recommend response plans.
        </p>
      </div>

      {/* AI Analysis Button */}
      {!data.aiAnalysis && (
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-2 border-dashed">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-3">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-2">AI-Powered Risk Analysis</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Use Gemini AI to analyze your location and identify specific risks for your area,
                including natural disasters, seasonal hazards, and regional vulnerabilities.
              </p>
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !data.location}
              size="lg"
              className="gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing Region...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Analyze My Region
                </>
              )}
            </Button>
            {!data.location && (
              <p className="text-xs text-muted-foreground">
                Set your location in Step 1 to enable AI analysis
              </p>
            )}
          </div>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* AI Analysis Results */}
      {data.aiAnalysis && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <h4 className="font-semibold">Analysis Complete</h4>
            </div>
            <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Re-analyze'
              )}
            </Button>
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
                    <p className="font-medium text-sm truncate">{template.name.split('&')[0].trim()}</p>
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

      {/* Customize Response Plans Button */}
      {data.selectedRisks.length > 0 && (
        <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-2 border-dashed border-purple-200">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-purple-100 dark:bg-purple-900 p-3">
              <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-2">Customize Response Plans for Your Area</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Use AI to customize the emergency response plans with location-specific information including local emergency services, shelters, evacuation routes, and region-specific preparation steps for {data.location || 'your area'}.
              </p>
              {customizationSuccess && (
                <Alert className="mb-4 bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Response plans customized successfully! Location-specific information will be included in your guides.
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={handleCustomizeGuides}
                  disabled={isCustomizing}
                  variant={data.guideCustomizations ? "outline" : "default"}
                  className="gap-2"
                >
                  {isCustomizing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Customizing...
                    </>
                  ) : data.guideCustomizations ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Re-customize Plans
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Customize Response Plans
                    </>
                  )}
                </Button>
                {data.guideCustomizations && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Plans customized for {Object.keys(data.guideCustomizations).length} risk(s)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
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
