import { NextRequest, NextResponse } from 'next/server'

interface GenerateMapImageRequest {
  coordinates: Array<{ lat: number; lng: number }>
  meetingPoint?: { lat: number; lng: number; name?: string } | null
  regionColor?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateMapImageRequest = await request.json()
    const { coordinates, meetingPoint, regionColor = '#FEB100' } = body

    if (!coordinates || coordinates.length < 3) {
      return NextResponse.json(
        { error: 'At least 3 coordinates are required to form a polygon' },
        { status: 400 }
      )
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Maps API key not configured' },
        { status: 503 }
      )
    }

    // Calculate bounds for the polygon to determine center and zoom
    const lats = coordinates.map(c => c.lat)
    const lngs = coordinates.map(c => c.lng)
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2

    // Calculate appropriate zoom level based on polygon size
    const latSpan = Math.max(...lats) - Math.min(...lats)
    const lngSpan = Math.max(...lngs) - Math.min(...lngs)
    const maxSpan = Math.max(latSpan, lngSpan)

    let zoom = 14
    if (maxSpan > 0.5) zoom = 10
    else if (maxSpan > 0.2) zoom = 11
    else if (maxSpan > 0.1) zoom = 12
    else if (maxSpan > 0.05) zoom = 13

    // Build polygon path string for Static Maps API
    // Format: lat,lng|lat,lng|...
    const pathPoints = coordinates.map(c => `${c.lat},${c.lng}`).join('|')
    // Close the polygon by adding first point at end
    const firstPoint = coordinates[0]
    const closedPath = firstPoint ? `${pathPoints}|${firstPoint.lat},${firstPoint.lng}` : pathPoints

    // Convert hex color to format for Static Maps
    // fillcolor needs to be in 0xRRGGBBAA format
    const hexColor = regionColor.replace('#', '')
    const fillColor = `0x${hexColor}40` // 25% opacity (40 hex = 64 decimal ≈ 25%)
    const strokeColor = `0x${hexColor}FF` // 100% opacity

    // Build static map URL
    const staticMapUrl = new URL('https://maps.googleapis.com/maps/api/staticmap')
    staticMapUrl.searchParams.set('center', `${centerLat},${centerLng}`)
    staticMapUrl.searchParams.set('zoom', zoom.toString())
    staticMapUrl.searchParams.set('size', '640x480')
    staticMapUrl.searchParams.set('scale', '2') // High resolution
    staticMapUrl.searchParams.set('maptype', 'roadmap')
    staticMapUrl.searchParams.set('key', apiKey)

    // Add polygon path with fill and stroke
    // Format: fillcolor:color|weight:x|color:strokecolor|point1|point2|...
    staticMapUrl.searchParams.set('path', `fillcolor:${fillColor}|weight:2|color:${strokeColor}|${closedPath}`)

    // Add meeting point marker if available
    if (meetingPoint) {
      staticMapUrl.searchParams.set('markers', `color:green|label:M|${meetingPoint.lat},${meetingPoint.lng}`)
    }

    console.log('[generate-map-image] Fetching static map:', staticMapUrl.toString().substring(0, 200) + '...')

    // Fetch the image from Google Static Maps API
    const response = await fetch(staticMapUrl.toString())

    if (!response.ok) {
      console.error('[generate-map-image] Static Maps API error:', response.status, await response.text())
      return NextResponse.json(
        { error: 'Failed to fetch map image from Google' },
        { status: 502 }
      )
    }

    // Get the image as ArrayBuffer and convert to base64
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = response.headers.get('content-type') || 'image/png'
    const dataUrl = `data:${mimeType};base64,${base64}`

    console.log('[generate-map-image] Successfully generated map image, size:', base64.length, 'chars')

    return NextResponse.json({
      success: true,
      imageUrl: dataUrl,
      center: { lat: centerLat, lng: centerLng },
      zoom,
    })
  } catch (error) {
    console.error('[generate-map-image] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate map image' },
      { status: 500 }
    )
  }
}
