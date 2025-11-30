'use client'

import { useState, useEffect, useRef } from 'react'

// Common Material Icons for emergency/response plans
const COMMON_ICONS = [
  // Emergency & Safety
  'warning', 'error', 'emergency', 'health_and_safety', 'security', 'shield',
  'local_fire_department', 'water_drop', 'storm', 'thunderstorm', 'flood', 'landslide',
  'volcano', 'tsunami', 'earthquake', 'tornado', 'severe_cold', 'ac_unit',
  // Medical
  'medical_services', 'local_hospital', 'healing', 'health_and_safety', 'medication',
  'vaccines', 'heart_broken', 'emergency_home', 'emergency_share',
  // Communication
  'phone', 'call', 'contact_phone', 'contacts', 'phone_in_talk', 'phone_enabled',
  'radio', 'speaker_phone', 'notifications', 'campaign', 'announcement',
  // Location & Navigation
  'location_on', 'place', 'home', 'cottage', 'house', 'meeting_room',
  'directions', 'navigation', 'map', 'explore', 'directions_run', 'directions_walk',
  'directions_car', 'local_parking', 'garage',
  // Actions & Tasks
  'checklist', 'task_alt', 'check_circle', 'done', 'done_all', 'verified',
  'playlist_add_check', 'fact_check', 'assignment', 'assignment_turned_in',
  // Time & Events
  'event', 'schedule', 'access_time', 'timer', 'hourglass_empty', 'update',
  'history', 'restore', 'pending', 'pending_actions',
  // People & Groups
  'person', 'people', 'groups', 'family_restroom', 'elderly', 'child_care',
  'accessibility', 'accessible', 'self_improvement', 'volunteer_activism',
  // Supplies & Equipment
  'inventory_2', 'inventory', 'backpack', 'luggage', 'local_grocery_store',
  'kitchen', 'restaurant', 'local_drink', 'battery_full', 'flashlight_on',
  'power', 'power_off', 'electrical_services', 'gas_meter', 'water',
  // Documents & Info
  'info', 'help', 'menu_book', 'article', 'description', 'library_books',
  'book', 'auto_stories', 'feed', 'format_list_bulleted',
  // Tools & Utilities
  'build', 'construction', 'handyman', 'hardware', 'settings',
  'radio_button_checked', 'radio_button_unchecked',
  // Nature & Environment
  'nature', 'forest', 'park', 'grass', 'terrain', 'landscape',
  // Vehicles & Transport
  'local_shipping', 'fire_truck', 'airport_shuttle', 'directions_boat',
  // Buildings
  'domain', 'business', 'store', 'storefront', 'school', 'church',
  // Misc
  'star', 'favorite', 'visibility', 'visibility_off', 'lock', 'lock_open',
  'public', 'share', 'save', 'download', 'upload', 'print',
]

interface IconPickerProps {
  value: string
  onChange: (icon: string) => void
  onClose: () => void
}

export function IconPicker({ value, onChange, onClose }: IconPickerProps) {
  const [search, setSearch] = useState('')
  const [selectedIcon, setSelectedIcon] = useState(value)
  const modalRef = useRef<HTMLDivElement>(null)

  // Filter icons by search
  const filteredIcons = search.trim()
    ? COMMON_ICONS.filter((icon) =>
        icon.toLowerCase().includes(search.toLowerCase().replace(/\s+/g, '_'))
      )
    : COMMON_ICONS

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Handle escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleSelect = (icon: string) => {
    setSelectedIcon(icon)
    onChange(icon)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={modalRef}
        className="w-full max-w-lg max-h-[80vh] bg-card border border-border rounded-xl shadow-xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-lg">Select Icon</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background"
              autoFocus
            />
          </div>
        </div>

        {/* Icon Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredIcons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <span className="material-icons text-4xl">search_off</span>
              <p className="mt-2">No icons found</p>
            </div>
          ) : (
            <div className="grid grid-cols-8 gap-2">
              {filteredIcons.map((icon) => (
                <button
                  key={icon}
                  onClick={() => handleSelect(icon)}
                  title={icon.replace(/_/g, ' ')}
                  className={`flex items-center justify-center h-10 w-10 rounded-lg transition-colors ${
                    selectedIcon === icon
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <span className="material-icons">{icon}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer with custom input */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted flex-shrink-0">
              <span className="material-icons">{selectedIcon}</span>
            </div>
            <input
              type="text"
              value={selectedIcon}
              onChange={(e) => setSelectedIcon(e.target.value)}
              placeholder="Or enter icon name manually"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={() => handleSelect(selectedIcon)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              Select
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Browse all icons at{' '}
            <a
              href="https://fonts.google.com/icons"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Google Material Icons
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
