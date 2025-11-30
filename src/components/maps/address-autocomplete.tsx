'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { loadGoogleMaps } from '@/lib/google-maps-loader'

export interface AddressResult {
  formattedAddress: string
  lat: number
  lng: number
  streetNumber?: string
  street?: string
  suburb?: string
  city?: string
  region?: string
  postalCode?: string
  country?: string
}

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect?: (result: AddressResult) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  country?: string // Restrict to country, e.g., 'nz'
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Start typing an address...',
  className = '',
  disabled = false,
  country = 'nz',
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load Google Maps script with Places library
  useEffect(() => {
    loadGoogleMaps({ libraries: ['places'] })
      .then(() => {
        setIsLoaded(true)
      })
      .catch((err) => {
        setError(err.message || 'Failed to load Google Maps')
      })
  }, [])

  // Initialize autocomplete
  const initAutocomplete = useCallback(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return

    try {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country },
        fields: ['address_components', 'formatted_address', 'geometry'],
        types: ['address'],
      })

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace()

        if (!place?.geometry?.location || !place.formatted_address) {
          return
        }

        // Parse address components
        const result: AddressResult = {
          formattedAddress: place.formatted_address,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        }

        place.address_components?.forEach((component) => {
          const type = component.types[0]
          switch (type) {
            case 'street_number':
              result.streetNumber = component.long_name
              break
            case 'route':
              result.street = component.long_name
              break
            case 'sublocality_level_1':
            case 'locality':
              if (!result.suburb) {
                result.suburb = component.long_name
              }
              break
            case 'administrative_area_level_2':
              result.city = component.long_name
              break
            case 'administrative_area_level_1':
              result.region = component.long_name
              break
            case 'postal_code':
              result.postalCode = component.long_name
              break
            case 'country':
              result.country = component.long_name
              break
          }
        })

        onChange(place.formatted_address)
        onSelect?.(result)
      })
    } catch (err) {
      console.error('Error initializing autocomplete:', err)
      setError('Failed to initialize address search')
    }
  }, [isLoaded, country, onChange, onSelect])

  useEffect(() => {
    initAutocomplete()
  }, [initAutocomplete])

  // Handle manual input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  if (error) {
    return (
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full rounded-lg border border-border bg-background px-3 py-2 ${className}`}
        />
        <p className="mt-1 text-xs text-amber-600">Address lookup unavailable</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={isLoaded ? placeholder : 'Loading address search...'}
        disabled={disabled || !isLoaded}
        className={`w-full rounded-lg border border-border bg-background px-3 py-2 ${
          !isLoaded ? 'bg-muted' : ''
        } ${className}`}
      />
      {isLoaded && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <span className="material-icons text-lg">location_on</span>
        </span>
      )}
    </div>
  )
}
