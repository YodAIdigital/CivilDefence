'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase/client'
import { AvatarUpload } from '@/components/profile/avatar-upload'
import {
  type ProfileExtended,
  type FieldVisibility,
  type Json,
  type EmergencyContact,
  type InsuranceDetails,
  type UtilityCompany,
  type UtilityType,
  SKILL_OPTIONS,
  DISABILITY_OPTIONS,
  EQUIPMENT_OPTIONS,
  RELATIONSHIP_OPTIONS,
  UTILITY_TYPE_CONFIG,
} from '@/types/database'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AddressAutocomplete, type AddressResult } from '@/components/maps/address-autocomplete'

type VisibilityKey =
  | 'personal_info'
  | 'emergency_contact'
  | 'insurance'
  | 'utilities'
  | 'skills'
  | 'disabilities'
  | 'equipment'
  | 'preparedness'
  | 'comments'

interface FormData {
  // Basic Info (from profiles table)
  full_name: string
  email: string
  phone: string

  // Extended Info (stored in notification_preferences JSON for now)
  date_of_birth: string
  address: string
  address_lat?: number | undefined
  address_lng?: number | undefined
  mobile_number: string
  secondary_number: string

  // Emergency Contacts (multiple)
  emergency_contacts: EmergencyContact[]

  // Insurance (with contact numbers)
  home_insurance: InsuranceDetails
  car_insurance: InsuranceDetails
  medical_insurance: InsuranceDetails

  // Utility Companies
  utility_companies: UtilityCompany[]

  // Skills
  skills: string[]

  // Disabilities
  disabilities: string[]

  // Equipment
  equipment: string[]

  // Preparedness
  has_backup_power: boolean
  has_backup_water: boolean
  has_food_supply: boolean

  // Comments
  general_comments: string

  // Visibility
  visibility: {
    personal_info: FieldVisibility
    emergency_contact: FieldVisibility
    insurance: FieldVisibility
    utilities: FieldVisibility
    skills: FieldVisibility
    disabilities: FieldVisibility
    equipment: FieldVisibility
    preparedness: FieldVisibility
    comments: FieldVisibility
  }
}

const defaultVisibility: FormData['visibility'] = {
  personal_info: 'private',
  emergency_contact: 'civil_defence_only',
  insurance: 'private',
  utilities: 'private',
  skills: 'community',
  disabilities: 'civil_defence_only',
  equipment: 'community',
  preparedness: 'community',
  comments: 'civil_defence_only',
}

const emptyInsurance: InsuranceDetails = {
  provider: '',
  policy_number: '',
  contact_phone: '',
}

const initialFormData: FormData = {
  full_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  address: '',
  mobile_number: '',
  secondary_number: '',
  emergency_contacts: [],
  home_insurance: { ...emptyInsurance },
  car_insurance: { ...emptyInsurance },
  medical_insurance: { ...emptyInsurance },
  utility_companies: [],
  skills: [],
  disabilities: [],
  equipment: [],
  has_backup_power: false,
  has_backup_water: false,
  has_food_supply: false,
  general_comments: '',
  visibility: defaultVisibility,
}

