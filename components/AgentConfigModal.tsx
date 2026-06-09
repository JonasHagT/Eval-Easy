'use client'

import { useState } from 'react'
import { AgentConfig } from '@/lib/types'

const MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — recommended' },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 — most capable' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — fastest' },
]

interface Props {
  config: AgentConfig
  onSave: (config: AgentConfig) => void
  onClose: () => void
}

export default function AgentConfigModal({ config, onSave, onClose }: Props) {
  const [name, setName] = useState(config.name)
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt)
  const [model, setModel] = useState(config.model)
  const [annotationGuide, setAnnotationGuide] = useState(config.annotationGuide ?? '')

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Configure Agent</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-300 text-2xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
            Agent name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-100 outline-none transition-colors"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
            System prompt
          </label>
          <textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            rows={6}
            className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-100 outline-none resize-none transition-colors font-mono leading-relaxed"
            placeholder="You are a helpful assistant…"
          />
          <p className="text-xs text-gray-600 mt-1">
            This is sent as the system prompt to every conversation with this agent.
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
            What does a good answer look like?
          </label>
          <textarea
            value={annotationGuide}
            onChange={e => setAnnotationGuide(e.target.value)}
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none resize-none transition-colors leading-relaxed"
            placeholder="Describe what makes a good response for this agent. This guides the AI auto-grader during batch runs."
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
            Model
          </label>
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-100 outline-none transition-colors"
          >
            {MODELS.map(m => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={() => onSave({ name, systemPrompt, model, annotationGuide })}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Save &amp; Apply
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
