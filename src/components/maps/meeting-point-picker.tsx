'use client'

import { useState, useEffect } from 'react'
import { GoogleMap, MapMarker } from './google-map'
import { AddressAutocomplete, type AddressResult } from './address-autocomplete'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MapPin, X } from 'lucide-react'

interface MeetingPointPickerProps {
  value?: {
    name: string
    address: string
    lat: number
    lng: number
  } | null
  onChange: (value: { name: string; address: string; lat: number; lng: number } | null) => void
}

export function MeetingPointPicker({ value, onChange }: MeetingPointPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempLocation, setTempLocation] = useState<{ lat: number; lng: number } | null>(
    value ? { lat: value.lat, lng: value.lng } : null
  )
  const [name, setName] = useState(value?.name || '')
  const [address, setAddress] = useState(value?.address || '')

  // Sync internal state when value prop changes (e.g., after save)
  useEffect(() => {
    if (value) {
      setTempLocation({ lat: value.lat, lng: value.lng })
      setName(value.name)
      setAddress(value.address)
    } else {
      setTempLocation(null)
      setName('')
      setAddress('')
    }
  }, [value])

  const handleMapClick = (lat: number, lng: number) => {
    setTempLocation({ lat, lng })
  }

  const handleAddressSelect = (result: AddressResult) => {
    setAddress(result.formattedAddress)
    setTempLocation({ lat: result.lat, lng: result.lng })
  }

  const handleSave = () => {
    if (tempLocation && name) {
      onChange({
        name,
        address,
        lat: tempLocation.lat,
        lng: tempLocation.lng
      })
      setIsOpen(false)
    }
  }

  const handleClear = () => {
    onChange(null)
    setTempLocation(null)
    setName('')
    setAddress('')
  }

  const markers: MapMarker[] = tempLocation
    ? [
        {
          id: 'selected',
          lat: tempLocation.lat,
          lng: tempLocation.lng,
          title: name || 'Meeting Point',
          color: 'green'
        }
      ]
    : []

  if (!isOpen) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">Emergency Meeting Point</label>
        {value ? (
          <div className="flex items-start gap-2 p-3 rounded-lg border bg-muted/50">
            <MapPin className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{value.name}</p>
              {value.address && (
                <p className="text-sm text-muted-foreground truncate">{value.address}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
              </p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClear}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setIsOpen(true)}
          >
            <MapPin className="mr-2 h-4 w-4" />
            Set Meeting Point
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Select Meeting Point</label>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Name</label>
          <Input
            placeholder="Meeting point name (e.g., Community Hall)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Address</label>
          <AddressAutocomplete
            value={address}
            onChange={setAddress}
            onSelect={handleAddressSelect}
            placeholder="Search for an address..."
          />
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Search for an address above, or click on the map to select the meeting point location
      </div>

      <GoogleMap
        markers={markers}
        height="300px"
        onMapClick={handleMapClick}
        {...(tempLocation && { center: tempLocation })}
        zoom={tempLocation ? 15 : 13}
      />

      {tempLocation && (
        <p className="text-sm text-muted-foreground">
          Selected: {tempLocation.lat.toFixed(6)}, {tempLocation.lng.toFixed(6)}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setIsOpen(false)}
        >
          Cancel
        </Button>
        <Button
          className="flex-1"
          onClick={handleSave}
          disabled={!tempLocation || !name}
        >
          Save Meeting Point
        </Button>
      </div>
    </div>
  )
}
