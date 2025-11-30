'use client'

import { useState, useEffect, useRef } from 'react'

// Preset colors for quick selection
const PRESET_COLORS = [
  // Reds
  '#ef4444', '#dc2626', '#b91c1c', '#991b1b',
  // Oranges
  '#f97316', '#ea580c', '#c2410c', '#9a3412',
  // Ambers/Yellows
  '#f59e0b', '#d97706', '#eab308', '#ca8a04',
  // Greens
  '#22c55e', '#16a34a', '#15803d', '#166534',
  // Teals/Cyans
  '#14b8a6', '#0d9488', '#0891b2', '#0e7490',
  // Blues
  '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af',
  // Indigos
  '#6366f1', '#4f46e5', '#4338ca', '#3730a3',
  // Purples
  '#a855f7', '#9333ea', '#7c3aed', '#6d28d9',
  // Pinks
  '#ec4899', '#db2777', '#be185d', '#9d174d',
  // Grays
  '#6b7280', '#4b5563', '#374151', '#1f2937',
]

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  onClose: () => void
}

export function ColorPicker({ value, onChange, onClose }: ColorPickerProps) {
  const [selectedColor, setSelectedColor] = useState(value || '#3b82f6')
  const [hexInput, setHexInput] = useState(value || '#3b82f6')
  const modalRef = useRef<HTMLDivElement>(null)

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

  // Update hex input when color changes
  useEffect(() => {
    setHexInput(selectedColor)
  }, [selectedColor])

  const handleHexChange = (hex: string) => {
    setHexInput(hex)
    // Validate hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      setSelectedColor(hex)
    }
  }

  const handleSelect = () => {
    onChange(selectedColor)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={modalRef}
        className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-lg">Select Color</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Color Preview */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-4">
            <div
              className="h-16 w-16 rounded-xl shadow-inner flex-shrink-0"
              style={{ backgroundColor: selectedColor }}
            />
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Hex Color</label>
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handleHexChange(e.target.value)}
                placeholder="#3b82f6"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>
        </div>

        {/* Native Color Picker */}
        <div className="p-4 border-b border-border">
          <label className="block text-sm font-medium mb-2">Color Wheel</label>
          <input
            type="color"
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            className="w-full h-12 rounded-lg border border-border cursor-pointer"
          />
        </div>

        {/* Preset Colors */}
        <div className="p-4">
          <label className="block text-sm font-medium mb-2">Preset Colors</label>
          <div className="grid grid-cols-8 gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                title={color}
                className={`h-8 w-8 rounded-lg transition-all ${
                  selectedColor === color
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  )
}
