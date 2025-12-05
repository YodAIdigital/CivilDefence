'use client'

import { RegionEditor } from '@/components/maps/region-editor'
import type { WizardData } from '../onboarding-wizard'
import type { RegionPolygon } from '@/types/database'

interface StepThreeProps {
  data: WizardData
  updateData: (updates: Partial<WizardData>) => void
}

export function StepThree({ data, updateData }: StepThreeProps) {
  const handleSave = async (polygon: RegionPolygon | null, color: string, opacity: number) => {
    updateData({
      regionPolygon: polygon,
      regionColor: color,
      regionOpacity: opacity,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Define Your Community Area</h3>
        <p className="text-muted-foreground text-sm">
          Draw a boundary around your community's coverage area. This helps members know if they're
          within the community's response zone. Click "Start Drawing" and then click on the map to add points.
        </p>
      </div>

      <div className="border rounded-lg overflow-hidden" style={{ height: '600px' }}>
        <RegionEditor
          initialPolygon={data.regionPolygon}
          center={
            data.meetingPointLat && data.meetingPointLng
              ? { lat: data.meetingPointLat, lng: data.meetingPointLng }
              : undefined
          }
          onSave={handleSave}
          isSaving={false}
        />
      </div>

      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-sm mb-2 text-blue-900 dark:text-blue-100">
          How to define your area:
        </h4>
        <ol className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
          <li>Click "Start Drawing" to begin</li>
          <li>Click on the map to add boundary points (minimum 3 points)</li>
          <li>The area will automatically close to form a polygon</li>
          <li>You can drag points to adjust the boundary</li>
          <li>Use the search box to navigate to different areas</li>
          <li>Click "Save Region" when you're done</li>
        </ol>
      </div>
    </div>
  )
}
