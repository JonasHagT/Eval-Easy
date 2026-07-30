'use client'

import { useState } from 'react'
import { EMAIL_TAGS } from '@/lib/types'
import { TAG_STYLES } from '@/lib/tags'

export interface ScoreValues {
  thumbs: 'up' | 'down' | null
  rating: 1 | 2 | 3 | 4 | 5 | null
  tags: string[]
  comment: string
}

interface Props {
  initial?: Partial<ScoreValues>
  onSubmit: (values: ScoreValues) => Promise<void> | void
  onSkip?: () => void
  submitLabel?: string
  showSkip?: boolean
  compact?: boolean
}

export default function ScoreForm({
  initial,
  onSubmit,
  onSkip,
  submitLabel = 'Save score',
  showSkip = true,
  compact = false,
}: Props) {
  const [thumbs, setThumbs] = useState<'up' | 'down' | null>(initial?.thumbs ?? null)
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | null>(initial?.rating ?? null)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>(initial?.tags ?? [])
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [saving, setSaving] = useState(false)

  const displayRating = hoverRating ?? rating ?? 0

  const toggleTag = (label: string) =>
    setSelectedTags(prev =>
      prev.includes(label) ? prev.filter(t => t !== label) : [...prev, label]
    )

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSubmit({ thumbs, rating, tags: selectedTags, comment })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      <div>
        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2">
          Quick verdict
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setThumbs(thumbs === 'up' ? null : 'up')}
            className={`flex-1 py-3 rounded-xl text-xl transition-all border ${
              thumbs === 'up'
                ? 'bg-green-900/50 border-green-500 ring-1 ring-green-500'
                : 'bg-gray-800/60 border-gray-700 hover:bg-gray-800'
            }`}
          >
            👍 Pass
          </button>
          <button
            type="button"
            onClick={() => setThumbs(thumbs === 'down' ? null : 'down')}
            className={`flex-1 py-3 rounded-xl text-xl transition-all border ${
              thumbs === 'down'
                ? 'bg-red-900/50 border-red-500 ring-1 ring-red-500'
                : 'bg-gray-800/60 border-gray-700 hover:bg-gray-800'
            }`}
          >
            👎 Fail
          </button>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2">
          Score <span className="text-gray-700 normal-case font-normal">(optional)</span>
        </p>
        <div className="flex gap-0.5" onMouseLeave={() => setHoverRating(null)}>
          {([1, 2, 3, 4, 5] as const).map(star => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(rating === star ? null : star)}
              onMouseEnter={() => setHoverRating(star)}
              className={`flex-1 py-2 text-xl transition-colors ${
                star <= displayRating ? 'text-yellow-400' : 'text-gray-700 hover:text-gray-500'
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2">
          Issue tags
        </p>
        <div className="flex flex-wrap gap-1.5">
          {EMAIL_TAGS.map(({ label, sentiment }) => {
            const styles = TAG_STYLES[sentiment]
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleTag(label)}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                  selectedTags.includes(label) ? styles.selected : styles.base
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2">
          Notes <span className="text-gray-700 normal-case font-normal">(optional)</span>
        </p>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="What should it have said? Any notes for improving…"
          rows={3}
          className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none resize-none focus:border-indigo-500/60 transition-colors leading-relaxed"
        />
      </div>

      <div className="flex gap-3 pb-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || (thumbs === null && rating === null && selectedTags.length === 0 && !comment.trim())}
          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        {showSkip && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2.5 text-gray-600 hover:text-gray-400 text-sm transition-colors"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  )
}
