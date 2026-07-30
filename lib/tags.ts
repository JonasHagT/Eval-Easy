export const TAG_STYLES: Record<string, { base: string; selected: string }> = {
  negative: {
    base: 'border-red-800 text-red-400 bg-red-950/30 hover:bg-red-950/60',
    selected: 'border-red-500 text-red-200 bg-red-900/50 ring-1 ring-red-500',
  },
  warning: {
    base: 'border-amber-800 text-amber-400 bg-amber-950/30 hover:bg-amber-950/60',
    selected: 'border-amber-500 text-amber-200 bg-amber-900/50 ring-1 ring-amber-500',
  },
  positive: {
    base: 'border-green-800 text-green-400 bg-green-950/30 hover:bg-green-950/60',
    selected: 'border-green-500 text-green-200 bg-green-900/50 ring-1 ring-green-500',
  },
}
