import { resolvePreviewColors, type PreviewAppearance, type PreviewMode } from '../preview/appearance'

interface PreviewControlsProps {
  readonly appearance: PreviewAppearance
  readonly onChange: (appearance: PreviewAppearance) => void
}

/** Controls the shared background and monochrome treatment of preview canvases. */
export function PreviewControls({ appearance, onChange }: PreviewControlsProps) {
  const colors = resolvePreviewColors(appearance)
  const selectMode = (mode: PreviewMode) => onChange({ ...appearance, mode })

  return (
    <div className="preview-controls" aria-label="Preview appearance">
      <div className="preview-mode" role="group" aria-label="Preview mode">
        <button
          type="button"
          aria-pressed={appearance.mode === 'dark'}
          onClick={() => selectMode('dark')}
        >Dark</button>
        <button
          type="button"
          aria-pressed={appearance.mode === 'light'}
          onClick={() => selectMode('light')}
        >Light</button>
      </div>
      <label className="preview-color" title="Custom preview background">
        <span>BG</span>
        <input
          type="color"
          value={colors.background}
          aria-label="Custom preview background"
          onChange={(event) => onChange({ ...appearance, backgroundColor: event.target.value })}
        />
      </label>
      {appearance.backgroundColor !== null && (
        <button
          className="preview-color-reset"
          type="button"
          aria-label="Use the mode’s default background"
          title="Use default background"
          onClick={() => onChange({ ...appearance, backgroundColor: null })}
        >×</button>
      )}
    </div>
  )
}
