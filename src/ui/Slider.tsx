interface SliderProps {
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step?: number
  readonly suffix?: string
  readonly onChange: (value: number) => void
}

export function Slider({ label, value, min, max, step = 1, suffix = '', onChange }: SliderProps) {
  const id = `slider-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`
  return (
    <label className="control slider-control" htmlFor={id}>
      <span className="control-label">
        <span>{label}</span>
        <output htmlFor={id}>{Number.isInteger(step) ? value : value.toFixed(step < 0.1 ? 2 : 1)}{suffix}</output>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--range-progress': `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
