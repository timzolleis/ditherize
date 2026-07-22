import { hexToRgb, lightestColorIndex } from './palette'
import type { DotData } from './types'

const BW_BACKGROUND = '#151513'
const BW_FOREGROUND = '#eeede7'
const DOT_RATIO = 0.8
const formatNumber = (value: number) => String(Number(value.toFixed(6)))

export function toJson(data: DotData): string {
  return JSON.stringify(data, null, 2)
}

export function toJsCode(data: DotData): string {
  return `export const DITHERED_DOTS = ${toJson(data)} as const\n`
}

function paletteBackground(data: Extract<DotData, { kind: 'palette' }>): string {
  const colors = data.palette.map(hexToRgb).filter((color) => color !== null)
  if (colors.length !== data.palette.length) return data.palette[0] ?? '#ffffff'
  return data.palette[lightestColorIndex(colors)] ?? '#ffffff'
}

/** Export a resolution-independent dot image with crisp rectangular dots. */
export function toSvg(data: DotData, cellSize = 4): string {
  const cell = Math.max(1, cellSize)
  const width = data.width * cell
  const height = data.height * cell
  const dotSize = cell * DOT_RATIO
  const inset = (cell - dotSize) / 2
  const elements: string[] = []

  if (data.kind === 'bw') {
    elements.push(`<rect width="${formatNumber(width)}" height="${formatNumber(height)}" fill="${BW_BACKGROUND}"/>`)
    for (const [col, row] of data.dots) {
      elements.push(`<rect x="${formatNumber(col * cell + inset)}" y="${formatNumber(row * cell + inset)}" width="${formatNumber(dotSize)}" height="${formatNumber(dotSize)}" fill="${BW_FOREGROUND}"/>`)
    }
  } else {
    elements.push(`<rect width="${formatNumber(width)}" height="${formatNumber(height)}" rx="${formatNumber(data.cornerRadius * cell)}" fill="${paletteBackground(data)}"/>`)
    for (const [col, row, colorIndex] of data.dots) {
      elements.push(`<rect x="${formatNumber(col * cell + inset)}" y="${formatNumber(row * cell + inset)}" width="${formatNumber(dotSize)}" height="${formatNumber(dotSize)}" fill="${data.palette[colorIndex] ?? data.palette[0]}"/>`)
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(width)}" height="${formatNumber(height)}" viewBox="0 0 ${formatNumber(width)} ${formatNumber(height)}" shape-rendering="crispEdges">${elements.join('')}</svg>\n`
}

function drawExportCanvas(canvas: HTMLCanvasElement, data: DotData, cell: number): void {
  canvas.width = data.width * cell
  canvas.height = data.height * cell
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')
  const dotSize = cell * DOT_RATIO
  const inset = (cell - dotSize) / 2

  context.clearRect(0, 0, canvas.width, canvas.height)
  if (data.kind === 'bw') {
    context.fillStyle = BW_BACKGROUND
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = BW_FOREGROUND
    for (const [col, row] of data.dots) {
      context.fillRect(col * cell + inset, row * cell + inset, dotSize, dotSize)
    }
    return
  }

  context.fillStyle = paletteBackground(data)
  context.beginPath()
  context.roundRect(0, 0, canvas.width, canvas.height, data.cornerRadius * cell)
  context.fill()
  // One pass over the dots: group by color first so fill style changes once per color.
  const byColor: Array<Array<readonly [number, number]>> = data.palette.map(() => [])
  for (const [col, row, dotColorIndex] of data.dots) byColor[dotColorIndex]?.push([col, row])
  byColor.forEach((positions, colorIndex) => {
    if (positions.length === 0) return
    context.fillStyle = data.palette[colorIndex]
    for (const [col, row] of positions) {
      context.fillRect(col * cell + inset, row * cell + inset, dotSize, dotSize)
    }
  })
}

/** Render a high-resolution PNG, capped to roughly 1600px on its longest edge. */
export function toPngBlob(data: DotData): Promise<Blob> {
  const cellSize = Math.max(2, Math.min(12, Math.floor(1600 / Math.max(data.width, data.height))))
  const canvas = document.createElement('canvas')
  drawExportCanvas(canvas, data, cellSize)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png')
  })
}
