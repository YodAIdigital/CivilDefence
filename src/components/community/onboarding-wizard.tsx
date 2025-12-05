'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, Check, RotateCcw, Trash2 } from 'lucide-react'
import { StepOne } from './wizard-steps/step-one'
import { StepTwo } from './wizard-steps/step-two'
import { StepThree } from './wizard-steps/step-three'
import { StepFour } from './wizard-steps/step-four'
import type { DisasterType } from '@/data/guide-templates'

const WIZARD_STORAGE_KEY = 'civildefence_wizard_draft'

export interface WizardData {
  // Step 1: Basic Info
  communityName: string
  description: string
  location: string
  meetingPointName: string
  meetingPointAddress: string
  meetingPointLat: number | null
  meetingPointLng: number | null

  // Step 2: Risk Assessment
  selectedRisks: DisasterType[]
  aiAnalysis: {
    risks: Array<{
      type: DisasterType
      severity: 'low' | 'medium' | 'high'
      description: string
      recommendedActions: string[]
    }>
    regionalInfo: string
  } | null
  guideCustomizations: Record<string, any> | null

  // Step 3: Area Definition
  regionPolygon: Array<{ lat: number; lng: number }> | null
  regionColor: string
  regionOpacity: number

  // Step 4: Groups
  groups: Array<{
    name: string
    description: string
    color: string
    icon: string
  }>
}

interface SavedWizardState {
  data: WizardData
  currentStep: number
  savedAt: string
}

interface OnboardingWizardProps {
  userId?: string
  onComplete: (data: WizardData) => Promise<void>
  onCancel: () => void
}

const STEPS = [
  { id: 1, name: 'Basic Info', description: 'Community name and meeting point' },
  { id: 2, name: 'Risk Assessment', description: 'AI-powered regional analysis' },
  { id: 3, name: 'Define Area', description: 'Map your community boundaries' },
  { id: 4, name: 'Setup Groups', description: 'Organize your members' },
]

const DEFAULT_WIZARD_DATA: WizardData = {
  communityName: '',
  description: '',
  location: '',
  meetingPointName: '',
  meetingPointAddress: '',
  meetingPointLat: null,
  meetingPointLng: null,
  selectedRisks: [],
  aiAnalysis: null,
  guideCustomizations: null,
  regionPolygon: null,
  regionColor: '#3B82F6',
  regionOpacity: 0.3,
  groups: [],
}

// Helper to check if there's meaningful progress
function hasProgress(data: WizardData): boolean {
  return (
    data.communityName.trim() !== '' ||
    data.meetingPointName.trim() !== '' ||
    data.meetingPointAddress.trim() !== '' ||
    data.selectedRisks.length > 0 ||
    (data.regionPolygon !== null && data.regionPolygon.length > 0) ||
    data.groups.length > 0
  )
}

