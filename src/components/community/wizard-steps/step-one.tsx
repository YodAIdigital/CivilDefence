'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Building2, MapPinned } from 'lucide-react'
import { AddressAutocomplete } from '@/components/maps/address-autocomplete'
import type { WizardData } from '../onboarding-wizard'
import type { AddressResult } from '@/components/maps/address-autocomplete'

interface StepOneProps {
  data: WizardData
  updateData: (updates: Partial<WizardData>) => void
}

export function StepOne({ data, updateData }: StepOneProps) {
  const handleMeetingPointSelect = (result: AddressResult) => {
    updateData({
      meetingPointAddress: result.formattedAddress,
      meetingPointLat: result.lat,
      meetingPointLng: result.lng,
      // Use meeting point address as location if location is empty
      location: data.location || result.formattedAddress,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
        <p className="text-muted-foreground text-sm mb-6">
          Start by setting up your community&apos;s basic details and meeting point. The meeting
          point is where members will gather during emergencies.
        </p>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Community Name */}
        <div className="space-y-2">
          <Label htmlFor="communityName" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Community Name *
          </Label>
          <Input
            id="communityName"
            value={data.communityName}
            onChange={(e) => updateData({ communityName: e.target.value })}
            placeholder="e.g., Wellington Central Emergency Response"
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={data.description}
            onChange={(e) => updateData({ description: e.target.value })}
            placeholder="Brief description of your community..."
            rows={3}
          />
        </div>

        {/* Meeting Point Name */}
        <div className="space-y-2">
          <Label htmlFor="meetingPointName" className="flex items-center gap-2">
            <MapPinned className="h-4 w-4" />
            Meeting Point Name *
          </Label>
          <Input
            id="meetingPointName"
            value={data.meetingPointName}
            onChange={(e) => updateData({ meetingPointName: e.target.value })}
            placeholder="e.g., Community Center, Town Hall"
            required
          />
        </div>

        {/* Meeting Point Address */}
        <div className="space-y-2">
          <Label htmlFor="meetingPoint">Meeting Point Address *</Label>
          <AddressAutocomplete
            value={data.meetingPointAddress}
            onChange={(value) => updateData({ meetingPointAddress: value })}
            onSelect={handleMeetingPointSelect}
            placeholder="Search for meeting point location..."
          />
          <p className="text-xs text-muted-foreground">
            Search for the exact location where members will meet during emergencies
          </p>
          {data.meetingPointLat && data.meetingPointLng && (
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <MapPinned className="h-3 w-3" />
              Location confirmed: {data.meetingPointLat.toFixed(6)}, {data.meetingPointLng.toFixed(6)}
            </p>
          )}
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-sm mb-2 text-blue-900 dark:text-blue-100">
          Why is a meeting point important?
        </h4>
        <p className="text-xs text-blue-800 dark:text-blue-200">
          During emergencies, communication infrastructure may fail. Having a pre-designated
          meeting point ensures everyone knows where to gather for coordination, resource
          distribution, and safety checks.
        </p>
      </div>
    </div>
  )
}
