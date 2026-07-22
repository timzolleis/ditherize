/** The monochrome treatment used by preview canvases. */
export type PreviewMode = 'dark' | 'light'

/** User-selected preview colors. A null background uses the selected mode default. */
export interface PreviewAppearance {
  readonly mode: PreviewMode
  readonly backgroundColor: string | null
}

/** Concrete colors consumed by canvas renderers. */
export interface PreviewColors {
  readonly background: string
  readonly foreground: string
}

/** Default preview appearance for new sessions. */
export const DEFAULT_PREVIEW_APPEARANCE: PreviewAppearance = {
  mode: 'dark',
  backgroundColor: null,
}

/** Resolve mode defaults and an optional custom background into renderable colors. */
export function resolvePreviewColors(appearance: PreviewAppearance): PreviewColors {
  if (appearance.mode === 'light') {
    return {
      background: appearance.backgroundColor ?? '#f7f6f2',
      foreground: '#1a1a18',
    }
  }

  return {
    background: appearance.backgroundColor ?? '#151513',
    foreground: '#eeede7',
  }
}
