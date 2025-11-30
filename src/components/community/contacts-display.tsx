'use client'

import type { CommunityContact } from '@/types/database'
import { Phone, Mail, User, ExternalLink } from 'lucide-react'

interface ContactsDisplayProps {
  contacts: CommunityContact[]
  communityName?: string
}

export function ContactsDisplay({ contacts, communityName }: ContactsDisplayProps) {
  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <User className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">No contacts yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {communityName
            ? `${communityName} hasn't set up key contacts yet.`
            : "This community hasn't set up key contacts yet."}
        </p>
      </div>
    )
  }

  // Sort by display_order
  const sortedContacts = [...contacts].sort((a, b) => a.display_order - b.display_order)

  return (
    <div className="space-y-3">
      {sortedContacts.map((contact) => (
        <div
          key={contact.id}
          className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
            <span className="material-icons text-primary">
              {contact.is_external ? 'business' : 'person'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{contact.role_name}</h3>
              {contact.is_external && (
                <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded dark:bg-amber-900/30 dark:text-amber-200">
                  <ExternalLink className="h-3 w-3" />
                  External
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-foreground mt-0.5">
              {contact.is_external
                ? contact.external_name || 'Contact'
                : contact.member_name || 'Unassigned'}
            </p>
            {contact.description && (
              <p className="text-sm text-muted-foreground mt-1">{contact.description}</p>
            )}
            <div className="flex flex-wrap gap-4 mt-2">
              {contact.is_external ? (
                <>
                  {contact.external_phone && (
                    <a
                      href={`tel:${contact.external_phone}`}
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {contact.external_phone}
                    </a>
                  )}
                  {contact.external_email && (
                    <a
                      href={`mailto:${contact.external_email}`}
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {contact.external_email}
                    </a>
                  )}
                </>
              ) : (
                <>
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {contact.phone}
                    </a>
                  )}
                  {contact.member_email && (
                    <a
                      href={`mailto:${contact.member_email}`}
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {contact.member_email}
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
