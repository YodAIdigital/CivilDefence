'use client'

import { useCallback } from 'react'
import { RegionEditor } from '@/components/maps/region-editor'
import type { WizardData } from '../onboarding-wizard'
import type { RegionPolygon } from '@/types/database'

interface StepThreeProps {
  data: WizardData
  updateData: (updates: Partial<WizardData>) => void
}

export function StepThree({ data, updateData }: StepThreeProps) {
  // Auto-save when region changes (for wizard's Next button validation)
  const handleChange = useCallback((polygon: RegionPolygon | null, color: string, opacity: number) => {
    updateData({
      regionPolygon: polygon,
      regionColor: color,
      regionOpacity: opacity,
    })
  }, [updateData])

  // Legacy save handler (not used in compact mode but required by interface)
  const handleSave = async (polygon: RegionPolygon | null, color: string, opacity: number) => {
    updateData({
      regionPolygon: polygon,
      regionColor: color,
      regionOpacity: opacity,
    })
  }

  // Capture map image when region is defined
  const handleMapCapture = useCallback((imageBase64: string) => {
    console.log('[StepThree] Map image captured, length:', imageBase64.length, 'chars')
    updateData({
      regionMapImage: imageBase64,
    })
  }, [updateData])

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Define Your Community Area</h3>
        <p className="text-muted-foreground text-sm">
          Draw your community&apos;s coverage area on the map. The green marker shows your meeting point.
        </p>
      </div>

      <RegionEditor
        initialPolygon={data.regionPolygon}
        center={
          data.meetingPointLat && data.meetingPointLng
            ? { lat: data.meetingPointLat, lng: data.meetingPointLng }
            : undefined
        }
        meetingPoint={
          data.meetingPointLat && data.meetingPointLng
            ? { lat: data.meetingPointLat, lng: data.meetingPointLng, name: data.meetingPointName }
            : null
        }
        onSave={handleSave}
        onChange={handleChange}
        onMapCapture={handleMapCapture}
        isSaving={false}
        compactMode={true}
        startInEditMode={true}
      />
    </div>
  )
}
