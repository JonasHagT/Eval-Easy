'use client'

import { useMemo, useState } from 'react'
import { Invite } from '@/lib/types'

interface Props {
  runId: string
  runName: string
  agentId?: string
  onClose: () => void
  onCreated?: (invite: Invite, url: string) => void
}

export default function InviteModal({ runId, runName, agentId, onClose, onCreated }: Props) {
  const [label, setLabel] = useState(`Review: ${runName}`)
  const [suggestedName, setSuggestedName] = useState('')
  const [creating, setCreating] = useState(false)
  const [invite, setInvite] = useState<Invite | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const url = useMemo(() => {
    if (!invite || typeof window === 'undefined') return ''
    return `${window.location.origin}/review/${invite.token}`
  }, [invite])

  const create = async () => {
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          agentId,
          label: label.trim() || `Review: ${runName}`,
          suggestedName: suggestedName.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create invite')
      setInvite(data)
      const fullUrl = `${window.location.origin}/review/${data.token}`
      onCreated?.(data, fullUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite')
    } finally {
      setCreating(false)
    }
  }

  const copy = async () => {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Invite a reviewer</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-300 text-2xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-gray-500">
          Send a link to a domain specialist. They can score responses one at a time — no setup,
          no API keys, no config screens.
        </p>

        {!invite ? (
          <>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                Invite label
              </label>
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-100 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                Reviewer name <span className="text-gray-700 normal-case font-normal">(optional)</span>
              </label>
              <input
                value={suggestedName}
                onChange={e => setSuggestedName(e.target.value)}
                placeholder="e.g. Sarah"
                className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none transition-colors"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button
                onClick={create}
                disabled={creating}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {creating ? 'Creating…' : 'Create invite link'}
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-gray-500 hover:text-gray-300 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                Review link
              </p>
              <p className="text-sm text-indigo-300 break-all font-mono leading-relaxed">{url}</p>
              <button
                onClick={copy}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
            <p className="text-xs text-gray-600">
              Share this link with your specialist. They&apos;ll land on a review queue for{' '}
              <span className="text-gray-400">{runName}</span>.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 text-gray-400 hover:text-white text-sm border border-gray-700 hover:border-gray-500 rounded-xl transition-colors"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  )
}
