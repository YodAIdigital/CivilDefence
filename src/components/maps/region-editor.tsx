'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, Trash2, RotateCcw, Save, Pencil, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { loadGoogleMaps } from '@/lib/google-maps-loader'
import type { RegionCoordinate, RegionPolygon } from '@/types/database'

interface RegionEditorProps {
  initialPolygon?: RegionPolygon | null
  initialColor?: string
  initialOpacity?: number
  center?: { lat: number; lng: number } | undefined
  onSave: (polygon: RegionPolygon | null, color: string, opacity: number) => Promise<void>
  isSaving?: boolean
}

const DEFAULT_CENTER = { lat: -41.2865, lng: 174.7762 } // Wellington, NZ
const DEFAULT_COLOR = '#3b82f6'
const DEFAULT_OPACITY = 0.2

export function RegionEditor({
  initialPolygon,
  initialColor = DEFAULT_COLOR,
  initialOpacity = DEFAULT_OPACITY,
  center,
  onSave,
  isSaving = false,
}: RegionEditorProps) {
  const mapCenter = center || DEFAULT_CENTER
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const polygonRef = useRef<google.maps.Polygon | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])

  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [coordinates, setCoordinates] = useState<RegionCoordinate[]>(initialPolygon || [])
  const [color, setColor] = useState(initialColor)
  const [opacity, setOpacity] = useState(initialOpacity)
  const [hasChanges, setHasChanges] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const initRef = useRef(false)
  const isDrawingRef = useRef(false)
  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  // Update polygon appearance when color/opacity changes
  const updatePolygonStyle = useCallback(() => {
    if (polygonRef.current) {
      polygonRef.current.setOptions({
        fillColor: color,
        fillOpacity: opacity,
        strokeColor: color,
        strokeOpacity: 1,
        strokeWeight: 2,
      })
    }
  }, [color, opacity])

  // Create/update the polygon on the map
  const updatePolygon = useCallback(() => {
    if (!mapInstanceRef.current) return

    // Remove existing polygon
    if (polygonRef.current) {
      polygonRef.current.setMap(null)
    }

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    if (coordinates.length < 3) {
      polygonRef.current = null
      return
    }

    // Create polygon
    const path = coordinates.map(c => ({ lat: c.lat, lng: c.lng }))
    polygonRef.current = new google.maps.Polygon({
      paths: path,
      fillColor: color,
      fillOpacity: opacity,
      strokeColor: color,
      strokeOpacity: 1,
      strokeWeight: 2,
      editable: isDrawing,
      draggable: false,
      map: mapInstanceRef.current,
    })

    // Add vertex markers when in drawing mode
    if (isDrawing) {
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
            strokeColor: color,
            strokeWeight: 2,
          },
          title: `Point ${index + 1}`,
        })

        // Update coordinates when marker is dragged
        marker.addListener('dragend', () => {
          const pos = marker.getPosition()
          if (pos) {
            setCoordinates(prev => {
              const newCoords = [...prev]
              newCoords[index] = { lat: pos.lat(), lng: pos.lng() }
              return newCoords
            })
            setHasChanges(true)
          }
        })

        // Right-click to remove point
        marker.addListener('rightclick', () => {
          setCoordinates(prev => prev.filter((_, i) => i !== index))
          setHasChanges(true)
        })

        markersRef.current.push(marker)
      })
    }

    // Fit bounds to polygon
    if (coordinates.length > 0 && mapInstanceRef.current) {
      const bounds = new google.maps.LatLngBounds()
      coordinates.forEach(c => bounds.extend({ lat: c.lat, lng: c.lng }))
      mapInstanceRef.current.fitBounds(bounds, 50)
    }
  }, [coordinates, color, opacity, isDrawing])

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

  // Update polygon when coordinates change
  useEffect(() => {
    updatePolygon()
  }, [updatePolygon])

  // Update style when color/opacity changes
  useEffect(() => {
    updatePolygonStyle()
  }, [updatePolygonStyle])

  const handleClear = () => {
    setCoordinates([])
    setHasChanges(true)
  }

  const handleReset = () => {
    setCoordinates(initialPolygon || [])
    setColor(initialColor)
    setOpacity(initialOpacity)
    setHasChanges(false)
  }

  const handleSave = async () => {
    const polygonToSave = coordinates.length >= 3 ? coordinates : null
    await onSave(polygonToSave, color, opacity)
    setHasChanges(false)
  }

  const toggleDrawingMode = () => {
    setIsDrawing(prev => !prev)
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
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={isDrawing ? 'default' : 'outline'}
          size="sm"
          onClick={toggleDrawingMode}
          className="gap-2"
        >
          <Pencil className="h-4 w-4" />
          {isDrawing ? 'Done Editing' : 'Edit Region'}
        </Button>

        {isDrawing && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </Button>

            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Color:</label>
              <Input
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value)
                  setHasChanges(true)
                }}
                className="w-10 h-8 p-1 cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Opacity:</label>
              <input
                type="range"
                min="0.1"
                max="0.5"
                step="0.05"
                value={opacity}
                onChange={(e) => {
                  setOpacity(parseFloat(e.target.value))
                  setHasChanges(true)
                }}
                className="w-20"
              />
              <span className="text-xs text-muted-foreground">{Math.round(opacity * 100)}%</span>
            </div>
          </>
        )}

        <div className="flex-1" />

        {hasChanges && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
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
          </>
        )}
      </div>

      {/* Instructions */}
      {isDrawing && (
        <div className="text-sm bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 rounded-lg p-3">
          <p className="font-medium mb-1">✏️ Drawing Mode Active - Map dragging disabled</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li><strong>Click anywhere on the map</strong> to add points to your region outline</li>
            <li>Drag the white circle markers to adjust point positions</li>
            <li>Right-click a marker to remove that point</li>
            <li>You need at least 3 points to form a region</li>
            <li>Use the search box above to navigate to different areas</li>
          </ul>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search for a location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
