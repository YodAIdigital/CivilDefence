'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  type CommunityContact,
  type Profile,
  SUGGESTED_ROLES,
} from '@/types/database'
import {
  Plus,
  Trash2,
  Edit2,
  X,
  GripVertical,
  User,
  UserPlus,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface CommunityMember {
  id: string
  user_id: string
  profile: Profile | null
}

interface ContactsManagerProps {
  contacts: CommunityContact[]
  members: CommunityMember[]
  onSave: (contacts: CommunityContact[]) => Promise<void>
  isSaving: boolean
}

interface ContactFormData {
  id: string
  role_name: string
  member_id: string | null
  phone: string
  description: string
  is_external: boolean
  external_name: string
  external_phone: string
  external_email: string
}

const emptyContact: ContactFormData = {
  id: '',
  role_name: '',
  member_id: null,
  phone: '',
  description: '',
  is_external: false,
  external_name: '',
  external_phone: '',
  external_email: '',
}

export function ContactsManager({
  contacts: initialContacts,
  members,
  onSave,
  isSaving,
}: ContactsManagerProps) {
  const [contacts, setContacts] = useState<CommunityContact[]>(initialContacts)
  const [editingContact, setEditingContact] = useState<ContactFormData | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const generateId = () => `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const handleAddNew = (suggestedRole?: { name: string; description: string }) => {
    const newContact: ContactFormData = {
      ...emptyContact,
      id: generateId(),
      role_name: suggestedRole?.name || '',
      description: suggestedRole?.description || '',
    }
    setEditingContact(newContact)
    setIsAddingNew(true)
    setShowSuggestions(false)
  }

  const handleEdit = (contact: CommunityContact) => {
    setEditingContact({
      id: contact.id,
      role_name: contact.role_name,
      member_id: contact.member_id,
      phone: contact.phone || '',
      description: contact.description || '',
      is_external: contact.is_external,
      external_name: contact.external_name || '',
      external_phone: contact.external_phone || '',
      external_email: contact.external_email || '',
    })
    setIsAddingNew(false)
  }

  const handleCancel = () => {
    setEditingContact(null)
    setIsAddingNew(false)
  }

  const handleSaveContact = () => {
    if (!editingContact || !editingContact.role_name.trim()) return

    const selectedMember = members.find((m) => m.id === editingContact.member_id)

    const existingContact = contacts.find((c) => c.id === editingContact.id)
    const newContact: CommunityContact = {
      id: editingContact.id,
      role_name: editingContact.role_name.trim(),
      member_id: editingContact.is_external ? null : editingContact.member_id,
      ...(selectedMember?.profile?.full_name && { member_name: selectedMember.profile.full_name }),
      ...(selectedMember?.profile?.email && { member_email: selectedMember.profile.email }),
      ...(!editingContact.is_external && editingContact.phone && { phone: editingContact.phone }),
      ...(editingContact.description && { description: editingContact.description }),
      is_external: editingContact.is_external,
      ...(editingContact.is_external && editingContact.external_name && { external_name: editingContact.external_name }),
      ...(editingContact.is_external && editingContact.external_phone && { external_phone: editingContact.external_phone }),
      ...(editingContact.is_external && editingContact.external_email && { external_email: editingContact.external_email }),
      display_order: isAddingNew ? contacts.length : contacts.findIndex((c) => c.id === editingContact.id),
      created_at: isAddingNew ? new Date().toISOString() : existingContact?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (isAddingNew) {
      setContacts([...contacts, newContact])
    } else {
      setContacts(contacts.map((c) => (c.id === newContact.id ? newContact : c)))
    }

    setEditingContact(null)
    setIsAddingNew(false)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to remove this contact?')) return
    setContacts(contacts.filter((c) => c.id !== id))
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const newContacts = [...contacts]
    ;[newContacts[index - 1], newContacts[index]] = [newContacts[index]!, newContacts[index - 1]!]
    newContacts.forEach((c, i) => (c.display_order = i))
    setContacts(newContacts)
  }

  const handleMoveDown = (index: number) => {
    if (index === contacts.length - 1) return
    const newContacts = [...contacts]
    ;[newContacts[index], newContacts[index + 1]] = [newContacts[index + 1]!, newContacts[index]!]
    newContacts.forEach((c, i) => (c.display_order = i))
    setContacts(newContacts)
  }

  const handleSaveAll = async () => {
    await onSave(contacts)
  }

  const hasChanges = JSON.stringify(contacts) !== JSON.stringify(initialContacts)

  // Roles that haven't been assigned yet
  const availableSuggestions = SUGGESTED_ROLES.filter(
    (role) => !contacts.some((c) => c.role_name.toLowerCase() === role.name.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Contact List */}
      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-muted/50">
          <User className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No contacts defined</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Add key roles and contacts for your community members to see.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact, index) => (
            <div
              key={contact.id}
              className="border rounded-lg bg-card overflow-hidden"
            >
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedId(expandedId === contact.id ? null : contact.id)}
              >
                <div className="flex flex-col gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMoveUp(index)
                    }}
                    disabled={index === 0}
                    className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMoveDown(index)
                    }}
                    disabled={index === contacts.length - 1}
                    className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{contact.role_name}</span>
                    {contact.is_external && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                        External
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {contact.is_external
                      ? contact.external_name || 'No name'
                      : contact.member_name || 'Unassigned'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEdit(contact)
                    }}
                    className="p-2 hover:bg-muted rounded"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(contact.id)
                    }}
                    className="p-2 hover:bg-muted text-destructive rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === contact.id && (
                <div className="px-3 pb-3 pt-0 border-t bg-muted/30">
                  <div className="grid gap-2 text-sm mt-3">
                    {contact.description && (
                      <p className="text-muted-foreground">{contact.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4">
                      {contact.is_external ? (
                        <>
                          {contact.external_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {contact.external_phone}
                            </span>
                          )}
                          {contact.external_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {contact.external_email}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {contact.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {contact.phone}
                            </span>
                          )}
                          {contact.member_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {contact.member_email}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit/Add Form */}
      {editingContact && (
        <div className="border rounded-lg p-4 bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              {isAddingNew ? 'Add New Contact' : 'Edit Contact'}
            </h3>
            <button onClick={handleCancel} className="p-1 hover:bg-muted rounded">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium mb-1 block">Role Name *</label>
              <Input
                value={editingContact.role_name}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, role_name: e.target.value })
                }
                placeholder="e.g., Community Leader, First Aid Officer"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Input
                value={editingContact.description}
                onChange={(e) =>
                  setEditingContact({ ...editingContact, description: e.target.value })
                }
                placeholder="Brief description of responsibilities"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingContact.is_external}
                  onChange={(e) =>
                    setEditingContact({
                      ...editingContact,
                      is_external: e.target.checked,
                      member_id: e.target.checked ? null : editingContact.member_id,
                    })
                  }
                  className="rounded border-border"
                />
                <span className="text-sm font-medium">External contact (not a community member)</span>
              </label>
            </div>

            {editingContact.is_external ? (
              <>
                <div>
                  <label className="text-sm font-medium mb-1 block">Name</label>
                  <Input
                    value={editingContact.external_name}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, external_name: e.target.value })
                    }
                    placeholder="Contact name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Phone</label>
                  <Input
                    value={editingContact.external_phone}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, external_phone: e.target.value })
                    }
                    placeholder="+64 21 123 4567"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium mb-1 block">Email</label>
                  <Input
                    value={editingContact.external_email}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, external_email: e.target.value })
                    }
                    placeholder="email@example.com"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium mb-1 block">Assign Member</label>
                  <select
                    value={editingContact.member_id || ''}
                    onChange={(e) =>
                      setEditingContact({
                        ...editingContact,
                        member_id: e.target.value || null,
                      })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select a member...</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.profile?.full_name || member.profile?.email || 'Unknown'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Phone (override)</label>
                  <Input
                    value={editingContact.phone}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, phone: e.target.value })
                    }
                    placeholder="Leave blank to use member's phone"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleCancel} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSaveContact}
              disabled={!editingContact.role_name.trim()}
              className="flex-1"
            >
              {isAddingNew ? 'Add Contact' : 'Update Contact'}
            </Button>
          </div>
        </div>
      )}

      {/* Add Button */}
      {!editingContact && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleAddNew()}
              className="flex-1"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Custom Contact
            </Button>
            {availableSuggestions.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowSuggestions(!showSuggestions)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Suggested Roles
                {showSuggestions ? (
                  <ChevronUp className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                )}
              </Button>
            )}
          </div>

          {showSuggestions && availableSuggestions.length > 0 && (
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-sm text-muted-foreground">Quick add suggested roles:</p>
              <div className="flex flex-wrap gap-2">
                {availableSuggestions.map((role) => (
                  <Button
                    key={role.name}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddNew(role)}
                    className="h-auto py-1.5"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {role.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save Button */}
      {hasChanges && !editingContact && (
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSaveAll} disabled={isSaving}>
            {isSaving ? (
              <>
                <span className="material-icons animate-spin text-lg mr-2">sync</span>
                Saving...
              </>
            ) : (
              'Save All Changes'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
