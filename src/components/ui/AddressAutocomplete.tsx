'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface AddressAutocompleteProps {
  value: string
  onChange: (address: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoogleAutocomplete = any

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Enter address...',
  className = '',
  disabled = false,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<GoogleAutocomplete>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load Google Places API script
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      console.warn('Google Maps API key not configured')
      return
    }

    // Check if already loaded
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any
    if (win.google?.maps?.places) {
      setIsLoaded(true)
      return
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
    if (existingScript) {
      // Wait for it to load
      const checkLoaded = setInterval(() => {
        if (win.google?.maps?.places) {
          setIsLoaded(true)
          clearInterval(checkLoaded)
        }
      }, 100)
      return () => clearInterval(checkLoaded)
    }

    // Load the script
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => {
      setIsLoaded(true)
    }
    script.onerror = () => {
      console.error('Failed to load Google Places API')
    }
    document.head.appendChild(script)

    return () => {
      // Don't remove the script on cleanup as it might be used elsewhere
    }
  }, [])

  // Initialize autocomplete
  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any
      autocompleteRef.current = new win.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ['address'],
          fields: ['formatted_address', 'geometry', 'name'],
        }
      )

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace()
        if (place?.formatted_address) {
          onChange(place.formatted_address)
        } else if (place?.name) {
          onChange(place.name)
        }
      })
    } catch (error) {
      console.error('Failed to initialize Google Places Autocomplete:', error)
    }
  }, [isLoaded, onChange])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }, [onChange])

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={handleInputChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      autoComplete="off"
    />
  )
}