export function OnboardingWizard({ onComplete, onCancel }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResumePrompt, setShowResumePrompt] = useState(false)
  const [savedState, setSavedState] = useState<SavedWizardState | null>(null)
  const [wizardData, setWizardData] = useState<WizardData>(DEFAULT_WIZARD_DATA)
  const [isInitialized, setIsInitialized] = useState(false)

  // Load saved state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WIZARD_STORAGE_KEY)
      console.log('[Wizard] Loading saved state:', saved ? 'found' : 'none')
      if (saved) {
        const parsed: SavedWizardState = JSON.parse(saved)
        console.log('[Wizard] Parsed state:', parsed)
        console.log('[Wizard] Has progress:', hasProgress(parsed.data))
        // Check if saved data has meaningful progress
        if (hasProgress(parsed.data)) {
          setSavedState(parsed)
          setShowResumePrompt(true)
        } else {
          // No meaningful progress, clear it
          localStorage.removeItem(WIZARD_STORAGE_KEY)
        }
      }
    } catch (error) {
      console.error('Failed to load wizard state:', error)
      localStorage.removeItem(WIZARD_STORAGE_KEY)
    }
    // Mark as initialized after load attempt
    setIsInitialized(true)
  }, [])

  // Save state to localStorage whenever it changes
  const saveState = useCallback(() => {
    console.log('[Wizard] saveState called, hasProgress:', hasProgress(wizardData))
    if (hasProgress(wizardData)) {
      const state: SavedWizardState = {
        data: wizardData,
        currentStep,
        savedAt: new Date().toISOString(),
      }
      try {
        localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(state))
        console.log('[Wizard] State saved successfully:', state)
      } catch (error) {
        console.error('Failed to save wizard state:', error)
      }
    }
  }, [wizardData, currentStep])

  // Auto-save on data or step changes
  useEffect(() => {
    // Don't save if we're showing the resume prompt or not yet initialized
    console.log('[Wizard] Auto-save effect - isInitialized:', isInitialized, 'showResumePrompt:', showResumePrompt)
    if (isInitialized && !showResumePrompt) {
      saveState()
    }
  }, [wizardData, currentStep, showResumePrompt, saveState, isInitialized])

  // Clear saved state on completion
  const clearSavedState = useCallback(() => {
    localStorage.removeItem(WIZARD_STORAGE_KEY)
  }, [])

  const handleResume = () => {
    if (savedState) {
      setWizardData(savedState.data)
      setCurrentStep(savedState.currentStep)
    }
    setShowResumePrompt(false)
  }

  const handleStartFresh = () => {
    clearSavedState()
    setWizardData(DEFAULT_WIZARD_DATA)
    setCurrentStep(1)
    setShowResumePrompt(false)
  }

  const updateData = (updates: Partial<WizardData>) => {
    console.log('[Wizard] updateData called with:', updates)
    setWizardData(prev => {
      const newData = { ...prev, ...updates }
      console.log('[Wizard] New wizard data:', newData)
      return newData
    })
  }

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleFinish = async () => {
    setIsSubmitting(true)
    try {
      await onComplete(wizardData)
      // Clear saved state on successful completion
      clearSavedState()
    } catch (error) {
      console.error('Error completing wizard:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    // Keep the saved state when canceling so user can resume later
    onCancel()
  }

  // Format saved date for display
  const formatSavedDate = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  }

  // Show resume prompt if there's saved progress
  if (showResumePrompt && savedState) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 overflow-y-auto">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-background rounded-lg shadow-xl p-6">
            <h2 className="text-xl font-bold mb-2">Resume Your Progress?</h2>
            <p className="text-muted-foreground mb-4">
              You have an unfinished community setup from {formatSavedDate(savedState.savedAt)}.
            </p>

            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-sm mb-2">Saved Progress:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                {savedState.data.communityName && (
                  <li>• Community: <span className="text-foreground">{savedState.data.communityName}</span></li>
                )}
                {savedState.data.meetingPointName && (
                  <li>• Meeting Point: <span className="text-foreground">{savedState.data.meetingPointName}</span></li>
                )}
                {savedState.data.selectedRisks.length > 0 && (
                  <li>• Risks Selected: <span className="text-foreground">{savedState.data.selectedRisks.length}</span></li>
                )}
                {savedState.data.regionPolygon && savedState.data.regionPolygon.length > 0 && (
                  <li>• Region Defined: <span className="text-foreground">Yes</span></li>
                )}
                {savedState.data.groups.length > 0 && (
                  <li>• Groups Created: <span className="text-foreground">{savedState.data.groups.length}</span></li>
                )}
                <li>• Step: <span className="text-foreground">{savedState.currentStep} of 4</span></li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={handleResume} className="w-full">
                <RotateCcw className="mr-2 h-4 w-4" />
                Resume Progress
              </Button>
              <Button variant="outline" onClick={handleStartFresh} className="w-full">
                <Trash2 className="mr-2 h-4 w-4" />
                Start Fresh
              </Button>
              <Button variant="ghost" onClick={onCancel} className="w-full">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return (
          wizardData.communityName.trim() !== '' &&
          wizardData.meetingPointName.trim() !== '' &&
          wizardData.meetingPointLat !== null &&
          wizardData.meetingPointLng !== null
        )
      case 2:
        return wizardData.selectedRisks.length > 0
      case 3:
        return wizardData.regionPolygon && wizardData.regionPolygon.length >= 3
      case 4:
        return true // Groups are optional
      default:
        return false
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-5xl bg-background rounded-lg shadow-xl my-8">
          {/* Header */}
          <div className="border-b p-6">
            <h2 className="text-2xl font-bold">Create New Community</h2>
            <p className="text-muted-foreground mt-1">
              Set up your emergency response community in 4 easy steps (Step {currentStep} of {STEPS.length})
            </p>
          </div>

        {/* Progress Steps */}
        <div className="border-b bg-muted/30">
          <div className="flex items-center justify-between px-6 py-4">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center w-full">
                  <div className="flex items-center w-full">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                        currentStep > step.id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : currentStep === step.id
                          ? 'border-primary bg-background text-primary'
                          : 'border-muted-foreground/30 bg-background text-muted-foreground'
                      }`}
                    >
                      {currentStep > step.id ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <span className="text-sm font-medium">{step.id}</span>
                      )}
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={`h-0.5 flex-1 transition-all ${
                          currentStep > step.id ? 'bg-primary' : 'bg-muted-foreground/30'
                        }`}
                      />
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <p
                      className={`text-sm font-medium ${
                        currentStep === step.id ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {step.name}
                    </p>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
            {currentStep === 1 && (
              <StepOne data={wizardData} updateData={updateData} />
            )}
            {currentStep === 2 && (
              <StepTwo data={wizardData} updateData={updateData} />
            )}
            {currentStep === 3 && (
              <StepThree data={wizardData} updateData={updateData} />
            )}
            {currentStep === 4 && (
              <StepFour data={wizardData} updateData={updateData} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-6 bg-muted/30">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <div className="flex gap-2">
              {currentStep > 1 && (
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              )}
              {currentStep < STEPS.length ? (
                <Button onClick={handleNext} disabled={!isStepValid()}>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleFinish} disabled={!isStepValid() || isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Finish'}
                  <Check className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
