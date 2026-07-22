import { useEffect, useMemo, useRef, useState } from 'react'
import { toReactComponent, toReactPreset } from '../animate/component-exporter'
import { DEFAULT_ANIM_CONFIG, useDotAnimation, type AnimConfig } from '../animate/useDotAnimation'
import { ditherImage } from '../dither/engine'
import { hexToRgb, lightestColorIndex } from '../dither/palette'
import { DEFAULT_DITHER_CONFIG } from '../dither/types'
import { makePlaceholder } from '../placeholder'
import { loadDotData } from '../store/dotStore'
import { loadAnimConfig, saveAnimConfig } from '../store/sessionStore'
import { Checkbox } from '../ui/Checkbox'
import { Section } from '../ui/Section'
import { Slider } from '../ui/Slider'

async function copyText(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = content
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    return copied
  }
}

export function AnimatePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dotData = useMemo(() => loadDotData() ?? ditherImage(makePlaceholder(), DEFAULT_DITHER_CONFIG), [])
  const [config, setConfig] = useState<AnimConfig>(() => loadAnimConfig())
  const [copyStatus, setCopyStatus] = useState('React only · no package required')
  const patchConfig = (patch: Partial<AnimConfig>) => setConfig((current) => ({ ...current, ...patch }))
  const paletteBackground = useMemo(() => {
    if (dotData.kind !== 'palette') return undefined
    const colors = dotData.palette.map(hexToRgb).filter((color) => color !== null)
    return colors.length === dotData.palette.length ? dotData.palette[lightestColorIndex(colors)] : dotData.palette[0]
  }, [dotData])
  useDotAnimation(canvasRef, dotData, config)
  useEffect(() => saveAnimConfig(config), [config])

  return (
    <main className="workspace animate-workspace">
      <aside className="sidebar" aria-label="Animation settings">
        <div className="sidebar-intro">
          <span className="eyebrow">DOT DATA</span>
          <div className="source-row">
            <div>
              <strong>{dotData.kind === 'palette' ? 'Color dither' : 'Monochrome dither'}</strong>
              <span>{dotData.dots.length.toLocaleString()} dots · {dotData.width} × {dotData.height}</span>
            </div>
            <button className="small-button" type="button" onClick={() => setConfig(DEFAULT_ANIM_CONFIG)}>Reset</button>
          </div>
        </div>

        <div className="implementation-card">
          <span className="eyebrow">IMPLEMENTATION</span>
          <strong>dither-animation.tsx</strong>
          <p>A data-agnostic React framework. Supply any compact preset through its props.</p>
          <button
            className="primary-button implementation-copy"
            type="button"
            onClick={() => {
              void copyText(toReactComponent()).then((copied) => {
                setCopyStatus(copied ? 'dither-animation.tsx copied' : 'Clipboard unavailable')
              })
            }}
          >Copy component <span>↗</span></button>
          <button
            className="preset-copy"
            type="button"
            onClick={() => {
              void copyText(toReactPreset(dotData, config)).then((copied) => {
                setCopyStatus(copied ? 'dither-preset.ts copied' : 'Clipboard unavailable')
              })
            }}
          >Copy compact preset</button>
          <small aria-live="polite">{copyStatus}</small>
        </div>

        <Section title="Pointer field">
          <Slider label="Mouse radius" value={config.mouseRadius} min={20} max={240} suffix="px" onChange={(mouseRadius) => patchConfig({ mouseRadius })} />
          <Slider label="Mouse strength" value={config.mouseStrength} min={0} max={120} onChange={(mouseStrength) => patchConfig({ mouseStrength })} />
          <Slider label="Falloff exponent" value={config.falloffExponent} min={1} max={6} step={0.1} onChange={(falloffExponent) => patchConfig({ falloffExponent })} />
          <Slider label="Spring back" value={config.springBack} min={0.01} max={0.4} step={0.01} onChange={(springBack) => patchConfig({ springBack })} />
        </Section>

        <Section title="Click shockwave">
          <Slider label="Wave speed" value={config.shockwaveSpeed} min={50} max={600} suffix="px/s" onChange={(shockwaveSpeed) => patchConfig({ shockwaveSpeed })} />
          <Slider label="Wave width" value={config.shockwaveWidth} min={5} max={100} suffix="px" onChange={(shockwaveWidth) => patchConfig({ shockwaveWidth })} />
          <Slider label="Wave strength" value={config.shockwaveStrength} min={0} max={80} onChange={(shockwaveStrength) => patchConfig({ shockwaveStrength })} />
          <Slider label="Duration" value={config.shockwaveDuration} min={100} max={2000} step={25} suffix="ms" onChange={(shockwaveDuration) => patchConfig({ shockwaveDuration })} />
        </Section>

        <Section title="Dots">
          <Slider label="Dot scale" value={config.dotScale} min={0.15} max={1.4} step={0.05} onChange={(dotScale) => patchConfig({ dotScale })} />
          <Checkbox
            label="Invert dot map"
            checked={config.invert}
            disabled={dotData.kind === 'palette'}
            onChange={(invert) => patchConfig({ invert })}
          />
        </Section>

        <div className="sidebar-note">
          <span>PHYSICS</span>
          Cursor force uses a configurable power falloff. A single spring interpolation handles both displacement and return-home motion.
        </div>

      </aside>

      <section className="stage animation-stage" aria-label="Dot animation playground">
        <div className="stage-toolbar">
          <div><span className="live-dot" /> Physics active</div>
          <span>Move to repel · click for shockwave</span>
        </div>
        <div className="canvas-shell animation-shell" style={paletteBackground ? { background: paletteBackground } : undefined}>
          <canvas ref={canvasRef} aria-label="Interactive dithered dot animation" />
          <div className="interaction-hint" aria-hidden="true">
            <span className="cursor-ring" />
            Move your cursor across the field
          </div>
        </div>
        <footer className="stage-footer animation-footer">
          <div className="dot-stat"><strong>{dotData.dots.length.toLocaleString()}</strong><span>source dots</span></div>
          <div className="physics-equation">force = proximity<sup>{config.falloffExponent.toFixed(1)}</sup> × {config.mouseStrength}</div>
          <div className="motion-status"><span /> IDLE-AWARE RAF</div>
        </footer>
      </section>
    </main>
  )
}
