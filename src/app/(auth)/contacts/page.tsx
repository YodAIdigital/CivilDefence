'use client'

import { useState } from 'react'

interface EmergencyContact {
  id: string
  name: string
  number: string
  description: string
  icon: string
  category: 'emergency' | 'utilities' | 'health' | 'local' | 'personal'
  isEditable?: boolean
}

const defaultContacts: EmergencyContact[] = [
  // Emergency Services
  {
    id: 'emergency-111',
    name: 'Emergency Services',
    number: '111',
    description: 'Police, Fire, Ambulance - Life threatening emergencies',
    icon: 'emergency',
    category: 'emergency',
  },
  {
    id: 'police-non-urgent',
    name: 'Police (Non-urgent)',
    number: '105',
    description: 'Report non-urgent crimes and incidents',
    icon: 'local_police',
    category: 'emergency',
  },
  {
    id: 'civil-defence',
    name: 'Civil Defence Emergency',
    number: '0800 22 22 00',
    description: 'National Emergency Management Agency',
    icon: 'shield',
    category: 'emergency',
  },

  // Health Services
  {
    id: 'healthline',
    name: 'Healthline',
    number: '0800 611 116',
    description: '24/7 free health advice from registered nurses',
    icon: 'health_and_safety',
    category: 'health',
  },
  {
    id: 'poison',
    name: 'Poison Control',
    number: '0800 764 766',
    description: 'National Poisons Centre - 24/7 advice',
    icon: 'science',
    category: 'health',
  },
  {
    id: 'mental-health',
    name: 'Mental Health Crisis',
    number: '1737',
    description: 'Free call or text - 24/7 mental health support',
    icon: 'psychology',
    category: 'health',
  },
  {
    id: 'lifeline',
    name: 'Lifeline',
    number: '0800 543 354',
    description: '24/7 counselling and support',
    icon: 'support',
    category: 'health',
  },

  // Utilities
  {
    id: 'power-outage',
    name: 'Power Outages',
    number: 'Check your provider',
    description: 'Contact your local electricity provider',
    icon: 'bolt',
    category: 'utilities',
  },
  {
    id: 'gas-emergency',
    name: 'Gas Emergency',
    number: '0800 111 323',
    description: '24/7 gas emergency line',
    icon: 'local_fire_department',
    category: 'utilities',
  },
  {
    id: 'water',
    name: 'Water Supply',
    number: 'Check your council',
    description: 'Contact your local council for water issues',
    icon: 'water_drop',
    category: 'utilities',
  },

  // Information
  {
    id: 'metservice',
    name: 'MetService Weather',
    number: '0900 999 99',
    description: 'Weather forecasts and warnings',
    icon: 'cloud',
    category: 'local',
  },
  {
    id: 'road-conditions',
    name: 'Road Conditions',
    number: '0800 44 44 49',
    description: 'NZTA road information and updates',
    icon: 'directions_car',
    category: 'local',
  },
]

const categoryLabels: Record<string, { label: string; icon: string }> = {
  emergency: { label: 'Emergency Services', icon: 'emergency' },
  health: { label: 'Health Services', icon: 'medical_services' },
  utilities: { label: 'Utilities', icon: 'build' },
  local: { label: 'Information Lines', icon: 'info' },
  personal: { label: 'Personal Contacts', icon: 'person' },
}