function VisibilitySelect({
  value,
  onChange,
  fieldName,
}: {
  value: FieldVisibility
  onChange: (value: FieldVisibility) => void
  fieldName: string
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">Visible to:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as FieldVisibility)}
        className="rounded border border-border bg-background px-2 py-1 text-xs"
        aria-label={`Visibility for ${fieldName}`}
      >
        <option value="private">Only me</option>
        <option value="community">My community</option>
        <option value="civil_defence_only">Civil Defence team only</option>
      </select>
    </div>
  )
}

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )
  const [activeSection, setActiveSection] = useState<string>('personal')

  // Load existing profile data
  useEffect(() => {
    if (profile) {
      // Parse extended data from notification_preferences (we're using it as a JSON store)
      const extendedData = (profile.notification_preferences as ProfileExtended) || {}

      // Migrate legacy emergency contact to new format if needed
      let emergencyContacts: EmergencyContact[] = extendedData.emergency_contacts || []
      if (emergencyContacts.length === 0) {
        const legacyName = extendedData.emergency_contact_name || profile.emergency_contact_name
        const legacyPhone = extendedData.emergency_contact_number || profile.emergency_contact_phone
        if (legacyName && legacyPhone) {
          emergencyContacts = [{
            id: `legacy_${Date.now()}`,
            name: legacyName,
            phone: legacyPhone,
            relationship: 'other',
          }]
        }
      }

      // Migrate legacy insurance to new format if needed
      const homeInsurance: InsuranceDetails = extendedData.home_insurance || {
        provider: extendedData.home_insurance_provider || '',
        policy_number: extendedData.home_insurance_policy || '',
        contact_phone: '',
      }
      const carInsurance: InsuranceDetails = extendedData.car_insurance || {
        provider: extendedData.car_insurance_provider || '',
        policy_number: extendedData.car_insurance_policy || '',
        contact_phone: '',
      }
      const medicalInsurance: InsuranceDetails = extendedData.medical_insurance || {
        provider: extendedData.medical_insurance_provider || '',
        policy_number: extendedData.medical_insurance_policy || '',
        contact_phone: '',
      }

      setFormData({
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        date_of_birth: extendedData.date_of_birth || '',
        address: extendedData.address || '',
        ...(extendedData.address_lat != null && { address_lat: extendedData.address_lat }),
        ...(extendedData.address_lng != null && { address_lng: extendedData.address_lng }),
        mobile_number: extendedData.mobile_number || profile.phone || '',
        secondary_number: extendedData.secondary_number || '',
        emergency_contacts: emergencyContacts,
        home_insurance: homeInsurance,
        car_insurance: carInsurance,
        medical_insurance: medicalInsurance,
        utility_companies: extendedData.utility_companies || [],
        skills: extendedData.skills || [],
        disabilities: extendedData.disabilities || [],
        equipment: extendedData.equipment || [],
        has_backup_power: extendedData.has_backup_power || false,
        has_backup_water: extendedData.has_backup_water || false,
        has_food_supply: extendedData.has_food_supply || false,
        general_comments: extendedData.general_comments || '',
        visibility: { ...defaultVisibility, ...extendedData.visibility },
      })
    }
  }, [profile])

  const handleInputChange = (field: keyof FormData, value: string | boolean | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleVisibilityChange = (field: VisibilityKey, value: FieldVisibility) => {
    setFormData((prev) => ({
      ...prev,
      visibility: { ...prev.visibility, [field]: value },
    }))
  }

  const handleSkillToggle = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }))
  }

  const handleDisabilityToggle = (disability: string) => {
    setFormData((prev) => ({
      ...prev,
      disabilities: prev.disabilities.includes(disability)
        ? prev.disabilities.filter((d) => d !== disability)
        : [...prev.disabilities, disability],
    }))
  }

  const handleEquipmentToggle = (equipmentItem: string) => {
    setFormData((prev) => ({
      ...prev,
      equipment: prev.equipment.includes(equipmentItem)
        ? prev.equipment.filter((e) => e !== equipmentItem)
        : [...prev.equipment, equipmentItem],
    }))
  }

  const handleAddressSelect = (result: AddressResult) => {
    setFormData((prev) => ({
      ...prev,
      address: result.formattedAddress,
      address_lat: result.lat,
      address_lng: result.lng,
    }))
  }

  // Emergency contact handlers
  const addEmergencyContact = () => {
    const newContact: EmergencyContact = {
      id: `contact_${Date.now()}`,
      name: '',
      phone: '',
      relationship: 'other',
    }
    setFormData((prev) => ({
      ...prev,
      emergency_contacts: [...prev.emergency_contacts, newContact],
    }))
  }

  const updateEmergencyContact = (id: string, field: keyof EmergencyContact, value: string) => {
    setFormData((prev) => ({
      ...prev,
      emergency_contacts: prev.emergency_contacts.map((contact) =>
        contact.id === id ? { ...contact, [field]: value } : contact
      ),
    }))
  }

  const removeEmergencyContact = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      emergency_contacts: prev.emergency_contacts.filter((contact) => contact.id !== id),
    }))
  }

  // Insurance handlers
  const updateInsurance = (
    type: 'home_insurance' | 'car_insurance' | 'medical_insurance',
    field: keyof InsuranceDetails,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }))
  }

  // Utility company handlers
  const addUtilityCompany = (type: UtilityType) => {
    const newUtility: UtilityCompany = {
      type,
      provider: '',
      account_number: '',
      phone: '',
      email: '',
      website: '',
    }
    setFormData((prev) => ({
      ...prev,
      utility_companies: [...prev.utility_companies, newUtility],
    }))
  }

  const updateUtilityCompany = (
    index: number,
    field: keyof UtilityCompany,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      utility_companies: prev.utility_companies.map((utility, i) =>
        i === index ? { ...utility, [field]: value } : utility
      ),
    }))
  }

  const removeUtilityCompany = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      utility_companies: prev.utility_companies.filter((_, i) => i !== index),
    }))
  }

  const getUtilityByType = (type: UtilityType) => {
    return formData.utility_companies.find((u) => u.type === type)
  }

  const getUtilityIndex = (type: UtilityType) => {
    return formData.utility_companies.findIndex((u) => u.type === type)
  }

  const handleSave = async () => {
    if (!user?.id) return

    // Validate required fields
    if (!formData.address || !formData.address_lat || !formData.address_lng) {
      setSaveMessage({
        type: 'error',
        text: 'Please select a valid address from the dropdown. Your address is required for emergency services.'
      })
      setActiveSection('personal')
      return
    }

    setIsSaving(true)
    setSaveMessage(null)

    try {
      // Prepare extended data to store in notification_preferences
      const extendedData: ProfileExtended = {
        date_of_birth: formData.date_of_birth,
        address: formData.address,
        mobile_number: formData.mobile_number,
        secondary_number: formData.secondary_number,
        // New format: multiple emergency contacts
        emergency_contacts: formData.emergency_contacts,
        // New format: insurance with contact numbers
        home_insurance: formData.home_insurance,
        car_insurance: formData.car_insurance,
        medical_insurance: formData.medical_insurance,
        // Utility companies
        utility_companies: formData.utility_companies,
        skills: formData.skills,
        disabilities: formData.disabilities,
        equipment: formData.equipment,
        has_backup_power: formData.has_backup_power,
        has_backup_water: formData.has_backup_water,
        has_food_supply: formData.has_food_supply,
        general_comments: formData.general_comments,
        visibility: formData.visibility,
      }
      if (formData.address_lat != null) {
        extendedData.address_lat = formData.address_lat
      }
      if (formData.address_lng != null) {
        extendedData.address_lng = formData.address_lng
      }

      // Get primary emergency contact for legacy fields
      const primaryContact = formData.emergency_contacts[0]

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.mobile_number,
          emergency_contact_name: primaryContact?.name || null,
          emergency_contact_phone: primaryContact?.phone || null,
          notification_preferences: extendedData as Json,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      setSaveMessage({ type: 'success', text: 'Profile saved successfully!' })
      await refreshProfile()
    } catch (error) {
      console.error('Error saving profile:', error)
      setSaveMessage({ type: 'error', text: 'Failed to save profile. Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  const sections = [
    { id: 'personal', label: 'Personal Information', icon: 'person' },
    { id: 'emergency', label: 'Emergency Contact', icon: 'contact_phone' },
    { id: 'insurance', label: 'Insurance Details', icon: 'policy' },
    { id: 'utilities', label: 'Utility Companies', icon: 'bolt' },
    { id: 'skills', label: 'Skills & Qualifications', icon: 'medical_services' },
    { id: 'disabilities', label: 'Disabilities & Needs', icon: 'accessible' },
    { id: 'equipment', label: 'Equipment', icon: 'construction' },
    { id: 'preparedness', label: 'Preparedness', icon: 'home' },
    { id: 'comments', label: 'General Comments', icon: 'comment' },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="mt-1 text-muted-foreground">
          Keep your emergency information up to date. This information may be shared with your
          community or civil defence team based on your visibility settings.
        </p>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div
          className={`mb-6 rounded-lg p-4 ${
            saveMessage.type === 'success'
              ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200'
              : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-icons text-lg">
              {saveMessage.type === 'success' ? 'check_circle' : 'error'}
            </span>
            {saveMessage.text}
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Section Navigation */}
        <nav className="hidden w-56 flex-shrink-0 md:block">
          <div className="sticky top-24 space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeSection === section.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span className="material-icons-outlined text-xl">{section.icon}</span>
                {section.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Form Content */}
        <div className="flex-1 space-y-6">
          {/* Mobile Section Selector */}
          <div className="md:hidden">
            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value)}
              className="w-full rounded-lg border border-border bg-background p-3"
            >
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </div>

          {/* Personal Information */}
          {activeSection === 'personal' && (
            <div className="rounded-xl bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Personal Information</h2>
                <VisibilitySelect
                  value={formData.visibility.personal_info}
                  onChange={(v) => handleVisibilityChange('personal_info', v)}
                  fieldName="personal information"
                />
              </div>

              {/* Avatar Upload */}
              {user && (
                <div className="mb-6 pb-6 border-b border-border">
                  <AvatarUpload
                    userId={user.id}
                    currentAvatarUrl={profile?.avatar_url ?? null}
                    email={profile?.email || undefined}
                    fullName={formData.full_name || undefined}
                    onUploadComplete={() => refreshProfile()}
                  />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Full Name *</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">Address *</label>
                  <AddressAutocomplete
                    value={formData.address}
                    onChange={(value) => handleInputChange('address', value)}
                    onSelect={handleAddressSelect}
                    placeholder="Start typing your address..."
                    className=""
                  />
                  {formData.address_lat && formData.address_lng ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Location saved for emergency services
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      Please select an address from the dropdown to save your location
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Mobile Number *</label>
                  <input
                    type="tel"
                    value={formData.mobile_number}
                    onChange={(e) => handleInputChange('mobile_number', e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                    placeholder="+64 21 123 4567"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Secondary Number</label>
                  <input
                    type="tel"
                    value={formData.secondary_number}
                    onChange={(e) => handleInputChange('secondary_number', e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                    placeholder="Home or work number"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-muted-foreground"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Email cannot be changed here. Contact support if needed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Emergency Contacts */}
          {activeSection === 'emergency' && (
            <div className="rounded-xl bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Emergency Contacts</h2>
                <VisibilitySelect
                  value={formData.visibility.emergency_contact}
                  onChange={(v) => handleVisibilityChange('emergency_contact', v)}
                  fieldName="emergency contacts"
                />
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Add people who should be contacted in case of an emergency. You can add multiple contacts.
              </p>

              {/* Existing contacts list */}
              <div className="space-y-4">
                {formData.emergency_contacts.map((contact, index) => (
                  <div
                    key={contact.id}
                    className="rounded-lg border border-border p-4 bg-muted/30"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        Contact {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeEmergencyContact(contact.id)}
                        className="text-destructive hover:text-destructive/80 p-1"
                        title="Remove contact"
                      >
                        <span className="material-icons text-lg">delete</span>
                      </button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Name *</label>
                        <input
                          type="text"
                          value={contact.name}
                          onChange={(e) =>
                            updateEmergencyContact(contact.id, 'name', e.target.value)
                          }
                          className="w-full rounded-lg border border-border bg-background px-3 py-2"
                          placeholder="Contact name"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Phone *</label>
                        <input
                          type="tel"
                          value={contact.phone}
                          onChange={(e) =>
                            updateEmergencyContact(contact.id, 'phone', e.target.value)
                          }
                          className="w-full rounded-lg border border-border bg-background px-3 py-2"
                          placeholder="+64 21 123 4567"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Relationship</label>
                        <select
                          value={contact.relationship}
                          onChange={(e) =>
                            updateEmergencyContact(contact.id, 'relationship', e.target.value)
                          }
                          className="w-full rounded-lg border border-border bg-background px-3 py-2"
                        >
                          {RELATIONSHIP_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add contact button */}
              <button
                type="button"
                onClick={addEmergencyContact}
                className="mt-4 w-full rounded-lg border-2 border-dashed border-border p-4 text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-icons">add</span>
                Add Emergency Contact
              </button>

              {formData.emergency_contacts.length === 0 && (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <span className="material-icons text-sm">warning</span>
                  We recommend adding at least one emergency contact.
                </p>
              )}
            </div>
          )}

          {/* Insurance Details */}
          {activeSection === 'insurance' && (
            <div className="rounded-xl bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Insurance Details</h2>
                <VisibilitySelect
                  value={formData.visibility.insurance}
                  onChange={(v) => handleVisibilityChange('insurance', v)}
                  fieldName="insurance details"
                />
              </div>
              <div className="space-y-6">
                {/* Home Insurance */}
                <div className="rounded-lg border border-border p-4">
                  <h3 className="mb-3 font-medium flex items-center gap-2">
                    <span className="material-icons-outlined text-lg text-muted-foreground">home</span>
                    Home Insurance
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Provider</label>
                      <input
                        type="text"
                        value={formData.home_insurance.provider || ''}
                        onChange={(e) =>
                          updateInsurance('home_insurance', 'provider', e.target.value)
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2"
                        placeholder="Insurance company"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Policy Number</label>
                      <input
                        type="text"
                        value={formData.home_insurance.policy_number || ''}
                        onChange={(e) =>
                          updateInsurance('home_insurance', 'policy_number', e.target.value)
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2"
                        placeholder="Policy number"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Contact Phone</label>
                      <input
                        type="tel"
                        value={formData.home_insurance.contact_phone || ''}
                        onChange={(e) =>
                          updateInsurance('home_insurance', 'contact_phone', e.target.value)
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2"
                        placeholder="Claims number"
                      />
                    </div>
                  </div>
                </div>

                {/* Car Insurance */}
                <div className="rounded-lg border border-border p-4">
                  <h3 className="mb-3 font-medium flex items-center gap-2">
                    <span className="material-icons-outlined text-lg text-muted-foreground">directions_car</span>
                    Car Insurance
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Provider</label>
                      <input
                        type="text"
                        value={formData.car_insurance.provider || ''}
                        onChange={(e) =>
                          updateInsurance('car_insurance', 'provider', e.target.value)
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2"
                        placeholder="Insurance company"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Policy Number</label>
                      <input
                        type="text"
                        value={formData.car_insurance.policy_number || ''}
                        onChange={(e) =>
                          updateInsurance('car_insurance', 'policy_number', e.target.value)
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2"
                        placeholder="Policy number"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Contact Phone</label>
                      <input
                        type="tel"
                        value={formData.car_insurance.contact_phone || ''}
                        onChange={(e) =>
                          updateInsurance('car_insurance', 'contact_phone', e.target.value)
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2"
                        placeholder="Claims number"
                      />
                    </div>
                  </div>
                </div>

                {/* Medical Insurance */}
                <div className="rounded-lg border border-border p-4">
                  <h3 className="mb-3 font-medium flex items-center gap-2">
                    <span className="material-icons-outlined text-lg text-muted-foreground">medical_services</span>
                    Medical Insurance
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Provider</label>
                      <input
                        type="text"
                        value={formData.medical_insurance.provider || ''}
                        onChange={(e) =>
                          updateInsurance('medical_insurance', 'provider', e.target.value)
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2"
                        placeholder="Insurance company"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Policy Number</label>
                      <input
                        type="text"
                        value={formData.medical_insurance.policy_number || ''}
                        onChange={(e) =>
                          updateInsurance('medical_insurance', 'policy_number', e.target.value)
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2"
                        placeholder="Policy number"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Contact Phone</label>
                      <input
                        type="tel"
                        value={formData.medical_insurance.contact_phone || ''}
                        onChange={(e) =>
                          updateInsurance('medical_insurance', 'contact_phone', e.target.value)
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2"
                        placeholder="Claims number"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Utility Companies */}
          {activeSection === 'utilities' && (
            <div className="rounded-xl bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Utility Companies</h2>
                <VisibilitySelect
                  value={formData.visibility.utilities}
                  onChange={(v) => handleVisibilityChange('utilities', v)}
                  fieldName="utility companies"
                />
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Store your utility provider information for quick access during emergencies.
                Having contact details ready can help when reporting outages or emergencies.
              </p>

              <div className="space-y-4">
                {(Object.keys(UTILITY_TYPE_CONFIG) as UtilityType[]).map((utilityType) => {
                  const config = UTILITY_TYPE_CONFIG[utilityType]
                  const utility = getUtilityByType(utilityType)
                  const index = getUtilityIndex(utilityType)

                  return (
                    <div key={utilityType} className="rounded-lg border border-border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium flex items-center gap-2">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.bgColor}`}>
                            <span className={`material-icons text-lg ${config.color}`}>{config.icon}</span>
                          </div>
                          {config.label}
                        </h3>
                        {utility ? (
                          <button
                            type="button"
                            onClick={() => removeUtilityCompany(index)}
                            className="text-destructive hover:text-destructive/80 p-1 text-sm flex items-center gap-1"
                          >
                            <span className="material-icons text-lg">delete</span>
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addUtilityCompany(utilityType)}
                            className="text-primary hover:text-primary/80 text-sm flex items-center gap-1"
                          >
                            <span className="material-icons text-lg">add</span>
                            Add Provider
                          </button>
                        )}
                      </div>

                      {utility && (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-sm font-medium">Provider Name *</label>
                            <input
                              type="text"
                              value={utility.provider}
                              onChange={(e) => updateUtilityCompany(index, 'provider', e.target.value)}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2"
                              placeholder={`e.g., ${utilityType === 'electricity' ? 'Contact Energy' : utilityType === 'gas' ? 'Genesis Energy' : utilityType === 'water' ? 'Wellington Water' : 'Spark'}`}
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-sm font-medium">Account Number</label>
                            <input
                              type="text"
                              value={utility.account_number || ''}
                              onChange={(e) => updateUtilityCompany(index, 'account_number', e.target.value)}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2"
                              placeholder="Your account number"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-sm font-medium">
                              Phone Number
                              <span className="text-xs text-muted-foreground ml-1">(for outages/emergencies)</span>
                            </label>
                            <input
                              type="tel"
                              value={utility.phone || ''}
                              onChange={(e) => updateUtilityCompany(index, 'phone', e.target.value)}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2"
                              placeholder="0800 xxx xxx"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-sm font-medium">Email</label>
                            <input
                              type="email"
                              value={utility.email || ''}
                              onChange={(e) => updateUtilityCompany(index, 'email', e.target.value)}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2"
                              placeholder="support@provider.co.nz"
                            />
                          </div>
                        </div>
                      )}

                      {!utility && (
                        <p className="text-sm text-muted-foreground italic">
                          No {config.label.toLowerCase()} provider added yet.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2">
                  <span className="material-icons text-lg mt-0.5">info</span>
                  <span>
                    <strong>Tip:</strong> During emergencies, utilities may have dedicated outage hotlines
                    that differ from regular customer service numbers. Consider storing the emergency/outage
                    specific numbers here.
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Skills & Qualifications */}
          {activeSection === 'skills' && (
            <div className="rounded-xl bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Skills & Qualifications</h2>
                <VisibilitySelect
                  value={formData.visibility.skills}
                  onChange={(v) => handleVisibilityChange('skills', v)}
                  fieldName="skills"
                />
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Select any relevant skills or qualifications you have that could help during an
                emergency.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {SKILL_OPTIONS.map((skill) => (
                  <label
                    key={skill.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                      formData.skills.includes(skill.value)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.skills.includes(skill.value)}
                      onChange={() => handleSkillToggle(skill.value)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="font-medium">{skill.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Disabilities & Needs */}
          {activeSection === 'disabilities' && (
            <div className="rounded-xl bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Disabilities & Special Needs</h2>
                <VisibilitySelect
                  value={formData.visibility.disabilities}
                  onChange={(v) => handleVisibilityChange('disabilities', v)}
                  fieldName="disabilities"
                />
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                This information helps emergency responders understand your needs during an
                emergency. It will only be shared with civil defence personnel by default.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {DISABILITY_OPTIONS.map((disability) => (
                  <label
                    key={disability.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                      formData.disabilities.includes(disability.value)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.disabilities.includes(disability.value)}
                      onChange={() => handleDisabilityToggle(disability.value)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="font-medium">{disability.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Equipment */}
          {activeSection === 'equipment' && (
            <div className="rounded-xl bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Equipment</h2>
                <VisibilitySelect
                  value={formData.visibility.equipment}
                  onChange={(v) => handleVisibilityChange('equipment', v)}
                  fieldName="equipment"
                />
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Select any equipment you have access to that could be useful during an emergency
                response or community recovery efforts.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {EQUIPMENT_OPTIONS.map((item) => (
                  <label
                    key={item.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                      formData.equipment.includes(item.value)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.equipment.includes(item.value)}
                      onChange={() => handleEquipmentToggle(item.value)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="font-medium">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Emergency Preparedness */}
          {activeSection === 'preparedness' && (
            <div className="rounded-xl bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Emergency Preparedness</h2>
                <VisibilitySelect
                  value={formData.visibility.preparedness}
                  onChange={(v) => handleVisibilityChange('preparedness', v)}
                  fieldName="preparedness"
                />
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Let your community know about your emergency preparedness level.
              </p>
              <div className="space-y-3">
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                    formData.has_backup_power
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.has_backup_power}
                    onChange={(e) => handleInputChange('has_backup_power', e.target.checked)}
                    className="h-5 w-5 rounded border-border"
                  />
                  <div>
                    <span className="font-medium">Emergency backup power</span>
                    <p className="text-sm text-muted-foreground">
                      Generator, solar panels, or battery backup
                    </p>
                  </div>
                </label>

                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                    formData.has_backup_water
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.has_backup_water}
                    onChange={(e) => handleInputChange('has_backup_water', e.target.checked)}
                    className="h-5 w-5 rounded border-border"
                  />
                  <div>
                    <span className="font-medium">Backup water supply</span>
                    <p className="text-sm text-muted-foreground">
                      Water tanks, stored water, or rainwater collection
                    </p>
                  </div>
                </label>

                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                    formData.has_food_supply
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.has_food_supply}
                    onChange={(e) => handleInputChange('has_food_supply', e.target.checked)}
                    className="h-5 w-5 rounded border-border"
                  />
                  <div>
                    <span className="font-medium">Food supply for at least 5 days</span>
                    <p className="text-sm text-muted-foreground">
                      Non-perishable food items sufficient for household
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* General Comments */}
          {activeSection === 'comments' && (
            <div className="rounded-xl bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">General Comments</h2>
                <VisibilitySelect
                  value={formData.visibility.comments}
                  onChange={(v) => handleVisibilityChange('comments', v)}
                  fieldName="comments"
                />
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Any other information you&apos;d like to share that may be relevant during an
                emergency.
              </p>
              <textarea
                value={formData.general_comments}
                onChange={(e) => handleInputChange('general_comments', e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                rows={5}
                placeholder="E.g., pets at home, specific medical conditions, equipment you can share with neighbors, etc."
              />
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="material-icons animate-spin text-lg">sync</span>
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-icons text-lg">save</span>
                  Save Profile
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
