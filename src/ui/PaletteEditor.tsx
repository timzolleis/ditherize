interface PaletteEditorProps {
  readonly colors: readonly string[]
  readonly onChange: (colors: string[]) => void
}

export function PaletteEditor({ colors, onChange }: PaletteEditorProps) {
  const changeColor = (index: number, value: string) => {
    const next = [...colors]
    next[index] = value
    onChange(next)
  }

  return (
    <div className="palette-editor" aria-label="Palette colors">
      <div className="palette-swatches">
        {colors.map((color, index) => (
          <label className="color-swatch" key={`${index}-${color}`} title={`Color ${index + 1}: ${color}`}>
            <input type="color" value={color} onChange={(event) => changeColor(index, event.target.value)} />
            <span style={{ background: color }} />
            {colors.length > 2 && (
              <button
                type="button"
                aria-label={`Remove color ${index + 1}`}
                onClick={(event) => {
                  event.preventDefault()
                  onChange(colors.filter((_, colorIndex) => colorIndex !== index))
                }}
              >×</button>
            )}
          </label>
        ))}
        {colors.length < 16 && (
          <button className="add-color" type="button" onClick={() => onChange([...colors, '#808080'])}>
            <span>+</span> Add
          </button>
        )}
      </div>
    </div>
  )
}
