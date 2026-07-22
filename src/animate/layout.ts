import { isInsideRoundedRectCell } from '../dither/mask'
import type { DotData, PaletteDot } from '../dither/types'

export interface DotLayout {
  readonly x: Float32Array
  readonly y: Float32Array
  readonly size: Float32Array
  readonly paletteIndex: Uint8Array
  readonly palette: readonly string[]
  readonly count: number
}

export interface LayoutConfig {
  readonly scale: number
  readonly dotScale: number
  readonly invert: boolean
}

function layoutDots(data: DotData, invert: boolean): ReadonlyArray<readonly [number, number, number]> {
  if (!invert || data.kind === 'palette') {
    return data.dots.map((dot) => [dot[0], dot[1], data.kind === 'palette' ? (dot as PaletteDot)[2] : 0])
  }

  const occupied = new Set<number>()
  data.dots.forEach(([col, row]) => occupied.add(row * data.width + col))
  const complement: Array<readonly [number, number, number]> = []
  for (let row = 0; row < data.height; row++) {
    for (let col = 0; col < data.width; col++) {
      if (isInsideRoundedRectCell(col, row, data.width, data.height, data.cornerRadius) &&
          !occupied.has(row * data.width + col)) {
        complement.push([col, row, 0])
      }
    }
  }
  return complement
}

export function dotDataToLayout(
  data: DotData,
  canvasW: number,
  canvasH: number,
  config: LayoutConfig,
): DotLayout {
  const dots = layoutDots(data, config.invert)
  const cellSize = Math.max(
    0.5,
    (Math.min(canvasW, canvasH) * Math.max(0.05, Math.min(1, config.scale))) /
      Math.max(data.width, data.height),
  )
  const offsetX = (canvasW - data.width * cellSize) / 2
  const offsetY = (canvasH - data.height * cellSize) / 2
  const x = new Float32Array(dots.length)
  const y = new Float32Array(dots.length)
  const size = new Float32Array(dots.length)
  const paletteIndex = new Uint8Array(dots.length)

  dots.forEach(([col, row, color], index) => {
    x[index] = offsetX + col * cellSize
    y[index] = offsetY + row * cellSize
    size[index] = cellSize * Math.max(0.05, config.dotScale)
    paletteIndex[index] = color
  })

  return {
    x,
    y,
    size,
    paletteIndex,
    palette: data.kind === 'palette' ? data.palette : ['#e8e7e2'],
    count: dots.length,
  }
}
