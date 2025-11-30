'use client'

import { GuideTemplate } from '@/data/guide-templates'

interface GuideCardProps {
  guide: GuideTemplate
  isSelected?: boolean
  onSelect?: (guide: GuideTemplate) => void
  onView?: (guide: GuideTemplate) => void
}

export function GuideCard({ guide, isSelected, onSelect, onView }: GuideCardProps) {
  return (
    <div
      className={`rounded-xl border-2 bg-card p-5 shadow-sm transition-all ${
        isSelected
          ? 'border-primary ring-2 ring-primary/20'
          : 'border-border hover:border-primary/50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${guide.color}`}
        >
          <span className="material-icons text-2xl text-white">{guide.icon}</span>
        </div>
        {onSelect && (
          <button
            onClick={() => onSelect(guide)}
            className={`rounded-lg p-2 transition-colors ${
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
            }`}
            title={isSelected ? 'Selected' : 'Select this guide'}
          >
            <span className="material-icons text-xl">
              {isSelected ? 'check_circle' : 'add_circle_outline'}
            </span>
          </button>
        )}
      </div>

      <h3 className="mt-4 font-semibold text-foreground">{guide.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
        {guide.description}
      </p>

      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="material-icons text-sm">article</span>
          <span>
            {guide.sections.before.length +
              guide.sections.during.length +
              guide.sections.after.length}{' '}
            sections
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="material-icons text-sm">inventory_2</span>
          <span>{guide.supplies.length} supplies</span>
        </div>
      </div>

      {onView && (
        <button
          onClick={() => onView(guide)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <span className="material-icons text-lg">visibility</span>
          Preview Guide
        </button>
      )}
    </div>
  )
}
