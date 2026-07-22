import { encodeDotData } from '../dither/compact-data'
import type { DotData } from '../dither/types'
import type { AnimConfig } from './useDotAnimation'

function configSource(config: AnimConfig): string {
  return `{
  mouseRadius: ${config.mouseRadius},
  mouseStrength: ${config.mouseStrength},
  falloffExponent: ${config.falloffExponent},
  springBack: ${config.springBack},
  shockwaveSpeed: ${config.shockwaveSpeed},
  shockwaveWidth: ${config.shockwaveWidth},
  shockwaveStrength: ${config.shockwaveStrength},
  shockwaveDuration: ${config.shockwaveDuration},
  dotScale: ${config.dotScale},
  invert: ${config.invert},
}`
}

export function toReactPreset(data: DotData, config: AnimConfig): string {
  return `// dither-preset.ts\nexport const ditherPreset = {\n  data: '${encodeDotData(data)}',\n  config: ${configSource(config)},\n} as const\n`
}

/** Generate an agnostic, single-file React animation framework. */
export function toReactComponent(): string {
  return `// dither-animation.tsx
// Paste this file into your React project. Its parent must have an explicit size.
// Usage: <DitherAnimation {...ditherPreset} />
import { useEffect, useRef, type CanvasHTMLAttributes } from 'react'

export interface AnimationConfig {
  mouseRadius: number
  mouseStrength: number
  falloffExponent: number
  springBack: number
  shockwaveSpeed: number
  shockwaveWidth: number
  shockwaveStrength: number
  shockwaveDuration: number
  dotScale: number
  invert: boolean
}

type BwDot = readonly [col: number, row: number]
type PaletteDot = readonly [col: number, row: number, paletteIndex: number]
export type DotData =
  | { kind: 'bw'; width: number; height: number; cornerRadius: number; dots: ReadonlyArray<BwDot> }
  | { kind: 'palette'; width: number; height: number; cornerRadius: number; palette: readonly string[]; dots: ReadonlyArray<PaletteDot> }
export type EncodedDitherData = \`ds1:\${string}\`

function readValue(bytes: Uint8Array, offset: number, bits: number): number {
  let value = 0
  for (let bit = 0; bit < bits; bit++) {
    value |= ((bytes[(offset + bit) >> 3] >> ((offset + bit) & 7)) & 1) << bit
  }
  return value
}

export function decodeDitherData(encoded: EncodedDitherData | string): DotData {
  const [version, mode, widthValue, heightValue, radiusValue, paletteValue, payload] = encoded.split(':')
  const width = Number(widthValue)
  const height = Number(heightValue)
  const cornerRadius = Number(radiusValue)
  if (version !== 'ds1' || (mode !== 'b' && mode !== 'p') || !Number.isInteger(width) || !Number.isInteger(height) || !payload) {
    throw new Error('Invalid compact dither data')
  }
  const palette = mode === 'p' ? paletteValue.split(',').filter(Boolean).map((color) => \`#\${color}\`) : []
  const bits = mode === 'b' ? 1 : Math.max(1, Math.ceil(Math.log2(palette.length + 1)))
  const base64 = payload.replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4))
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  if (bytes.length * 8 < width * height * bits) throw new Error('Compact dither data is truncated')

  if (mode === 'b') {
    const dots: BwDot[] = []
    for (let index = 0; index < width * height; index++) {
      if (readValue(bytes, index * bits, bits) === 1) dots.push([index % width, Math.floor(index / width)])
    }
    return { kind: 'bw', width, height, cornerRadius, dots }
  }
  const dots: PaletteDot[] = []
  for (let index = 0; index < width * height; index++) {
    const value = readValue(bytes, index * bits, bits)
    if (value > 0 && value <= palette.length) dots.push([index % width, Math.floor(index / width), value - 1])
  }
  return { kind: 'palette', width, height, cornerRadius, palette, dots }
}

interface Layout {
  x: Float32Array
  y: Float32Array
  size: Float32Array
  paletteIndex: Uint8Array
  palette: readonly string[]
  count: number
  /** Dot indices grouped by palette color, built once — the grouping never changes. */
  buckets: Int32Array[]
}

function insideRoundedRect(col: number, row: number, width: number, height: number, radius: number): boolean {
  if (radius <= 0) return true
  const r = Math.min(radius, Math.min(width, height) / 2)
  const x = col + 0.5
  const y = row + 0.5
  const nearestX = Math.max(r, Math.min(width - r, x))
  const nearestY = Math.max(r, Math.min(height - r, y))
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= r ** 2
}

function createLayout(data: DotData, canvasWidth: number, canvasHeight: number, fit: 'cover' | 'contain', fieldScale: number, dotScale: number, invert: boolean): Layout {
  const dots: Array<readonly [number, number, number]> = []
  if (invert && data.kind === 'bw') {
    const occupied = new Set(data.dots.map(([col, row]) => row * data.width + col))
    for (let row = 0; row < data.height; row++) {
      for (let col = 0; col < data.width; col++) {
        if (insideRoundedRect(col, row, data.width, data.height, data.cornerRadius) && !occupied.has(row * data.width + col)) dots.push([col, row, 0])
      }
    }
  } else if (data.kind === 'palette') {
    for (const [col, row, color] of data.dots) dots.push([col, row, color])
  } else {
    for (const [col, row] of data.dots) dots.push([col, row, 0])
  }

  const widthScale = canvasWidth / data.width
  const heightScale = canvasHeight / data.height
  const fitScale = fit === 'cover' ? Math.max(widthScale, heightScale) : Math.min(widthScale, heightScale)
  const cell = Math.max(0.5, fitScale * Math.max(0.05, fieldScale))
  const offsetX = (canvasWidth - data.width * cell) / 2
  const offsetY = (canvasHeight - data.height * cell) / 2
  const x = new Float32Array(dots.length)
  const y = new Float32Array(dots.length)
  const size = new Float32Array(dots.length)
  const paletteIndex = new Uint8Array(dots.length)
  dots.forEach(([col, row, color], index) => {
    x[index] = offsetX + col * cell
    y[index] = offsetY + row * cell
    size[index] = cell * Math.max(0.05, dotScale)
    paletteIndex[index] = color
  })
  const palette = data.kind === 'palette' ? data.palette : ['#e8e7e2']
  const lengths = new Int32Array(palette.length)
  for (let index = 0; index < dots.length; index++) lengths[Math.min(palette.length - 1, paletteIndex[index])]++
  const buckets = Array.from({ length: palette.length }, (_, bucket) => new Int32Array(lengths[bucket]))
  const cursors = new Int32Array(palette.length)
  for (let index = 0; index < dots.length; index++) {
    const bucket = Math.min(palette.length - 1, paletteIndex[index])
    buckets[bucket][cursors[bucket]++] = index
  }
  return { x, y, size, paletteIndex, palette, count: dots.length, buckets }
}

function render(context: CanvasRenderingContext2D, layout: Layout, x: Float32Array, y: Float32Array, width: number, height: number): void {
  context.clearRect(0, 0, width, height)
  for (let color = 0; color < layout.buckets.length; color++) {
    const indices = layout.buckets[color]
    if (indices.length === 0) continue
    context.fillStyle = layout.palette[color]
    for (let position = 0; position < indices.length; position++) {
      const index = indices[position]
      const size = layout.size[index]
      context.fillRect(x[index] - 0.25, y[index] - 0.25, size + 0.5, size + 0.5)
    }
  }
}

export interface DitherAnimationProps extends Omit<CanvasHTMLAttributes<HTMLCanvasElement>, 'width' | 'height'> {
  data: DotData | EncodedDitherData
  config: AnimationConfig
  /** Like object-fit: cover fills and crops; contain shows the complete field. */
  fit?: 'cover' | 'contain'
  /** Additional zoom multiplier applied after fitting. */
  fieldScale?: number
}

export function DitherAnimation({
  data,
  config,
  fit = 'cover',
  fieldScale = 1,
  style,
  ...canvasProps
}: DitherAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Physics values are read through a ref so config changes tune the live
  // animation instead of tearing it down and rebuilding the dot field.
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataValue = typeof data === 'string' ? decodeDitherData(data) : data
    let frame: number | null = null
    let disposed = false
    let state: {
      context: CanvasRenderingContext2D
      width: number
      height: number
      layout: Layout
      renderX: Float32Array
      renderY: Float32Array
      displaceX: Float32Array
      displaceY: Float32Array
      mouseX: number
      mouseY: number
      mouseActive: boolean
      shockwaves: Array<{ x: number; y: number; start: number }>
      moving: boolean
    } | null = null
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

    const initialize = () => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return null
      const dpr = devicePixelRatio || 1
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      const context = canvas.getContext('2d')
      if (!context) return null
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      const layout = createLayout(dataValue, rect.width, rect.height, fit, fieldScale, config.dotScale, config.invert)
      return {
        context, width: rect.width, height: rect.height, layout,
        renderX: new Float32Array(layout.x), renderY: new Float32Array(layout.y),
        displaceX: new Float32Array(layout.count), displaceY: new Float32Array(layout.count),
        mouseX: -10000, mouseY: -10000, mouseActive: false, shockwaves: [], moving: false,
      }
    }

    const requestTick = () => {
      if (frame === null && !disposed) frame = requestAnimationFrame(tick)
    }
    const tick = (now: number) => {
      frame = null
      if (!state || disposed) return
      const config = configRef.current
      const duration = Math.max(1, config.shockwaveDuration)
      state.shockwaves = state.shockwaves.filter((wave) => now - wave.start < duration)
      const hasWaves = state.shockwaves.length > 0
      const needsPhysics = !reducedMotion && (state.mouseActive || hasWaves || state.moving)
      let continueAnimation = hasWaves

      if (needsPhysics) {
        const radius = Math.max(1, config.mouseRadius)
        const radiusSquared = radius ** 2
        const spring = Math.max(0.01, Math.min(1, config.springBack))
        const spamMultiplier = 1 + Math.max(0, state.shockwaves.length - 1) * 0.5
        state.moving = false
        for (let index = 0; index < state.layout.count; index++) {
          const size = state.layout.size[index]
          const baseX = state.layout.x[index] + size / 2
          const baseY = state.layout.y[index] + size / 2
          let forceX = 0
          let forceY = 0
          if (state.mouseActive) {
            const dx = baseX + state.displaceX[index] - state.mouseX
            const dy = baseY + state.displaceY[index] - state.mouseY
            const distanceSquared = dx * dx + dy * dy
            if (distanceSquared < radiusSquared && distanceSquared > 0.1) {
              const distance = Math.sqrt(distanceSquared)
              const force = Math.pow(1 - distance / radius, config.falloffExponent) * config.mouseStrength
              forceX = dx / distance * force
              forceY = dy / distance * force
            }
          }
          for (const wave of state.shockwaves) {
            const elapsed = now - wave.start
            const ringRadius = elapsed / 1000 * config.shockwaveSpeed
            const dx = baseX - wave.x
            const dy = baseY - wave.y
            const distance = Math.hypot(dx, dy)
            const ringDistance = Math.abs(distance - ringRadius)
            if (distance > 0.1 && ringDistance < config.shockwaveWidth) {
              const strength = (1 - ringDistance / Math.max(1, config.shockwaveWidth)) * (1 - elapsed / duration) * config.shockwaveStrength * spamMultiplier
              forceX += dx / distance * strength
              forceY += dy / distance * strength
            }
          }
          state.displaceX[index] += (forceX - state.displaceX[index]) * spring
          state.displaceY[index] += (forceY - state.displaceY[index]) * spring
          if (Math.abs(state.displaceX[index]) < 0.01) state.displaceX[index] = 0
          if (Math.abs(state.displaceY[index]) < 0.01) state.displaceY[index] = 0
          if (state.displaceX[index] || state.displaceY[index]) {
            state.moving = true
            continueAnimation = true
          }
          state.renderX[index] = state.layout.x[index] + state.displaceX[index]
          state.renderY[index] = state.layout.y[index] + state.displaceY[index]
        }
      }
      render(state.context, state.layout, state.renderX, state.renderY, state.width, state.height)
      if (state.mouseActive || continueAnimation) requestTick()
    }

    const point = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }
    const onMove = (event: PointerEvent) => {
      if (!state || reducedMotion || event.pointerType !== 'mouse') return
      const local = point(event)
      state.mouseX = local.x
      state.mouseY = local.y
      state.mouseActive = true
      requestTick()
    }
    const onLeave = () => {
      if (!state) return
      state.mouseActive = false
      requestTick()
    }
    const onUp = (event: PointerEvent) => {
      if (!state || reducedMotion) return
      state.shockwaves.push({ ...point(event), start: performance.now() })
      requestTick()
    }
    const onResize = () => {
      state = initialize()
      requestTick()
    }

    state = initialize()
    requestTick()
    const observer = new ResizeObserver(onResize)
    observer.observe(canvas)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerup', onUp)
    return () => {
      disposed = true
      if (frame !== null) cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointerup', onUp)
    }
  }, [data, fit, fieldScale, config.dotScale, config.invert])

  return <canvas ref={canvasRef} style={{ display: 'block', touchAction: 'none', ...style }} {...canvasProps} />
}
`
}
