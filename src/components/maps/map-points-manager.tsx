'use client'

import { useState } from 'react'
import { GoogleMap, MapMarker } from './google-map'
import { AddressAutocomplete, type AddressResult } from './address-autocomplete'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MapPin, X, Plus, Edit2, Trash2, Phone, Mail, User } from 'lucide-react'
import type { CommunityMapPoint, MapPointType, CreateCommunityMapPoint, UpdateCommunityMapPoint } from '@/types/database'
import { MAP_POINT_TYPE_CONFIG } from '@/types/database'

interface MapPointsManagerProps {
  communityId: string
  userId: string
  points: CommunityMapPoint[]
  onAdd: (point: CreateCommunityMapPoint) => Promise<void>
  onUpdate: (id: string, point: UpdateCommunityMapPoint) => Promise<void>
  onDelete: (id: string) => Promise<void>
  isSaving: boolean
}

interface PointFormData {
  name: string
  description: string
  point_type: MapPointType
  address: string
  lat: number | null
  lng: number | null
  contact_name: string
  contact_phone: string
  contact_email: string
}

const initialFormData: PointFormData = {
  name: '',
  description: '',
  point_type: 'other',
  address: '',
  lat: null,
  lng: null,
  contact_name: '',
  contact_phone: '',
  contact_email: '',
}

