'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, Check, RotateCcw, Trash2, Shield, Loader2 } from 'lucide-react'
import { StepOne } from './wizard-steps/step-one'
import { StepTwo } from './wizard-steps/step-two'
import { StepThree } from './wizard-steps/step-three'
import { StepFour } from './wizard-steps/step-four'
import { StepFive } from './wizard-steps/step-five'
import { StepSix } from './wizard-steps/step-six'
import type { DisasterType } from '@/data/guide-templates'

const WIZARD_STORAGE_KEY = 'civildefence_wizard_draft'
const WIZARD_COMPLETED_KEY = 'civildefence_wizard_completed'

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
  regionMapImage: string | null // Base64 encoded map screenshot with region overlay

  // Step 4: Groups
  groups: Array<{
    name: string
    description: string
    color: string
    icon: string
  }>

  // Step 5: Invitations
  invitations: Array<{
    email: string
    role: 'member' | 'team_member' | 'admin'
    name?: string
    groupName?: string // Optional group assignment
  }>

  // Step 6: Facebook Promo (optional)
  facebookPromo?: {
    post: string
    imageUrl: string | null
    style: string
  }
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
  onDone?: () => void // Called when user finishes the promo step (after community creation)
}

const STEPS = [
  { id: 1, name: 'Basic Info', description: 'Community name and meeting point' },
  { id: 2, name: 'Define Area', description: 'Map your community boundaries' },
  { id: 3, name: 'Risk Assessment', description: 'AI-powered regional analysis' },
  { id: 4, name: 'Setup Groups', description: 'Organize your members' },
  { id: 5, name: 'Invite Members', description: 'Add your team via email' },
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
  regionMapImage: null,
  groups: [],
  invitations: [],
}

// Helper to check if there's meaningful progress
function hasProgress(data: WizardData): boolean {
  return (
    data.communityName.trim() !== '' ||
    data.meetingPointName.trim() !== '' ||
    data.meetingPointAddress.trim() !== '' ||
    data.selectedRisks.length > 0 ||
    (data.regionPolygon !== null && data.regionPolygon.length > 0) ||
    data.groups.length > 0 ||
    data.invitations.length > 0
  )
}

