import type { ReactNode } from 'react'

interface SectionProps {
  readonly title: string
  readonly children: ReactNode
}

export function Section({ title, children }: SectionProps) {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      <div className="settings-stack">{children}</div>
    </section>
  )
}
