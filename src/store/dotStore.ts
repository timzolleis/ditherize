import type { DotData } from '../dither/types'

export const DOT_STORE_KEY = 'dither-studio:dots'

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

export function isDotData(value: unknown): value is DotData {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  if ((candidate.kind !== 'bw' && candidate.kind !== 'palette') ||
      !isInteger(candidate.width) || candidate.width < 1 ||
      !isInteger(candidate.height) || candidate.height < 1 ||
      !isInteger(candidate.cornerRadius) || candidate.cornerRadius < 0 ||
      !Array.isArray(candidate.dots)) return false

  if (candidate.kind === 'palette' &&
      (!Array.isArray(candidate.palette) || candidate.palette.length < 1 ||
       !candidate.palette.every((color) => typeof color === 'string'))) return false

  const tupleLength = candidate.kind === 'bw' ? 2 : 3
  return candidate.dots.every((dot) =>
    Array.isArray(dot) && dot.length === tupleLength && dot.every(isInteger) &&
    dot[0] >= 0 && dot[0] < (candidate.width as number) &&
    dot[1] >= 0 && dot[1] < (candidate.height as number) &&
    (tupleLength === 2 || (dot[2] >= 0 && dot[2] < (candidate.palette as unknown[]).length)),
  )
}

export function saveDotData(data: DotData): void {
  try {
    localStorage.setItem(DOT_STORE_KEY, JSON.stringify(data))
  } catch {
    // Storage can be unavailable in private browsing or constrained embeds.
  }
}

export function loadDotData(): DotData | null {
  try {
    const raw = localStorage.getItem(DOT_STORE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isDotData(parsed) ? parsed : null
  } catch {
    return null
  }
}
