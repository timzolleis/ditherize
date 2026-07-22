interface CheckboxProps {
  readonly label: string
  readonly checked: boolean
  readonly disabled?: boolean
  readonly onChange: (checked: boolean) => void
}

export function Checkbox({ label, checked, disabled = false, onChange }: CheckboxProps) {
  return (
    <label className={`checkbox-control${disabled ? ' is-disabled' : ''}`}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch" aria-hidden="true" />
    </label>
  )
}
