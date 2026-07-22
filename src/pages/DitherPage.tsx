import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { ditherImage } from '../dither/engine'
import { toJsCode, toJson, toPngBlob, toSvg } from '../dither/exporters'
import { KERNEL_NAMES } from '../dither/kernels'
import { PRESET_PALETTES } from '../dither/palette'
import type { DitherConfig, DotData, PixelBuffer } from '../dither/types'
import { resolvePreviewColors, type PreviewAppearance, type PreviewColors } from '../preview/appearance'
import { IMAGE_UPLOAD_ACCEPT, readImageFile } from '../source/imageUpload'
import { saveDotData } from '../store/dotStore'
import { savePersistedSource } from '../store/sessionStore'
import { Checkbox } from '../ui/Checkbox'
import { PaletteEditor } from '../ui/PaletteEditor'
import { PreviewControls } from '../ui/PreviewControls'
import { Section } from '../ui/Section'
import { Slider } from '../ui/Slider'

const kernelLabels: Record<string, string> = {
  FloydSteinberg: 'Floyd–Steinberg',
  Atkinson: 'Atkinson',
  JarvisJudiceNinke: 'Jarvis–Judice–Ninke',
  Stucki: 'Stucki',
  Burkes: 'Burkes',
  Sierra3: 'Sierra 3',
  Sierra2: 'Sierra 2',
  Sierra24A: 'Sierra Lite',
  Fan: 'Fan',
  ShiauFan: 'Shiau–Fan',
  ShiauFan2: 'Shiau–Fan 2',
}

function drawPreview(canvas: HTMLCanvasElement, data: DotData, colors: PreviewColors): void {
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.round(rect.width * dpr))
  canvas.height = Math.max(1, Math.round(rect.height * dpr))
  const context = canvas.getContext('2d')
  if (!context) return
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.fillStyle = colors.background
  context.fillRect(0, 0, rect.width, rect.height)

  const padding = Math.min(rect.width, rect.height) * 0.09
  const cell = Math.min((rect.width - padding * 2) / data.width, (rect.height - padding * 2) / data.height)
  const offsetX = (rect.width - data.width * cell) / 2
  const offsetY = (rect.height - data.height * cell) / 2
  const dotSize = Math.max(0.7, cell * 0.86)
  const inset = (cell - dotSize) / 2

  if (data.kind === 'bw') {
    context.fillStyle = colors.foreground
    data.dots.forEach(([col, row]) => context.fillRect(offsetX + col * cell + inset, offsetY + row * cell + inset, dotSize, dotSize))
  } else {
    // One pass over the dots: group by color first so fill style changes once per color.
    const byColor: Array<Array<readonly [number, number]>> = data.palette.map(() => [])
    data.dots.forEach(([col, row, dotPaletteIndex]) => byColor[dotPaletteIndex]?.push([col, row]))
    byColor.forEach((positions, paletteIndex) => {
      if (positions.length === 0) return
      context.fillStyle = data.palette[paletteIndex]
      positions.forEach(([col, row]) => {
        context.fillRect(offsetX + col * cell + inset, offsetY + row * cell + inset, dotSize, dotSize)
      })
    })
  }
}

function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function downloadText(name: string, content: string, type: string): void {
  downloadBlob(name, new Blob([content], { type }))
}

interface DitherPageProps {
  readonly source: PixelBuffer
  readonly setSource: Dispatch<SetStateAction<PixelBuffer>>
  readonly sourceName: string
  readonly setSourceName: Dispatch<SetStateAction<string>>
  readonly config: DitherConfig
  readonly setConfig: Dispatch<SetStateAction<DitherConfig>>
  readonly previewAppearance: PreviewAppearance
  readonly setPreviewAppearance: Dispatch<SetStateAction<PreviewAppearance>>
}

