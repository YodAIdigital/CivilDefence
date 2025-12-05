'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Plus, Trash2, Edit2, Users, Lightbulb } from 'lucide-react'
import type { WizardData } from '../onboarding-wizard'

interface StepFourProps {
  data: WizardData
  updateData: (updates: Partial<WizardData>) => void
}

const SUGGESTED_GROUPS = [
  {
    name: 'Leadership Team',
    description: 'Community coordinators and decision makers',
    color: '#8B5CF6',
    icon: 'group'
  },
  {
    name: 'First Responders',
    description: 'Medical and emergency response personnel',
    color: '#EF4444',
    icon: 'local_hospital'
  },
  {
    name: 'Communication Team',
    description: 'Manage alerts and coordinate information',
    color: '#3B82F6',
    icon: 'campaign'
  },
  {
    name: 'Logistics Team',
    description: 'Resource management and distribution',
    color: '#10B981',
    icon: 'inventory_2'
  },
  {
    name: 'Vulnerable Members',
    description: 'Elderly, disabled, or those requiring assistance',
    color: '#F59E0B',
    icon: 'accessible'
  },
  {
    name: 'Volunteers',
    description: 'General support and community assistance',
    color: '#14B8A6',
    icon: 'volunteer_activism'
  },
]

const COLOR_PRESETS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1',
  '#F97316', '#84CC16', '#06B6D4', '#A855F7'
]

export function StepFour({ data, updateData }: StepFourProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    icon: 'group'
  })

  const handleAddGroup = () => {
    if (formData.name.trim()) {
      if (editingIndex !== null) {
        // Update existing group
        const newGroups = [...data.groups]
        newGroups[editingIndex] = formData
        updateData({ groups: newGroups })
        setEditingIndex(null)
      } else {
        // Add new group
        updateData({ groups: [...data.groups, formData] })
      }
      setFormData({ name: '', description: '', color: '#3B82F6', icon: 'group' })
      setIsEditing(false)
    }
  }

  const handleEditGroup = (index: number) => {
    const group = data.groups[index]
    if (group) {
      setFormData(group)
      setEditingIndex(index)
      setIsEditing(true)
    }
  }

  const handleDeleteGroup = (index: number) => {
    const newGroups = data.groups.filter((_, i) => i !== index)
    updateData({ groups: newGroups })
  }

  const handleAddSuggested = (group: typeof SUGGESTED_GROUPS[0]) => {
    if (!data.groups.some(g => g.name === group.name)) {
      updateData({ groups: [...data.groups, group] })
    }
  }

  const handleCancel = () => {
    setFormData({ name: '', description: '', color: '#3B82F6', icon: 'group' })
    setIsEditing(false)
    setEditingIndex(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Setup Member Groups</h3>
        <p className="text-muted-foreground text-sm">
          Organize your community into groups for better coordination and targeted alerts. You can
          add groups now or skip this step and set them up later.
        </p>
      </div>

      {/* Suggested Groups */}
      {!isEditing && data.groups.length < 6 && (
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950">
          <div className="flex items-start gap-3 mb-3">
            <Lightbulb className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-sm mb-1">Suggested Groups</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Click to quickly add common emergency response groups
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {SUGGESTED_GROUPS.map((group, index) => {
              const isAdded = data.groups.some(g => g.name === group.name)
              return (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddSuggested(group)}
                  disabled={isAdded}
                  className="justify-start h-auto py-2 text-left"
                >
                  <div
                    className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="text-xs font-medium truncate">
                    {isAdded ? '✓ ' : ''}{group.name}
                  </span>
                </Button>
              )
            })}
          </div>
        </Card>
      )}

      {/* Group Form */}
      {!isEditing && (
        <Button onClick={() => setIsEditing(true)} variant="outline" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Create Custom Group
        </Button>
      )}

      {isEditing && (
        <Card className="p-4 border-2 border-primary">
          <h4 className="font-medium mb-4">
            {editingIndex !== null ? 'Edit Group' : 'Create New Group'}
          </h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group Name *</Label>
              <Input
                id="groupName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Medical Team"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="groupDescription">Description</Label>
              <Textarea
                id="groupDescription"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this group's role..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Group Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-10 w-20"
                />
                <div className="flex-1 grid grid-cols-6 gap-1">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={`h-8 w-8 rounded border-2 ${
                        formData.color === color ? 'border-foreground ring-2 ring-offset-2' : 'border-muted'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleCancel} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleAddGroup}
                disabled={!formData.name.trim()}
                className="flex-1"
              >
                {editingIndex !== null ? 'Update Group' : 'Add Group'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Groups List */}
      {data.groups.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">Created Groups ({data.groups.length})</h4>
          </div>
          <div className="space-y-2">
            {data.groups.map((group, index) => (
              <Card key={index} className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  >
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium">{group.name}</h5>
                    {group.description && (
                      <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditGroup(index)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteGroup(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {data.groups.length === 0 && !isEditing && (
        <Card className="p-8 text-center border-dashed">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h4 className="font-medium mb-2">No Groups Yet</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Add groups to organize your members, or skip and set them up later in community
            settings.
          </p>
        </Card>
      )}

      <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200">
        <h5 className="font-medium text-sm mb-2 text-blue-900 dark:text-blue-100">
          Why use groups?
        </h5>
        <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Send targeted alerts to specific teams</li>
          <li>• Organize members by role or skill set</li>
          <li>• Track response status by group</li>
          <li>• Manage permissions and access levels</li>
        </ul>
      </Card>
    </div>
  )
}
