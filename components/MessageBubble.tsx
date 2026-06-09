import { Message } from '@/lib/types'

interface Props {
  message: Message
  highlightForEval: boolean
}

export default function MessageBubble({ message, highlightForEval }: Props) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-bold shrink-0 text-white">
        AI
      </div>
      <div className="flex flex-col gap-1.5 max-w-[80%]">
        <div
          className={`bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed text-gray-100 transition-all ${
            highlightForEval ? 'ring-1 ring-indigo-500/60 bg-gray-800' : ''
          }`}
        >
          {message.content}
        </div>
        {highlightForEval && (
          <p className="text-xs text-indigo-400 ml-1 animate-pulse">
            Rate this response on the right →
          </p>
        )}
      </div>
    </div>
  )
}