export function OnboardingWizard({ onComplete, onCancel, onDone }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCustomizing, setIsCustomizing] = useState(false)
  const [showResumePrompt, setShowResumePrompt] = useState(false)
  const [savedState, setSavedState] = useState<SavedWizardState | null>(null)
  const [wizardData, setWizardData] = useState<WizardData>(DEFAULT_WIZARD_DATA)
  const [isInitialized, setIsInitialized] = useState(false)
  const [showPromoStep, setShowPromoStep] = useState(false) // Show promotion step after community is created
  const [isCompleted, setIsCompleted] = useState(false) // Track if community was successfully created

  // Load saved state on mount
  useEffect(() => {
    try {
      // Check if wizard was just completed - if so, show promo step
      const justCompleted = localStorage.getItem(WIZARD_COMPLETED_KEY)
      if (justCompleted) {
        console.log('[Wizard] Wizard was just completed, showing promo step')
        const completedData = JSON.parse(justCompleted)
        setWizardData(completedData)
        setShowPromoStep(true)
        setIsCompleted(true)
        setIsInitialized(true)
        return
      }

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
      localStorage.removeItem(WIZARD_COMPLETED_KEY)
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
    // Don't save if we're showing the resume prompt, promo step, completed, or not yet initialized
    console.log('[Wizard] Auto-save effect - isInitialized:', isInitialized, 'showResumePrompt:', showResumePrompt, 'showPromoStep:', showPromoStep, 'isCompleted:', isCompleted)
    if (isInitialized && !showResumePrompt && !showPromoStep && !isCompleted) {
      saveState()
    }
  }, [wizardData, currentStep, showResumePrompt, showPromoStep, isCompleted, saveState, isInitialized])

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

  // Customize guides when moving from step 3 (Risk Assessment) to step 4
  const handleCustomizeGuides = async () => {
    if (wizardData.selectedRisks.length === 0) return

    setIsCustomizing(true)

    try {
      const response = await fetch('/api/customize-guides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: wizardData.location,
          latitude: wizardData.meetingPointLat,
          longitude: wizardData.meetingPointLng,
          selectedRisks: wizardData.selectedRisks,
          aiAnalysis: wizardData.aiAnalysis,
          regionMapImage: wizardData.regionMapImage,
        }),
      })

      if (response.ok) {
        const result = await response.json()

        // Convert array to record keyed by risk type
        const customizations: Record<string, any> = {}
        result.customizedGuides.forEach((guide: any) => {
          if (guide && guide.customization) {
            customizations[guide.riskType] = guide.customization
          }
        })

        setWizardData(prev => ({
          ...prev,
          guideCustomizations: customizations
        }))
      }
    } catch (err) {
      console.error('Error customizing guides:', err)
      // Continue anyway - customization is not critical
    } finally {
      setIsCustomizing(false)
    }
  }

  const handleNext = async () => {
    console.log('[Wizard] handleNext called, currentStep:', currentStep, 'isCustomizing:', isCustomizing)
    if (currentStep < STEPS.length) {
      // When moving from step 3 (Risk Assessment) to step 4, auto-customize guides
      if (currentStep === 3 && !wizardData.guideCustomizations && wizardData.selectedRisks.length > 0) {
        console.log('[Wizard] Starting guide customization...')
        await handleCustomizeGuides()
        console.log('[Wizard] Guide customization complete')
      }
      console.log('[Wizard] Advancing to step', currentStep + 1)
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
      // IMPORTANT: Clear draft storage and set completed state BEFORE calling onComplete
      // This prevents race conditions where the component remounts mid-completion
      localStorage.removeItem(WIZARD_STORAGE_KEY)
      localStorage.setItem(WIZARD_COMPLETED_KEY, JSON.stringify(wizardData))

      // Mark as completed in state
      setIsCompleted(true)
      setSavedState(null)
      setShowResumePrompt(false)

      // Now call onComplete (which may cause remount)
      await onComplete(wizardData)

      // Show the promotion step after successful creation
      setShowPromoStep(true)
      console.log('[Wizard] Community created successfully, showing promo step')
    } catch (error) {
      console.error('Error completing wizard:', error)
      // On error, restore the draft so user can retry
      localStorage.removeItem(WIZARD_COMPLETED_KEY)
      localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify({
        data: wizardData,
        currentStep,
        savedAt: new Date().toISOString(),
      }))
      setIsCompleted(false)
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

  // If showing the promo step (after community creation), render a simpler UI without the stepper
  // This check must come BEFORE showResumePrompt to ensure promo step takes priority
  if (showPromoStep) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-background rounded-2xl shadow-2xl my-8 overflow-hidden border border-border/50">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent border-b p-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Check className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Community Created!</h2>
                  <p className="text-muted-foreground text-sm mt-0.5">
                    Help spread the word about {wizardData.communityName}
                  </p>
                </div>
              </div>
            </div>

            {/* Promo Content */}
            <div className="p-6">
              <StepSix data={wizardData} updateData={updateData} />
            </div>

            {/* Footer */}
            <div className="border-t p-4 sm:p-6 bg-gradient-to-r from-muted/50 via-muted/30 to-muted/50">
              <div className="flex items-center justify-end">
                <Button onClick={() => {
                  // Clear the completed key so next time wizard opens fresh
                  localStorage.removeItem(WIZARD_COMPLETED_KEY)
                  if (onDone) {
                    onDone()
                  } else {
                    onCancel()
                  }
                }} className="gap-2">
                  <span>Done</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
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
        return wizardData.regionPolygon && wizardData.regionPolygon.length >= 3
      case 3:
        return wizardData.selectedRisks.length > 0
      case 4:
        return true // Groups are optional
      case 5:
        return true // Invitations are optional
      default:
        return false
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-5xl bg-background rounded-2xl shadow-2xl my-8 overflow-hidden border border-border/50">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Create New Community</h2>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Set up your emergency response community in {STEPS.length} easy steps
                </p>
              </div>
            </div>
          </div>

        {/* Progress Steps - Fixed alignment */}
        <div className="border-b bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
          <div className="px-6 py-6">
            <div className="flex items-start">
              {STEPS.map((step, index) => (
                <div key={step.id} className="flex-1 relative">
                  {/* Connector line */}
                  {index < STEPS.length - 1 && (
                    <div
                      className={`absolute top-5 left-1/2 w-full h-0.5 transition-all duration-300 ${
                        currentStep > step.id ? 'bg-primary' : 'bg-muted-foreground/20'
                      }`}
                    />
                  )}
                  {/* Step content centered */}
                  <div className="relative flex flex-col items-center">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 z-10 ${
                        currentStep > step.id
                          ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                          : currentStep === step.id
                          ? 'border-primary bg-muted text-primary ring-4 ring-primary/20'
                          : 'border-muted-foreground/30 bg-background text-muted-foreground'
                      }`}
                    >
                      {currentStep > step.id ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <span className="text-sm font-semibold">{step.id}</span>
                      )}
                    </div>
                    <div className="mt-3 text-center px-2">
                      <p
                        className={`text-sm font-medium transition-colors ${
                          currentStep === step.id ? 'text-primary' : currentStep > step.id ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {step.name}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          <div className="max-h-[calc(100vh-400px)] overflow-y-auto pr-4">
            {currentStep === 1 && (
              <StepOne data={wizardData} updateData={updateData} />
            )}
            {currentStep === 2 && (
              <StepThree data={wizardData} updateData={updateData} />
            )}
            {currentStep === 3 && (
              <StepTwo data={wizardData} updateData={updateData} />
            )}
            {currentStep === 4 && (
              isCustomizing ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">Customising Response Plans</h3>
                    <p className="text-muted-foreground text-sm">
                      AI is creating location-specific emergency guides for your community...
                    </p>
                  </div>
                </div>
              ) : (
                <StepFour data={wizardData} updateData={updateData} />
              )
            )}
            {currentStep === 5 && (
              <StepFive data={wizardData} updateData={updateData} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 sm:p-6 bg-gradient-to-r from-muted/50 via-muted/30 to-muted/50">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={handleCancel} className="text-muted-foreground hover:text-foreground">
              Cancel
            </Button>
            <div className="flex items-center gap-3">
              {/* Step indicator for mobile */}
              <span className="text-xs text-muted-foreground sm:hidden">
                Step {currentStep}/{STEPS.length}
              </span>
              {currentStep > 1 && (
                <Button variant="outline" onClick={handleBack} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              )}
              {currentStep < STEPS.length ? (
                <Button onClick={handleNext} disabled={!isStepValid() || isCustomizing} className="gap-2 min-w-[100px]">
                  {isCustomizing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Customising...</span>
                    </>
                  ) : (
                    <>
                      <span>Next</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleFinish}
                  disabled={!isStepValid() || isSubmitting}
                  className="gap-2 min-w-[120px] bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-pulse">Creating...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Community</span>
                      <Check className="h-4 w-4" />
                    </>
                  )}
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
