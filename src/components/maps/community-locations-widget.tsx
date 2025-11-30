'use client'

import { useState, useEffect, useCallback } from 'react'
import { GoogleMap, MapMarker, MapRegion } from './google-map'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { useCommunity } from '@/contexts/community-context'
import { MapPin, Phone, Mail, Navigation, ChevronDown, ChevronUp, Layers, Search, X } from 'lucide-react'
import type { CommunityMapPoint, MapPointType, RegionPolygon } from '@/types/database'
import { MAP_POINT_TYPE_CONFIG } from '@/types/database'

interface CommunityRegionData {
  id: string
  name: string
  region_polygon: RegionPolygon | null
  region_color: string
  region_opacity: number
}

interface CommunityLocationsWidgetProps {
  showHeader?: boolean
  maxHeight?: string
}

export function CommunityLocationsWidget({
  showHeader = true,
  maxHeight = '400px',
}: CommunityLocationsWidgetProps) {
  const { user } = useAuth()
  const { activeCommunity } = useCommunity()
  const [locations, setLocations] = useState<CommunityMapPoint[]>([])
  const [communityRegions, setCommunityRegions] = useState<CommunityRegionData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAllLocations, setShowAllLocations] = useState(false)
  const [hiddenTypes, setHiddenTypes] = useState<Set<MapPointType>>(new Set())
  const [showRegions, setShowRegions] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchLocations = useCallback(async () => {
    if (!user) {
      setLocations([])
      setCommunityRegions([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)

      // Use active community if available, otherwise show nothing
      const communityIds = activeCommunity ? [activeCommunity.id] : []

      if (communityIds.length === 0) {
        setLocations([])
        setCommunityRegions([])
        setIsLoading(false)
        return
      }

      // Fetch map points from the active community
      // RLS will handle visibility filtering based on user's role
      const supabaseAny = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            in: (col: string, vals: string[]) => {
              eq: (col: string, val: boolean) => {
                order: (col: string, opts: { ascending: boolean }) => Promise<{ data: CommunityMapPoint[] | null; error: Error | null }>
              }
            }
          }
        }
      }

      const { data, error } = await supabaseAny
        .from('community_map_points')
        .select('*')
        .in('community_id', communityIds)
        .eq('is_active', true)
        .order('point_type', { ascending: true })

      if (error) {
        console.error('Error fetching locations:', error)
        setLocations([])
      } else {
        setLocations(data || [])
      }

      // Fetch community region for active community
      const { data: regionsData } = await supabase
        .from('communities')
        .select('id, name, region_polygon, region_color, region_opacity')
        .in('id', communityIds)
        .not('region_polygon', 'is', null)

      if (regionsData) {
        setCommunityRegions(regionsData as unknown as CommunityRegionData[])
      }
    } catch (err) {
      console.error('Error fetching locations:', err)
      setLocations([])
    } finally {
      setIsLoading(false)
    }
  }, [user, activeCommunity])

  useEffect(() => {
    fetchLocations()
  }, [fetchLocations])

  if (isLoading) {
    return (
      <div className="rounded-xl bg-card border border-border p-6">
        {showHeader && (
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="material-icons text-green-500">map</span>
            Community Locations
          </h2>
        )}
        <div className="flex items-center justify-center py-8">
          <span className="material-icons animate-spin text-2xl text-primary">sync</span>
        </div>
      </div>
    )
  }

  if (locations.length === 0) {
    return null // Don't show widget if no locations
  }

  // Get meeting points for map centering
  const meetingPoints = locations.filter(l => l.point_type === 'meeting_point')

  // Toggle visibility of a location type
  const toggleType = (type: MapPointType) => {
    setHiddenTypes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(type)) {
        newSet.delete(type)
      } else {
        newSet.add(type)
      }
      return newSet
    })
  }

  // Filter locations based on hidden types and search query
  const visibleLocations = locations.filter(l => {
    // Check if type is hidden
    if (hiddenTypes.has(l.point_type)) return false

    // Check search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      const config = MAP_POINT_TYPE_CONFIG[l.point_type]
      const typeLabel = config?.label?.toLowerCase() || ''
      const name = l.name?.toLowerCase() || ''
      const description = l.description?.toLowerCase() || ''
      const address = l.address?.toLowerCase() || ''

      return (
        name.includes(query) ||
        description.includes(query) ||
        typeLabel.includes(query) ||
        address.includes(query)
      )
    }

    return true
  })

  // Create markers for the map using colors from config (only visible types)
  const markers: MapMarker[] = visibleLocations.map(location => {
    const config = MAP_POINT_TYPE_CONFIG[location.point_type]
    const marker: MapMarker = {
      id: location.id,
      lat: location.lat,
      lng: location.lng,
      title: location.name,
      color: config.color, // Use the hex color from config
    }
    if (location.address) {
      marker.description = location.address
    }
    return marker
  })

  // Create regions for the map
  const regions: MapRegion[] = communityRegions
    .filter(c => c.region_polygon && c.region_polygon.length >= 3)
    .map(c => ({
      id: c.id,
      name: c.name,
      polygon: c.region_polygon!,
      color: c.region_color || '#3b82f6',
      opacity: c.region_opacity || 0.2,
    }))

  // Calculate map center based on all markers
  const getMapCenter = (): { lat: number; lng: number } | undefined => {
    if (locations.length === 0) return undefined

    // If there's an active community with a meeting point, center on that
    if (activeCommunity) {
      const activeMeetingPoint = meetingPoints.find(m => m.community_id === activeCommunity.id)
      if (activeMeetingPoint) {
        return { lat: activeMeetingPoint.lat, lng: activeMeetingPoint.lng }
      }
    }

    // Otherwise, center on first meeting point or first location
    const firstMeetingPoint = meetingPoints[0]
    if (firstMeetingPoint) {
      return { lat: firstMeetingPoint.lat, lng: firstMeetingPoint.lng }
    }

    const firstLocation = locations[0]
    if (firstLocation) {
      return { lat: firstLocation.lat, lng: firstLocation.lng }
    }

    return undefined
  }

  const mapCenter = getMapCenter()

  // Locations to display (filtered by search and limited)
  const displayLimit = 5
  const visibleMeetingPoints = visibleLocations.filter(l => l.point_type === 'meeting_point')
  const visibleReferenceLocations = visibleLocations.filter(l => l.point_type !== 'meeting_point')
  const allLocationsToShow = [...visibleMeetingPoints, ...visibleReferenceLocations]
  const locationsToDisplay = showAllLocations
    ? allLocationsToShow
    : allLocationsToShow.slice(0, displayLimit)

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      {showHeader && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="material-icons text-green-500">map</span>
                Community Locations
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Key locations from your community
              </p>
            </div>
            {/* Search Input */}
            <div className="relative flex-shrink-0 w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search Community"
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
          </div>
        </div>
      )}

      {/* Map */}
      <div className="relative">
        <GoogleMap
          markers={markers}
          regions={regions}
          showRegions={showRegions}
          height="450px"
          {...(mapCenter && { center: mapCenter })}
          zoom={markers.length === 1 ? 14 : 11}
          fitToRegions={regions.length > 0}
        />
        {/* Region toggle button */}
        {regions.length > 0 && (
          <button
            onClick={() => setShowRegions(prev => !prev)}
            className={`absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-colors ${
              showRegions
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-white/90 dark:bg-slate-800/90 text-muted-foreground hover:text-foreground'
            }`}
            title={showRegions ? 'Hide community regions' : 'Show community regions'}
          >
            <Layers className="h-3.5 w-3.5" />
            Region
          </button>
        )}
        {/* Dynamic Legend based on location types present - clickable to toggle */}
        {(() => {
          // Get unique point types that are present
          const typeSet = new Set(locations.map(l => l.point_type))
          const presentTypes: MapPointType[] = Array.from(typeSet)
          return (
            <div className="absolute bottom-2 left-2 bg-white/90 dark:bg-slate-800/90 rounded-lg px-3 py-2 text-xs shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                {presentTypes.map(type => {
                  const config = MAP_POINT_TYPE_CONFIG[type]
                  const isHidden = hiddenTypes.has(type)
                  return (
                    <button
                      key={type}
                      onClick={() => toggleType(type)}
                      className={`flex items-center gap-1 transition-opacity cursor-pointer hover:opacity-80 ${
                        isHidden ? 'opacity-40' : ''
                      }`}
                      title={isHidden ? `Show ${config.label}` : `Hide ${config.label}`}
                    >
                      <span
                        className={`w-3 h-3 rounded-full ${isHidden ? 'ring-1 ring-offset-1 ring-gray-400' : ''}`}
                        style={{ backgroundColor: isHidden ? '#9ca3af' : config.color }}
                      ></span>
                      <span className={isHidden ? 'line-through' : ''}>{config.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Locations List */}
      <div className="divide-y divide-border" style={{ maxHeight, overflowY: 'auto' }}>
        {/* No results message */}
        {searchQuery && allLocationsToShow.length === 0 && (
          <div className="p-6 text-center">
            <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No locations found matching &quot;{searchQuery}&quot;
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Clear search
            </button>
          </div>
        )}
        {locationsToDisplay.map(location => {
          const config = MAP_POINT_TYPE_CONFIG[location.point_type]
          const isExpanded = expandedId === location.id
          const isMeetingPoint = location.point_type === 'meeting_point'

          return (
            <div
              key={location.id}
              className={`${isMeetingPoint ? 'bg-green-50/50 dark:bg-green-950/20' : ''}`}
            >
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : location.id)}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0"
                  style={{ backgroundColor: `${config.color}15` }}
                >
                  <span className="material-icons text-xl" style={{ color: config.color }}>
                    {config.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{location.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {config.label}
                  </p>
                </div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Navigation className="h-3 w-3" />
                  Directions
                </a>
                <span className="material-icons text-muted-foreground text-lg">
                  {isExpanded ? 'expand_less' : 'expand_more'}
                </span>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 pl-16 space-y-2">
                  {location.address && (
                    <p className="text-sm text-muted-foreground flex items-start gap-2">
                      <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      {location.address}
                    </p>
                  )}
                  {location.description && (
                    <p className="text-sm text-muted-foreground">
                      {location.description}
                    </p>
                  )}
                  {location.contact_phone && (
                    <a
                      href={`tel:${location.contact_phone}`}
                      className="text-sm text-primary hover:underline flex items-center gap-2"
                    >
                      <Phone className="h-4 w-4" />
                      {location.contact_phone}
                    </a>
                  )}
                  {location.contact_email && (
                    <a
                      href={`mailto:${location.contact_email}`}
                      className="text-sm text-primary hover:underline flex items-center gap-2"
                    >
                      <Mail className="h-4 w-4" />
                      {location.contact_email}
                    </a>
                  )}
                  {location.contact_name && (
                    <p className="text-sm text-muted-foreground">
                      Contact: {location.contact_name}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Show More/Less Button */}
      {allLocationsToShow.length > displayLimit && (
        <div className="p-3 border-t border-border">
          <button
            onClick={() => setShowAllLocations(!showAllLocations)}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAllLocations ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show All {allLocationsToShow.length} Locations
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
