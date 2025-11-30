'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { loadGoogleMaps } from '@/lib/google-maps-loader'
import type { RegionPolygon } from '@/types/database'

export interface MapMarker {
  id: string
  lat: number
  lng: number
  title: string
  description?: string
  color?: 'red' | 'blue' | 'green' | 'yellow' | 'purple' | string // supports preset colors or hex values
}

export interface MapRegion {
  id: string
  name: string
  polygon: RegionPolygon
  color: string
  opacity: number
}

interface GoogleMapProps {
  markers?: MapMarker[]
  regions?: MapRegion[]
  center?: { lat: number; lng: number }
  zoom?: number
  height?: string
  onMapClick?: (lat: number, lng: number) => void
  onMarkerClick?: (marker: MapMarker) => void
  selectedMarkerId?: string
  showRegions?: boolean
  fitToRegions?: boolean // If true, fit map bounds to include all regions
}

const DEFAULT_CENTER = { lat: -41.2865, lng: 174.7762 } // Wellington, NZ
const DEFAULT_ZOOM = 12

// Map marker colors
const markerColors: Record<string, string> = {
  red: '#EF4444',
  blue: '#3B82F6',
  green: '#22C55E',
  yellow: '#EAB308',
  purple: '#A855F7'
}

export function GoogleMap({
  markers = [],
  regions = [],
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  height = '400px',
  onMapClick,
  onMarkerClick,
  selectedMarkerId,
  showRegions = true,
  fitToRegions = false
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const polygonsRef = useRef<google.maps.Polygon[]>([])
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)

  // Load Google Maps script
  useEffect(() => {
    loadGoogleMaps({ libraries: ['places'] })
      .then(() => {
        setIsLoaded(true)
      })
      .catch((err) => {
        setError(err.message || 'Failed to load Google Maps')
      })
  }, [])

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || initRef.current) return

    try {
      initRef.current = true

      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center,
        zoom,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        mapId: 'civil-defence-map', // Required for AdvancedMarkerElement
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      })

      // Create info window
      infoWindowRef.current = new google.maps.InfoWindow()

      // Add click listener for map
      if (onMapClick) {
        mapInstanceRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            onMapClick(e.latLng.lat(), e.latLng.lng())
          }
        })
      }
    } catch (err) {
      console.error('Error initializing map:', err)
      setError('Failed to initialize map')
    }
  }, [isLoaded, center, zoom, onMapClick])

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    // Add new markers
    markers.forEach(markerData => {
      const marker = new google.maps.Marker({
        position: { lat: markerData.lat, lng: markerData.lng },
        map: mapInstanceRef.current!,
        title: markerData.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: selectedMarkerId === markerData.id ? 12 : 10,
          fillColor: markerData.color?.startsWith('#') ? markerData.color : (markerColors[markerData.color || 'red'] || '#ff0000'),
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        },
        animation: selectedMarkerId === markerData.id ? google.maps.Animation.BOUNCE : null
      })

      // Add click listener
      marker.addListener('click', () => {
        if (infoWindowRef.current && mapInstanceRef.current) {
          infoWindowRef.current.setContent(`
            <div style="padding: 8px; max-width: 200px;">
              <h3 style="font-weight: 600; margin-bottom: 4px;">${markerData.title}</h3>
              ${markerData.description ? `<p style="color: #666; font-size: 14px;">${markerData.description}</p>` : ''}
            </div>
          `)
          infoWindowRef.current.open(mapInstanceRef.current, marker)
        }
        onMarkerClick?.(markerData)
      })

      markersRef.current.push(marker)
    })

    // Fit bounds if multiple markers
    if (markers.length > 1 && mapInstanceRef.current) {
      const bounds = new google.maps.LatLngBounds()
      markers.forEach(m => bounds.extend({ lat: m.lat, lng: m.lng }))
      mapInstanceRef.current.fitBounds(bounds, 50)
    } else if (markers.length === 1 && mapInstanceRef.current && markers[0]) {
      mapInstanceRef.current.setCenter({ lat: markers[0].lat, lng: markers[0].lng })
      mapInstanceRef.current.setZoom(15)
    }
  }, [markers, isLoaded, selectedMarkerId, onMarkerClick])

  // Update regions/polygons
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return

    // Clear existing polygons
    polygonsRef.current.forEach(polygon => polygon.setMap(null))
    polygonsRef.current = []

    // Don't render if showRegions is false
    if (!showRegions) return

    // Collect all region bounds for fitToRegions
    const allBounds = fitToRegions ? new google.maps.LatLngBounds() : null

    // Add region polygons
    regions.forEach(region => {
      if (!region.polygon || region.polygon.length < 3) return

      const polygon = new google.maps.Polygon({
        paths: region.polygon.map(c => ({ lat: c.lat, lng: c.lng })),
        fillColor: region.color,
        fillOpacity: region.opacity,
        strokeColor: region.color,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        clickable: true,
        map: mapInstanceRef.current!,
      })

      // Add click listener for region info
      polygon.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (infoWindowRef.current && e.latLng) {
          infoWindowRef.current.setContent(`
            <div style="padding: 8px; max-width: 200px;">
              <h3 style="font-weight: 600; margin-bottom: 4px;">${region.name}</h3>
              <p style="color: #666; font-size: 14px;">Community coverage area</p>
            </div>
          `)
          infoWindowRef.current.setPosition(e.latLng)
          infoWindowRef.current.open(mapInstanceRef.current!)
        }
      })

      // Extend bounds with region coordinates
      if (allBounds) {
        region.polygon.forEach(c => allBounds.extend({ lat: c.lat, lng: c.lng }))
      }

      polygonsRef.current.push(polygon)
    })

    // Fit map to region bounds if fitToRegions is enabled and we have regions
    if (fitToRegions && allBounds && regions.length > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(allBounds, 50)
    }
  }, [regions, isLoaded, showRegions, fitToRegions])

  // Update center when prop changes
  useEffect(() => {
    if (mapInstanceRef.current && center) {
      mapInstanceRef.current.setCenter(center)
    }
  }, [center])

  if (error) {
    return (
      <div
        className="flex items-center justify-center border bg-muted/50"
        style={{ height }}
      >
        <div className="text-center text-muted-foreground">
          <p className="text-sm">{error}</p>
          <p className="text-xs mt-1">Please configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</p>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div
        className="flex items-center justify-center border bg-muted/50"
        style={{ height }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div
      ref={mapRef}
      className="overflow-hidden"
      style={{ height, width: '100%' }}
    />
  )
}
