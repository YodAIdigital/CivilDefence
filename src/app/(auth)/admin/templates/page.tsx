'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useRole } from '@/contexts/auth-context'
import { guideTemplates, GuideTemplate, GuideSection } from '@/data/guide-templates'

export default function AdminTemplatesPage() {
  const router = useRouter()
  const { isLoading } = useAuth()
  const { isSuperAdmin } = useRole()
  const [templates, setTemplates] = useState<GuideTemplate[]>(guideTemplates)
  const [editingTemplate, setEditingTemplate] = useState<GuideTemplate | null>(null)
  const [editingSection, setEditingSection] = useState<{
    phase: 'before' | 'during' | 'after'
    section: GuideSection
  } | null>(null)

  // Redirect if not super admin
  useEffect(() => {
    if (!isLoading && !isSuperAdmin) {
      router.push('/dashboard')
    }
  }, [isLoading, isSuperAdmin, router])

  const handleEditSection = (
    template: GuideTemplate,
    phase: 'before' | 'during' | 'after',
    section: GuideSection
  ) => {
    setEditingTemplate(template)
    setEditingSection({ phase, section })
  }

  const handleSaveSection = (updatedSection: GuideSection) => {
    if (!editingTemplate || !editingSection) return

    setTemplates(prev =>
      prev.map(t => {
        if (t.id !== editingTemplate.id) return t
        return {
          ...t,
          sections: {
            ...t.sections,
            [editingSection.phase]: t.sections[editingSection.phase].map(s =>
              s.id === updatedSection.id ? updatedSection : s
            ),
          },
        }
      })
    )
    setEditingSection(null)
    setEditingTemplate(null)
  }

  const handleAddSection = (templateId: string, phase: 'before' | 'during' | 'after') => {
    const newSection: GuideSection = {
      id: `${templateId}-${phase}-${Date.now()}`,
      title: 'New Section',
      content: 'Enter content here...',
      icon: 'article',
    }

    setTemplates(prev =>
      prev.map(t => {
        if (t.id !== templateId) return t
        return {
          ...t,
          sections: {
            ...t.sections,
            [phase]: [...t.sections[phase], newSection],
          },
        }
      })
    )
  }

  const handleDeleteSection = (templateId: string, phase: 'before' | 'during' | 'after', sectionId: string) => {
    setTemplates(prev =>
      prev.map(t => {
        if (t.id !== templateId) return t
        return {
          ...t,
          sections: {
            ...t.sections,
            [phase]: t.sections[phase].filter(s => s.id !== sectionId),
          },
        }
      })
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="material-icons animate-spin text-4xl text-primary">sync</span>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center">
        <span className="material-icons text-6xl text-destructive">block</span>
        <h1 className="mt-4 text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">
          You do not have permission to access this page.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-icons text-2xl text-[#FEB100]">admin_panel_settings</span>
            <h1 className="text-2xl font-bold text-foreground">Template Management</h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            Super Admin: Manage and edit emergency response plan templates for all communities.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-[#FEB100]/20 px-3 py-1 text-sm font-medium text-[#FEB100]">
          <span className="material-icons text-lg">verified_user</span>
          Super Admin
        </div>
      </div>

      {/* Warning Banner */}
      <div className="rounded-xl border-2 border-amber-500/30 bg-amber-50 p-4 dark:bg-amber-900/10">
        <div className="flex items-start gap-3">
          <span className="material-icons text-2xl text-amber-600">warning</span>
          <div>
            <h3 className="font-semibold text-amber-800 dark:text-amber-400">
              Template Changes Affect All Communities
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Changes made here will update the base templates. Communities that have customized their response plans will keep their customizations.
            </p>
          </div>
        </div>
      </div>

      {/* Template List */}
      <div className="space-y-6">
        {templates.map(template => (
          <div key={template.id} className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Template Header */}
            <div className={`p-4 bg-gradient-to-r ${template.color}`}>
              <div className="flex items-center gap-3">
                <span className="material-icons text-3xl text-white">{template.icon}</span>
                <div>
                  <h2 className="text-xl font-bold text-white">{template.name}</h2>
                  <p className="text-sm text-white/80">{template.description}</p>
                </div>
              </div>
            </div>

            {/* Template Content */}
            <div className="p-4 space-y-6">
              {/* Sections by Phase */}
              {(['before', 'during', 'after'] as const).map(phase => (
                <div key={phase} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold capitalize flex items-center gap-2">
                      <span className="material-icons text-primary">
                        {phase === 'before' ? 'event' : phase === 'during' ? 'warning' : 'healing'}
                      </span>
                      {phase} Emergency
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({template.sections[phase].length} sections)
                      </span>
                    </h3>
                    <button
                      onClick={() => handleAddSection(template.id, phase)}
                      className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1 text-sm font-medium text-primary hover:bg-primary/20"
                    >
                      <span className="material-icons text-lg">add</span>
                      Add Section
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {template.sections[phase].map(section => (
                      <div
                        key={section.id}
                        className="rounded-lg border border-border bg-background p-3 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2">
                            {section.icon && (
                              <span className="material-icons text-lg text-primary mt-0.5">
                                {section.icon}
                              </span>
                            )}
                            <div>
                              <h4 className="font-medium">{section.title}</h4>
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {section.content}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEditSection(template, phase, section)}
                              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary"
                              title="Edit section"
                            >
                              <span className="material-icons text-lg">edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteSection(template.id, phase, section.id)}
                              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                              title="Delete section"
                            >
                              <span className="material-icons text-lg">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Supplies */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="material-icons text-primary">inventory_2</span>
                  Supplies List
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({template.supplies.length} items)
                  </span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {template.supplies.map((supply, idx) => (
                    <span
                      key={idx}
                      className="rounded-full bg-muted px-3 py-1 text-sm"
                    >
                      {supply}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Section Modal */}
      {editingSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Edit Section</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.target as HTMLFormElement
                const formData = new FormData(form)
                handleSaveSection({
                  ...editingSection.section,
                  title: formData.get('title') as string,
                  content: formData.get('content') as string,
                  icon: formData.get('icon') as string,
                })
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  name="title"
                  defaultValue={editingSection.section.title}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Icon (Material Icon name)</label>
                <input
                  name="icon"
                  defaultValue={editingSection.section.icon || ''}
                  placeholder="e.g., home, warning, shield"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Content</label>
                <textarea
                  name="content"
                  defaultValue={editingSection.section.content}
                  rows={5}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingSection(null)}
                  className="flex-1 rounded-lg border border-border py-2 font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-primary py-2 font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
