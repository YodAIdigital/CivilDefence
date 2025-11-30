'use client'

import { useState } from 'react'
import { GuideTemplate, GuideSection } from '@/data/guide-templates'

interface GuideViewerProps {
  guide: GuideTemplate
  onClose?: () => void
  isEditing?: boolean
}

type TabType = 'before' | 'during' | 'after' | 'supplies' | 'contacts'

export function GuideViewer({ guide, onClose, isEditing = false }: GuideViewerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('before')

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'before', label: 'Before', icon: 'event' },
    { id: 'during', label: 'During', icon: 'warning' },
    { id: 'after', label: 'After', icon: 'healing' },
    { id: 'supplies', label: 'Supplies', icon: 'inventory_2' },
    { id: 'contacts', label: 'Contacts', icon: 'contacts' },
  ]

  const renderSection = (section: GuideSection) => (
    <div
      key={section.id}
      className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30"
    >
      <div className="flex items-start gap-3">
        {section.icon && (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <span className="material-icons text-xl text-primary">{section.icon}</span>
          </div>
        )}
        <div className="flex-1">
          <h4 className="font-semibold text-foreground">{section.title}</h4>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {section.content}
          </p>
          {isEditing && (
            <button className="mt-2 text-xs text-primary hover:underline">
              Edit section
            </button>
          )}
        </div>
      </div>
    </div>
  )

  const renderSections = () => {
    if (activeTab === 'supplies') {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-3 font-semibold text-foreground flex items-center gap-2">
              <span className="material-icons text-primary">checklist</span>
              Emergency Supply Checklist
            </h4>
            <ul className="space-y-2">
              {guide.supplies.map((supply, index) => (
                <li key={index} className="flex items-start gap-3 text-sm">
                  <span className="material-icons text-lg text-muted-foreground">
                    check_box_outline_blank
                  </span>
                  <span className="text-foreground">{supply}</span>
                </li>
              ))}
            </ul>
            {isEditing && (
              <button className="mt-4 flex items-center gap-2 text-sm text-primary hover:underline">
                <span className="material-icons text-lg">add</span>
                Add supply item
              </button>
            )}
          </div>
        </div>
      )
    }

    if (activeTab === 'contacts') {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-3 font-semibold text-foreground flex items-center gap-2">
              <span className="material-icons text-primary">emergency</span>
              Emergency Contacts
            </h4>
            <div className="space-y-3">
              {guide.emergencyContacts.map((contact, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg bg-background p-3"
                >
                  <div>
                    <p className="font-medium text-foreground">{contact.name}</p>
                    <p className="text-sm text-muted-foreground">{contact.description}</p>
                  </div>
                  <a
                    href={`tel:${contact.number}`}
                    className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <span className="material-icons text-lg">call</span>
                    {contact.number}
                  </a>
                </div>
              ))}
            </div>
            {isEditing && (
              <button className="mt-4 flex items-center gap-2 text-sm text-primary hover:underline">
                <span className="material-icons text-lg">add</span>
                Add local contact
              </button>
            )}
          </div>
        </div>
      )
    }

    const sections = guide.sections[activeTab as keyof typeof guide.sections] || []
    return <div className="space-y-4">{sections.map(renderSection)}</div>
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${guide.color}`}
            >
              <span className="material-icons text-3xl text-white">{guide.icon}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{guide.name}</h2>
              <p className="text-sm text-muted-foreground">{guide.description}</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <span className="material-icons">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="my-4 flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            <span className="material-icons text-lg">{tab.icon}</span>
            {tab.label}
            {(tab.id === 'before' || tab.id === 'during' || tab.id === 'after') && (
              <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">
                {guide.sections[tab.id as keyof typeof guide.sections]?.length || 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">{renderSections()}</div>
    </div>
  )
}
