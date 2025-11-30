'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, Trash2, Undo2, Pencil, Search, X, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { loadGoogleMaps } from '@/lib/google-maps-loader'
import type { RegionCoordinate, RegionPolygon } from '@/types/database'

interface RegionEditorProps {
  initialPolygon?: RegionPolygon | null
  center?: { lat: number; lng: number } | undefined
  onSave: (polygon: RegionPolygon | null, color: string, opacity: number) => Promise<void>
  isSaving?: boolean
}

const DEFAULT_CENTER = { lat: -41.2865, lng: 174.7762 } // Wellington, NZ
const REGION_COLOR = '#FEB100' // App's gold color
const REGION_OPACITY = 0.1 // 10% opacity

export function RegionEditor({
  initialPolygon,
  center,
  onSave,
  isSaving = false,
}: RegionEditorProps) {
  const mapCenter = center || DEFAULT_CENTER
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const polygonRef = useRef<google.maps.Polygon | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const midpointMarkersRef = useRef<google.maps.Marker[]>([])

  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [coordinates, setCoordinates] = useState<RegionCoordinate[]>(initialPolygon || [])
  const [coordinatesHistory, setCoordinatesHistory] = useState<RegionCoordinate[][]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const initRef = useRef(false)
  const isDrawingRef = useRef(false)
  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const coordinatesRef = useRef<RegionCoordinate[]>(initialPolygon || [])
  const hasInitiallyFitBounds = useRef(false) // Track if we've done initial fitBounds

  // Keep ref in sync with state and toggle map dragging
  useEffect(() => {
    isDrawingRef.current = isDrawing

    // Disable map dragging when in drawing mode so clicks add points
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setOptions({
        draggable: !isDrawing,
        gestureHandling: isDrawing ? 'none' : 'auto',
      })
    }
  }, [isDrawing])

  // Load Google Maps
  useEffect(() => {
    loadGoogleMaps({ libraries: ['places', 'drawing'] })
      .then(() => setIsLoaded(true))
      .catch((err) => setError(err.message || 'Failed to load Google Maps'))
  }, [])

  // Keep coordinatesRef in sync with state
  useEffect(() => {
    coordinatesRef.current = coordinates
  }, [coordinates])

  // Update polygon appearance
  const updatePolygonStyle = useCallback(() => {
    if (polygonRef.current) {
      polygonRef.current.setOptions({
        fillColor: REGION_COLOR,
        fillOpacity: REGION_OPACITY,
        strokeColor: REGION_COLOR,
        strokeOpacity: 1,
        strokeWeight: 2,
      })
    }
  }, [])

  // Helper to push current coordinates to history before making changes
  const pushToHistory = useCallback((coords: RegionCoordinate[]) => {
    setCoordinatesHistory(prev => [...prev, coords])
  }, [])

  // Create/update the polygon on the map
  const updatePolygon = useCallback(() => {
    if (!mapInstanceRef.current) return

    // Remove existing polygon
    if (polygonRef.current) {
      polygonRef.current.setMap(null)
      polygonRef.current = null
    }

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    // Clear existing midpoint markers
    midpointMarkersRef.current.forEach(marker => marker.setMap(null))
    midpointMarkersRef.current = []

    // Create polygon only if we have at least 3 points - ALWAYS show polygon when we have valid coords
    if (coordinates.length >= 3 && mapInstanceRef.current) {
      const path = coordinates.map(c => ({ lat: c.lat, lng: c.lng }))
      polygonRef.current = new google.maps.Polygon({
        paths: path,
        fillColor: REGION_COLOR,
        fillOpacity: REGION_OPACITY,
        strokeColor: REGION_COLOR,
        strokeOpacity: 1,
        strokeWeight: 2,
        editable: false, // We handle editing via markers
        draggable: false,
        clickable: false, // Don't interfere with map clicks
        map: mapInstanceRef.current,
      })
    }

    // Always show markers when in drawing mode (even with 0, 1, or 2 points)
    if (isDrawing && coordinates.length > 0) {
      // Create vertex markers (main points)
      coordinates.forEach((coord, index) => {
        const marker = new google.maps.Marker({
          position: { lat: coord.lat, lng: coord.lng },
          map: mapInstanceRef.current!,
          draggable: true,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#ffffff',
            fillOpacity: 1,
            strokeColor: REGION_COLOR,
            strokeWeight: 2,
          },
          title: `Point ${index + 1}`,
          zIndex: 10,
        })

        // Update coordinates when marker is dragged
        marker.addListener('dragend', () => {
          const pos = marker.getPosition()
          if (pos) {
            setCoordinates(prev => {
              pushToHistory(prev)
              const newCoords = [...prev]
              newCoords[index] = { lat: pos.lat(), lng: pos.lng() }
              return newCoords
            })
            setHasChanges(true)
          }
        })

        // Right-click to remove point
        marker.addListener('rightclick', () => {
          setCoordinates(prev => {
            pushToHistory(prev)
            return prev.filter((_, i) => i !== index)
          })
          setHasChanges(true)
        })

        markersRef.current.push(marker)
      })

      // Create midpoint markers (for adding new points between existing ones)
      if (coordinates.length >= 2) {
        for (let i = 0; i < coordinates.length; i++) {
          const nextIndex = (i + 1) % coordinates.length
          // Only create midpoint for the closing edge if we have a polygon (3+ points)
          if (nextIndex === 0 && coordinates.length < 3) continue

          const currentCoord = coordinates[i]
          const nextCoord = coordinates[nextIndex]
          if (!currentCoord || !nextCoord) continue

          const midLat = (currentCoord.lat + nextCoord.lat) / 2
          const midLng = (currentCoord.lng + nextCoord.lng) / 2

          const insertIndex = i + 1
          const midpointMarker = new google.maps.Marker({
            position: { lat: midLat, lng: midLng },
            map: mapInstanceRef.current!,
            draggable: true, // Make draggable so user can drag to insert new point
            clickable: true,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: REGION_COLOR,
              fillOpacity: 0.7,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
            title: 'Drag to add a new point here',
            cursor: 'grab',
            zIndex: 15, // Higher than vertex markers so they're easier to click
          })

          // When dragged, insert a new point at the drag end position
          midpointMarker.addListener('dragend', () => {
            const pos = midpointMarker.getPosition()
            if (pos) {
              setCoordinates(prev => {
                pushToHistory(prev)
                const newCoords = [...prev]
                newCoords.splice(insertIndex, 0, { lat: pos.lat(), lng: pos.lng() })
                return newCoords
              })
              setHasChanges(true)
            }
          })

          // Also support click to insert at midpoint position
          midpointMarker.addListener('click', () => {
            setCoordinates(prev => {
              pushToHistory(prev)
              const newCoords = [...prev]
              newCoords.splice(insertIndex, 0, { lat: midLat, lng: midLng })
              return newCoords
            })
            setHasChanges(true)
          })

          midpointMarkersRef.current.push(midpointMarker)
        }
      }
    }

    // Only fit bounds on initial load when there's an existing polygon
    // Don't zoom when user is adding new points
    if (!hasInitiallyFitBounds.current && coordinates.length >= 3 && mapInstanceRef.current) {
      const bounds = new google.maps.LatLngBounds()
      coordinates.forEach(c => bounds.extend({ lat: c.lat, lng: c.lng }))
      mapInstanceRef.current.fitBounds(bounds, 50)
      hasInitiallyFitBounds.current = true
    }
  }, [coordinates, isDrawing, pushToHistory])

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || initRef.current) return

    initRef.current = true

    const firstPoint = initialPolygon?.[0]
    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: firstPoint
        ? { lat: firstPoint.lat, lng: firstPoint.lng }
        : mapCenter,
      zoom: 13,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      draggable: true, // Initially draggable, will be disabled in drawing mode
      gestureHandling: 'auto',
      mapId: 'civil-defence-region-editor',
    })

    // Click handler for adding points in drawing mode
    mapInstanceRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
      // Use ref to get current drawing state (not stale closure)
      if (!isDrawingRef.current || !e.latLng) return

      const newCoord: RegionCoordinate = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      }
      // Push current state to history before adding new point
      setCoordinatesHistory(prev => [...prev, coordinatesRef.current])
      setCoordinates(prev => [...prev, newCoord])
      setHasChanges(true)
    })

    // Initialize search box
    if (searchInputRef.current) {
      searchBoxRef.current = new google.maps.places.SearchBox(searchInputRef.current)

      searchBoxRef.current.addListener('places_changed', () => {
        const places = searchBoxRef.current?.getPlaces()
        if (!places || places.length === 0) return

        const place = places[0]
        if (place && place.geometry?.location) {
          mapInstanceRef.current?.setCenter(place.geometry.location)
          mapInstanceRef.current?.setZoom(14)
          setSearchQuery(place.formatted_address || place.name || '')
        }
      })
    }

    // Initial polygon render
    if (initialPolygon && initialPolygon.length > 0) {
      setCoordinates(initialPolygon)
    }
  }, [isLoaded, mapCenter, initialPolygon])

  // Update polygon when coordinates change or map loads
  useEffect(() => {
    // Only run after map is initialized
    if (mapInstanceRef.current) {
      updatePolygon()
    }
  }, [updatePolygon])

  // Ensure polygon is drawn after map initialization completes
  useEffect(() => {
    if (isLoaded && mapInstanceRef.current && coordinates.length >= 3) {
      // Small delay to ensure map is fully ready
      const timer = setTimeout(() => {
        updatePolygon()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isLoaded, coordinates.length, updatePolygon])

  // Update style when color/opacity changes
  useEffect(() => {
    updatePolygonStyle()
  }, [updatePolygonStyle])

  const handleClear = () => {
    pushToHistory(coordinates)
    setCoordinates([])
    setHasChanges(true)
  }

  const handleUndo = () => {
    if (coordinatesHistory.length === 0) return
    const previousCoords = coordinatesHistory[coordinatesHistory.length - 1]
    if (!previousCoords) return
    setCoordinatesHistory(prev => prev.slice(0, -1))
    setCoordinates(previousCoords)
    // Check if we're back to initial state
    const isBackToInitial = JSON.stringify(previousCoords) === JSON.stringify(initialPolygon || [])
    setHasChanges(!isBackToInitial)
  }

  const handleSaveAndExit = async () => {
    // Use ref to get the latest coordinates
    const currentCoords = coordinatesRef.current
    const polygonToSave = currentCoords.length >= 3 ? currentCoords : null
    await onSave(polygonToSave, REGION_COLOR, REGION_OPACITY)
    setHasChanges(false)
    setCoordinatesHistory([])
    setIsDrawing(false)
  }

  const startEditing = () => {
    setIsDrawing(true)
  }

  if (error) {
    return (
      <div className="flex items-center justify-center border bg-muted/50 rounded-lg h-96">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">{error}</p>
          <p className="text-xs mt-1">Please configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</p>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center border bg-muted/50 rounded-lg h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {!isDrawing ? (
          // Not editing - show Edit Region button
          <Button
            variant="outline"
            size="sm"
            onClick={startEditing}
            className="gap-2"
          >
            <Pencil className="h-4 w-4" />
            Edit Region
          </Button>
        ) : (
          // Editing mode - show Undo and Clear buttons
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={coordinatesHistory.length === 0}
              className="gap-2"
            >
              <Undo2 className="h-4 w-4" />
              Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={coordinates.length === 0}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          </>
        )}

        {/* Search - inline with buttons */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search for a location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary h-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Save Region button (only in editing mode) */}
        {isDrawing && (
          <Button
            size="sm"
            onClick={handleSaveAndExit}
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Region
          </Button>
        )}
      </div>

      {/* Instructions */}
      {isDrawing && (
        <div className="text-sm bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 rounded-lg p-3">
          <p className="font-medium mb-1">Editing Mode - Map dragging disabled</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li><strong>Click on the map</strong> to add points to your region outline</li>
            <li>Drag the white markers to adjust positions</li>
            <li>Drag the small gold markers on the lines to add new points</li>
            <li>Right-click a white marker to remove that point</li>
            <li>You need at least 3 points to form a region</li>
          </ul>
        </div>
      )}

      {/* Map */}
      <div
        ref={mapRef}
        className={`rounded-lg overflow-hidden border ${isDrawing ? 'cursor-crosshair' : ''}`}
        style={{ height: '400px', width: '100%' }}
      />

      {/* Status */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {coordinates.length === 0
            ? 'No region defined'
            : `${coordinates.length} points${coordinates.length < 3 ? ' (need at least 3)' : ''}`}
        </span>
        {hasChanges && (
          <span className="text-amber-500">Unsaved changes</span>
        )}
      </div>
    </div>
  )
}