export default function ContactsPage() {
  const [contacts] = useState<EmergencyContact[]>(defaultContacts)
  const [personalContacts, setPersonalContacts] = useState<EmergencyContact[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newContact, setNewContact] = useState({ name: '', number: '', description: '' })

  const handleAddContact = () => {
    if (!newContact.name || !newContact.number) return

    const contact: EmergencyContact = {
      id: `personal-${Date.now()}`,
      name: newContact.name,
      number: newContact.number,
      description: newContact.description,
      icon: 'person',
      category: 'personal',
      isEditable: true,
    }

    setPersonalContacts(prev => [...prev, contact])
    setNewContact({ name: '', number: '', description: '' })
    setShowAddForm(false)
  }

  const handleDeleteContact = (id: string) => {
    setPersonalContacts(prev => prev.filter(c => c.id !== id))
  }

  const allContacts = [...contacts, ...personalContacts]
  const groupedContacts = allContacts.reduce<Record<string, EmergencyContact[]>>((acc, contact) => {
    if (!acc[contact.category]) {
      acc[contact.category] = []
    }
    acc[contact.category]!.push(contact)
    return acc
  }, {})

  const categoryOrder = ['emergency', 'health', 'utilities', 'local', 'personal']

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Emergency Contacts</h1>
          <p className="mt-1 text-muted-foreground">
            Important phone numbers for emergencies and essential services.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <span className="material-icons text-lg">add</span>
          Add Contact
        </button>
      </div>

      {/* Emergency Banner */}
      <div className="rounded-xl border-2 border-red-500/30 bg-red-50 p-4 dark:bg-red-900/10">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500">
            <span className="material-icons text-2xl text-white">emergency</span>
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-red-700 dark:text-red-400">
              For life-threatening emergencies, always call 111
            </h2>
            <p className="text-sm text-red-600 dark:text-red-300">
              Police, Fire, Ambulance - Available 24/7
            </p>
          </div>
          <a
            href="tel:111"
            className="flex items-center gap-2 rounded-lg bg-red-500 px-6 py-3 font-bold text-white hover:bg-red-600"
          >
            <span className="material-icons">call</span>
            111
          </a>
        </div>
      </div>

      {/* Add Contact Form */}
      {showAddForm && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <span className="material-icons text-primary">person_add</span>
            Add Personal Contact
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground">Name</label>
              <input
                type="text"
                value={newContact.name}
                onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Family Doctor"
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Phone Number</label>
              <input
                type="tel"
                value={newContact.number}
                onChange={(e) => setNewContact(prev => ({ ...prev, number: e.target.value }))}
                placeholder="e.g., 09 123 4567"
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground">Description (optional)</label>
              <input
                type="text"
                value={newContact.description}
                onChange={(e) => setNewContact(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g., Dr Smith at Medical Centre"
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleAddContact}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <span className="material-icons text-lg">save</span>
              Save Contact
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Contact Categories */}
      <div className="space-y-6">
        {categoryOrder.map(category => {
          const categoryContacts = groupedContacts[category]
          if (!categoryContacts || categoryContacts.length === 0) return null

          const categoryInfo = categoryLabels[category]
          if (!categoryInfo) return null

          return (
            <div key={category}>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <span className="material-icons text-xl text-primary">{categoryInfo.icon}</span>
                {categoryInfo.label}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categoryContacts.map(contact => (
                  <div
                    key={contact.id}
                    className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <span className="material-icons text-xl text-primary">{contact.icon}</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{contact.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {contact.description}
                          </p>
                        </div>
                      </div>
                      {contact.isEditable && (
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                        >
                          <span className="material-icons text-lg">delete</span>
                        </button>
                      )}
                    </div>
                    <a
                      href={`tel:${contact.number.replace(/\s/g, '')}`}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <span className="material-icons text-lg">call</span>
                      {contact.number}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Tips Section */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <span className="material-icons text-xl text-[#FEB100]">lightbulb</span>
          Emergency Contact Tips
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="material-icons text-sm text-primary">arrow_right</span>
            Save these numbers in your phone and keep a printed copy in your emergency kit.
          </li>
          <li className="flex items-start gap-2">
            <span className="material-icons text-sm text-primary">arrow_right</span>
            Set up &quot;ICE&quot; (In Case of Emergency) contacts in your phone.
          </li>
          <li className="flex items-start gap-2">
            <span className="material-icons text-sm text-primary">arrow_right</span>
            Teach children how to call 111 and give their address.
          </li>
          <li className="flex items-start gap-2">
            <span className="material-icons text-sm text-primary">arrow_right</span>
            Add your local council, doctor, and neighbours to your personal contacts.
          </li>
        </ul>
      </div>
    </div>
  )
}
