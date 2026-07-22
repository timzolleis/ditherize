import { useEffect, useRef, type RefObject } from 'react'
import type { DotData } from '../dither/types'
import { dotDataToLayout, type DotLayout } from './layout'
import { createRenderBuckets, renderDots, type RenderBuckets } from './renderDots'

export interface AnimConfig {
  readonly mouseRadius: number
  readonly mouseStrength: number
  readonly falloffExponent: number
  readonly springBack: number
  readonly shockwaveSpeed: number
  readonly shockwaveWidth: number
  readonly shockwaveStrength: number
  readonly shockwaveDuration: number
  readonly dotScale: number
  readonly invert: boolean
}

export const DEFAULT_ANIM_CONFIG: AnimConfig = {
  mouseRadius: 100,
  mouseStrength: 40,
  falloffExponent: 3,
  springBack: 0.12,
  shockwaveSpeed: 225,
  shockwaveWidth: 37,
  shockwaveStrength: 20,
  shockwaveDuration: 675,
  dotScale: 1,
  invert: true,
}

interface Shockwave { x: number; y: number; start: number }

interface DotState {
  readonly context: CanvasRenderingContext2D
  readonly width: number
  readonly height: number
  readonly layout: DotLayout
  readonly renderX: Float32Array
  readonly renderY: Float32Array
  readonly displaceX: Float32Array
  readonly displaceY: Float32Array
  readonly buckets: RenderBuckets
  mouseX: number
  mouseY: number
  mouseActive: boolean
  shockwaves: Shockwave[]
  hasDisplacement: boolean
}

export function useDotAnimation(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  dotData: DotData,
  config: AnimConfig,
): void {
  // Physics values are read through a ref so slider drags tune the live
  // animation instead of tearing it down and rebuilding the dot field.
  const configRef = useRef(config)
  configRef.current = config
  // Layout-shaping values do require a rebuild.
  const { dotScale, invert } = config

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let state: DotState | null = null
    let animationFrame: number | null = null
    let disposed = false
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const initialize = (): DotState | null => {
      const rect = canvas.getBoundingClientRect()
      const width = rect.width
      const height = rect.height
      if (width === 0 || height === 0) return null
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      const context = canvas.getContext('2d')
      if (!context) return null
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      const layout = dotDataToLayout(dotData, width, height, {
        scale: 0.74,
        dotScale,
        invert: invert && dotData.kind === 'bw',
      })
      return {
        context,
        width,
        height,
        layout,
        renderX: new Float32Array(layout.x),
        renderY: new Float32Array(layout.y),
        displaceX: new Float32Array(layout.count),
        displaceY: new Float32Array(layout.count),
        buckets: createRenderBuckets(layout),
        mouseX: -10_000,
        mouseY: -10_000,
        mouseActive: false,
        shockwaves: [],
        hasDisplacement: false,
      }
    }

    const requestTick = () => {
      if (animationFrame === null && !disposed) animationFrame = requestAnimationFrame(tick)
    }

    const tick = (now: number) => {
      animationFrame = null
      const current = state
      if (!current || disposed) return
      const config = configRef.current
      const duration = Math.max(1, config.shockwaveDuration)
      current.shockwaves = current.shockwaves.filter((wave) => now - wave.start < duration)
      const hasShockwaves = current.shockwaves.length > 0
      const needsPhysics = !reducedMotion && (current.mouseActive || hasShockwaves || current.hasDisplacement)
      let needsAnotherFrame = hasShockwaves

      if (needsPhysics) {
        const radius = Math.max(1, config.mouseRadius)
        const radiusSquared = radius * radius
        const spring = Math.max(0.01, Math.min(1, config.springBack))
        const spamMultiplier = 1 + Math.max(0, current.shockwaves.length - 1) * 0.5
        current.hasDisplacement = false

        for (let index = 0; index < current.layout.count; index++) {
          const size = current.layout.size[index]
          const baseX = current.layout.x[index] + size / 2
          const baseY = current.layout.y[index] + size / 2
          let forceX = 0
          let forceY = 0

          if (current.mouseActive) {
            const dx = baseX + current.displaceX[index] - current.mouseX
            const dy = baseY + current.displaceY[index] - current.mouseY
            const distanceSquared = dx * dx + dy * dy
            if (distanceSquared < radiusSquared && distanceSquared > 0.1) {
              const distance = Math.sqrt(distanceSquared)
              const proximity = 1 - distance / radius
              const force = Math.pow(proximity, config.falloffExponent) * config.mouseStrength
              forceX = (dx / distance) * force
              forceY = (dy / distance) * force
            }
          }

          for (const wave of current.shockwaves) {
            const elapsedMs = now - wave.start
            const ringRadius = (elapsedMs / 1000) * config.shockwaveSpeed
            const fade = 1 - elapsedMs / duration
            const dx = baseX - wave.x
            const dy = baseY - wave.y
            const distance = Math.hypot(dx, dy)
            if (distance < 0.1) continue
            const distanceFromRing = Math.abs(distance - ringRadius)
            if (distanceFromRing < config.shockwaveWidth) {
              const ringFactor = 1 - distanceFromRing / Math.max(1, config.shockwaveWidth)
              const strength = ringFactor * fade * config.shockwaveStrength * spamMultiplier
              forceX += (dx / distance) * strength
              forceY += (dy / distance) * strength
            }
          }

          current.displaceX[index] += (forceX - current.displaceX[index]) * spring
          current.displaceY[index] += (forceY - current.displaceY[index]) * spring
          if (Math.abs(current.displaceX[index]) < 0.01) current.displaceX[index] = 0
          if (Math.abs(current.displaceY[index]) < 0.01) current.displaceY[index] = 0
          if (current.displaceX[index] !== 0 || current.displaceY[index] !== 0) {
            current.hasDisplacement = true
            needsAnotherFrame = true
          }
          current.renderX[index] = current.layout.x[index] + current.displaceX[index]
          current.renderY[index] = current.layout.y[index] + current.displaceY[index]
        }
      }

      renderDots(current.context, current.layout, current.renderX, current.renderY, current.width, current.height, current.buckets)
      if (current.mouseActive || needsAnotherFrame) requestTick()
    }

    const localCoordinates = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!state || reducedMotion || event.pointerType !== 'mouse') return
      const point = localCoordinates(event)
      state.mouseX = point.x
      state.mouseY = point.y
      state.mouseActive = true
      requestTick()
    }
    const onPointerLeave = (event: PointerEvent) => {
      if (!state || event.pointerType !== 'mouse') return
      state.mouseActive = false
      requestTick()
    }
    const onPointerUp = (event: PointerEvent) => {
      if (!state || reducedMotion) return
      const point = localCoordinates(event)
      state.shockwaves.push({ ...point, start: performance.now() })
      requestTick()
    }
    const onResize = () => {
      state = initialize()
      requestTick()
    }

    state = initialize()
    requestTick()
    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(canvas)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('pointerup', onPointerUp)

    return () => {
      disposed = true
      if (animationFrame !== null) cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('pointerup', onPointerUp)
    }
  }, [canvasRef, dotData, dotScale, invert])
}