export function MapPointsManager({
  communityId,
  userId,
  points,
  onAdd,
  onUpdate,
  onDelete,
  isSaving,
}: MapPointsManagerProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editingPoint, setEditingPoint] = useState<CommunityMapPoint | null>(null)
  const [formData, setFormData] = useState<PointFormData>(initialFormData)
  const [expandedPointId, setExpandedPointId] = useState<string | null>(null)

  const handleAddNew = () => {
    setEditingPoint(null)
    setFormData(initialFormData)
    setIsEditing(true)
  }

  const handleEdit = (point: CommunityMapPoint) => {
    setEditingPoint(point)
    setFormData({
      name: point.name,
      description: point.description || '',
      point_type: point.point_type,
      address: point.address || '',
      lat: point.lat,
      lng: point.lng,
      contact_name: point.contact_name || '',
      contact_phone: point.contact_phone || '',
      contact_email: point.contact_email || '',
    })
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditingPoint(null)
    setFormData(initialFormData)
  }

  const handleAddressSelect = (result: AddressResult) => {
    setFormData(prev => ({
      ...prev,
      address: result.formattedAddress,
      lat: result.lat,
      lng: result.lng,
    }))
  }

  const handleMapClick = (lat: number, lng: number) => {
    setFormData(prev => ({
      ...prev,
      lat,
      lng,
    }))
  }

  const handleSave = async () => {
    if (!formData.name || formData.lat === null || formData.lng === null) return

    const config = MAP_POINT_TYPE_CONFIG[formData.point_type]

    if (editingPoint) {
      const updateData: UpdateCommunityMapPoint = {
        name: formData.name,
        point_type: formData.point_type,
        icon: config.icon,
        color: config.color,
        lat: formData.lat,
        lng: formData.lng,
        updated_by: userId,
      }
      if (formData.description) updateData.description = formData.description
      if (formData.address) updateData.address = formData.address
      if (formData.contact_name) updateData.contact_name = formData.contact_name
      if (formData.contact_phone) updateData.contact_phone = formData.contact_phone
      if (formData.contact_email) updateData.contact_email = formData.contact_email

      await onUpdate(editingPoint.id, updateData)
    } else {
      const createData: CreateCommunityMapPoint = {
        community_id: communityId,
        name: formData.name,
        point_type: formData.point_type,
        icon: config.icon,
        color: config.color,
        lat: formData.lat,
        lng: formData.lng,
        created_by: userId,
      }
      if (formData.description) createData.description = formData.description
      if (formData.address) createData.address = formData.address
      if (formData.contact_name) createData.contact_name = formData.contact_name
      if (formData.contact_phone) createData.contact_phone = formData.contact_phone
      if (formData.contact_email) createData.contact_email = formData.contact_email

      await onAdd(createData)
    }

    handleCancel()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this map point?')) return
    await onDelete(id)
  }

  // Create markers for map display
  const markers: MapMarker[] = points.map(point => {
    const marker: MapMarker = {
      id: point.id,
      lat: point.lat,
      lng: point.lng,
      title: point.name,
      color: 'blue' as const,
    }
    if (point.address) {
      marker.description = point.address
    }
    return marker
  })

  // Add editing marker if we have a temp location
  const editingMarkers: MapMarker[] = formData.lat !== null && formData.lng !== null
    ? [{
        id: 'editing',
        lat: formData.lat,
        lng: formData.lng,
        title: formData.name || 'New Location',
        color: 'red' as const,
      }]
    : []

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            {editingPoint ? 'Edit Map Point' : 'Add New Map Point'}
          </h3>
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium mb-1 block">Name *</label>
            <Input
              placeholder="e.g., Wellington Hospital"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Type *</label>
            <select
              value={formData.point_type}
              onChange={(e) => setFormData(prev => ({ ...prev, point_type: e.target.value as MapPointType }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {Object.entries(MAP_POINT_TYPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Description</label>
          <textarea
            placeholder="Brief description of this location..."
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px] resize-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Address / Location *</label>
          <AddressAutocomplete
            value={formData.address}
            onChange={(value) => setFormData(prev => ({ ...prev, address: value }))}
            onSelect={handleAddressSelect}
            placeholder="Search for an address..."
          />
        </div>

        <div className="text-sm text-muted-foreground">
          Search for an address above, or click on the map to select the location
        </div>

        <GoogleMap
          markers={editingMarkers}
          height="250px"
          onMapClick={handleMapClick}
          {...(formData.lat !== null && formData.lng !== null && { center: { lat: formData.lat, lng: formData.lng } })}
          zoom={formData.lat !== null ? 15 : 13}
        />

        {formData.lat !== null && formData.lng !== null && (
          <p className="text-sm text-muted-foreground">
            Selected: {formData.lat.toFixed(6)}, {formData.lng.toFixed(6)}
          </p>
        )}

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <User className="h-4 w-4" />
            Contact Information (Optional)
          </h4>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Contact Name</label>
              <Input
                placeholder="Contact person"
                value={formData.contact_name}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Phone Number</label>
              <Input
                placeholder="e.g., 04 123 4567"
                value={formData.contact_phone}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Email</label>
              <Input
                type="email"
                placeholder="contact@example.com"
                value={formData.contact_email}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={!formData.name || formData.lat === null || formData.lng === null || isSaving}
          >
            {isSaving ? (
              <>
                <span className="material-icons animate-spin text-sm mr-2">sync</span>
                Saving...
              </>
            ) : (
              editingPoint ? 'Update Point' : 'Add Point'
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {points.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">
            No map reference points added yet
          </p>
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Map Point
          </Button>
        </div>
      ) : (
        <>
          {/* Map showing all points */}
          <div className="rounded-lg overflow-hidden border">
            <GoogleMap
              markers={markers}
              height="250px"
              zoom={12}
            />
          </div>

          {/* Points list */}
          <div className="space-y-2">
            {points.map(point => {
              const config = MAP_POINT_TYPE_CONFIG[point.point_type]
              const isExpanded = expandedPointId === point.id

              return (
                <div
                  key={point.id}
                  className="rounded-lg border bg-card overflow-hidden"
                >
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedPointId(isExpanded ? null : point.id)}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0"
                      style={{ backgroundColor: `${config.color}20` }}
                    >
                      <span className="material-icons" style={{ color: config.color }}>
                        {config.icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{point.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {config.label} {point.address ? `• ${point.address}` : ''}
                      </p>
                    </div>
                    <span className="material-icons text-muted-foreground">
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="border-t px-3 py-3 bg-muted/30">
                      {point.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {point.description}
                        </p>
                      )}

                      {(point.contact_name || point.contact_phone || point.contact_email) && (
                        <div className="space-y-1 mb-3">
                          {point.contact_name && (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span>{point.contact_name}</span>
                            </div>
                          )}
                          {point.contact_phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <a href={`tel:${point.contact_phone}`} className="text-primary hover:underline">
                                {point.contact_phone}
                              </a>
                            </div>
                          )}
                          {point.contact_email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <a href={`mailto:${point.contact_email}`} className="text-primary hover:underline">
                                {point.contact_email}
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                        <MapPin className="h-3 w-3" />
                        {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEdit(point)
                          }}
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(point.id)
                          }}
                          disabled={isSaving}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="material-icons text-sm mr-1">directions</span>
                            Directions
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <Button onClick={handleAddNew} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Map Point
          </Button>
        </>
      )}
    </div>
  )
}