export function DitherPage({
  source,
  setSource,
  sourceName,
  setSourceName,
  config,
  setConfig,
  previewAppearance,
  setPreviewAppearance,
}: DitherPageProps) {
  const [dotData, setDotData] = useState(() => ditherImage(source, config))
  const [message, setMessage] = useState('Ready to export')
  const [isProcessingUpload, setIsProcessingUpload] = useState(false)
  const [processingLabel, setProcessingLabel] = useState('Reading image…')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const processingSourceRef = useRef<PixelBuffer | null>(null)
  const previewColors = resolvePreviewColors(previewAppearance)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setDotData(ditherImage(source, config))
      } finally {
        if (processingSourceRef.current === source) {
          processingSourceRef.current = null
          setIsProcessingUpload(false)
        }
      }
    }, 50)
    return () => window.clearTimeout(timer)
  }, [source, config])

  useEffect(() => saveDotData(dotData), [dotData])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const render = () => drawPreview(canvas, dotData, previewColors)
    render()
    const observer = new ResizeObserver(render)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [dotData, previewColors.background, previewColors.foreground])

  const patchConfig = (patch: Partial<DitherConfig>) => setConfig((current) => ({ ...current, ...patch }))
  const palette = config.palette.kind === 'palette' ? config.palette : {
    kind: 'palette' as const,
    colors: ['#ffffff', '#000000'],
    colorSpace: 'rgb' as const,
    omitBackground: true,
  }
  const selectedPreset = PRESET_PALETTES.find((preset) =>
    preset.colors.join('').toLowerCase() === palette.colors.join('').toLowerCase(),
  )?.value ?? 'custom'

  return (
    <main className="workspace">
      <aside className="sidebar" aria-label="Dither settings">
        <div className="sidebar-intro">
          <span className="eyebrow">SOURCE</span>
          <div className="source-row">
            <div>
              <strong>{sourceName}</strong>
              <span>{source.width} × {source.height}px</span>
            </div>
            <label className={`small-button upload-button${isProcessingUpload ? ' is-busy' : ''}`}>
              {isProcessingUpload ? 'Working…' : 'Replace'}
              <input
                type="file"
                accept={IMAGE_UPLOAD_ACCEPT}
                disabled={isProcessingUpload}
                onChange={async (event) => {
                  const input = event.currentTarget
                  const file = input.files?.[0]
                  if (!file) return
                  try {
                    setMessage('Loading image…')
                    setProcessingLabel('Reading image…')
                    setIsProcessingUpload(true)
                    // Yield once so the loading overlay paints before image decoding starts.
                    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
                    const result = await readImageFile(file)
                    if (!result.ok) {
                      setIsProcessingUpload(false)
                      setMessage(result.error._tag === 'UnsupportedImageType'
                        ? 'Use a PNG, JPEG, WebP, GIF, or SVG image'
                        : 'Could not read that image')
                      return
                    }
                    const image = result.value
                    setProcessingLabel('Generating dot field…')
                    processingSourceRef.current = image
                    setSource(image)
                    setSourceName(file.name)
                    void savePersistedSource(image, file.name).then((persisted) => {
                      setMessage(persisted ? 'Image loaded and saved' : 'Image loaded · persistence unavailable')
                    })
                  } catch {
                    processingSourceRef.current = null
                    setIsProcessingUpload(false)
                    setMessage('Could not read that image')
                  } finally {
                    input.value = ''
                  }
                }}
              />
            </label>
          </div>
        </div>

        <Section title="Algorithm">
          <label className="select-control">
            <span>Diffusion kernel</span>
            <select value={config.algorithm} onChange={(event) => patchConfig({ algorithm: event.target.value as DitherConfig['algorithm'] })}>
              {KERNEL_NAMES.map((kernel) => <option key={kernel} value={kernel}>{kernelLabels[kernel]}</option>)}
            </select>
          </label>
        </Section>

        <Section title="Main settings">
          <Slider label="Scale" value={config.scale} min={0.05} max={0.5} step={0.01} onChange={(scale) => patchConfig({ scale })} />
          {config.palette.kind === 'bw' && <Slider label="Threshold" value={config.luminanceThreshold} min={0} max={255} onChange={(luminanceThreshold) => patchConfig({ luminanceThreshold })} />}
          <Slider label="Contrast" value={config.contrast} min={-100} max={100} onChange={(contrast) => patchConfig({ contrast })} />
          <Slider label="Gamma" value={config.gamma} min={0.2} max={3} step={0.05} onChange={(gamma) => patchConfig({ gamma })} />
          <Slider label="Highlights" value={config.highlights} min={0} max={100} suffix="%" onChange={(highlights) => patchConfig({ highlights })} />
          <Slider label="Blur" value={config.blurRadius} min={0} max={10} step={0.5} suffix="px" onChange={(blurRadius) => patchConfig({ blurRadius })} />
          <Checkbox label="Invert luminance" checked={config.invert} onChange={(invert) => patchConfig({ invert })} />
        </Section>

        <Section title="Error diffusion">
          <Slider label="Strength" value={config.errorStrength} min={0} max={1.5} step={0.05} onChange={(errorStrength) => patchConfig({ errorStrength })} />
          <Checkbox label="Serpentine scan" checked={config.serpentine} onChange={(serpentine) => patchConfig({ serpentine })} />
        </Section>

        <Section title="Shape">
          <Slider label="Corner radius" value={config.cornerRadius} min={0} max={0.5} step={0.01} suffix="×" onChange={(cornerRadius) => patchConfig({ cornerRadius })} />
        </Section>

        <Section title="Palette">
          <Checkbox
            label="Use color palette"
            checked={config.palette.kind === 'palette'}
            onChange={(enabled) => patchConfig({ palette: enabled ? palette : { kind: 'bw' } })}
          />
          {config.palette.kind === 'palette' && (
            <>
              <label className="select-control">
                <span>Preset</span>
                <select
                  value={selectedPreset}
                  onChange={(event) => {
                    const preset = PRESET_PALETTES.find(({ value }) => value === event.target.value)
                    if (preset) patchConfig({ palette: { ...palette, colors: [...preset.colors] } })
                  }}
                >
                  <option value="custom" disabled>Custom palette</option>
                  {PRESET_PALETTES.map((preset) => <option key={preset.value} value={preset.value}>{preset.name}</option>)}
                </select>
              </label>
              <PaletteEditor colors={palette.colors} onChange={(colors) => patchConfig({ palette: { ...palette, colors } })} />
              <label className="select-control">
                <span>Color matching</span>
                <select value={palette.colorSpace} onChange={(event) => patchConfig({ palette: { ...palette, colorSpace: event.target.value as 'rgb' | 'oklab' } })}>
                  <option value="rgb">Rec. 709 RGB</option>
                  <option value="oklab">OKLab perceptual</option>
                </select>
              </label>
              <Checkbox label="Omit lightest background" checked={palette.omitBackground} onChange={(omitBackground) => patchConfig({ palette: { ...palette, omitBackground } })} />
            </>
          )}
        </Section>
      </aside>

      <section className="stage" aria-label="Dither preview" aria-busy={isProcessingUpload}>
        <div className="stage-toolbar">
          <div>
            <span className="live-dot" /> Live preview
          </div>
          <div className="stage-toolbar-actions">
            <span>{dotData.width} × {dotData.height} grid</span>
            <PreviewControls appearance={previewAppearance} onChange={setPreviewAppearance} />
          </div>
        </div>
        <div className="canvas-shell dither-shell" style={{ background: previewColors.background }}>
          <canvas ref={canvasRef} aria-label="Generated dot preview" />
          {isProcessingUpload && (
            <div className="processing-overlay" role="status" aria-live="polite">
              <span className="processing-spinner" aria-hidden="true" />
              <strong>{processingLabel}</strong>
              <span>Large images can take a moment</span>
            </div>
          )}
        </div>
        <footer className="stage-footer">
          <div className="dot-stat"><strong>{dotData.dots.length.toLocaleString()}</strong><span>exportable dots</span></div>
          <div className="export-status" aria-live="polite">{message}</div>
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={() => {
              void navigator.clipboard.writeText(toJsCode(dotData)).then(() => setMessage('TypeScript copied')).catch(() => setMessage('Clipboard unavailable'))
            }}>Copy TS</button>
            <button className="secondary-button" type="button" onClick={() => {
              downloadText('dithered-dots.json', toJson(dotData), 'application/json')
              setMessage('Dot data downloaded')
            }}>JSON</button>
            <button className="secondary-button" type="button" onClick={() => {
              downloadText('dithered-image.svg', toSvg(dotData), 'image/svg+xml')
              setMessage('SVG downloaded')
            }}>SVG</button>
            <button className="primary-button" type="button" onClick={() => {
              setMessage('Rendering PNG…')
              void toPngBlob(dotData)
                .then((blob) => {
                  downloadBlob('dithered-image.png', blob)
                  setMessage('PNG downloaded')
                })
                .catch(() => setMessage('PNG export failed'))
            }}>Export PNG <span>↗</span></button>
          </div>
        </footer>
      </section>
    </main>
  )
}
