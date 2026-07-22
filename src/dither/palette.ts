import type { Rgb } from './tone'

export interface PresetPalette {
  readonly name: string
  readonly value: string
  readonly colors: readonly string[]
}

export const PRESET_PALETTES: readonly PresetPalette[] = [
  { name: 'Black & White', value: 'blackwhite', colors: ['#ffffff', '#000000'] },
  { name: 'Red Monochrome', value: 'redmono', colors: ['#ffe3db', '#4f1403'] },
  { name: 'Green Monochrome', value: 'greenmono', colors: ['#eeffdb', '#1d3801'] },
  { name: 'Blue Monochrome', value: 'bluemono', colors: ['#dbf9ff', '#02474f'] },
  { name: 'Yellow Monochrome', value: 'yellowmono', colors: ['#fffedb', '#303001'] },
  { name: 'Red', value: 'red', colors: ['#ffffff', '#f46842', '#aa2f0d', '#000000'] },
  { name: 'Green', value: 'green', colors: ['#ffffff', '#c4f441', '#6da90c', '#000000'] },
  { name: 'Blue', value: 'blue', colors: ['#ffffff', '#41e2f4', '#0c9fa9', '#000000'] },
  { name: 'Yellow', value: 'yellow', colors: ['#ffffff', '#f4eb41', '#a9a40c', '#000000'] },
  { name: 'CMYK', value: 'cmyk', colors: ['#000000', '#ffff00', '#00ffff', '#ff00ff', '#ffffff'] },
  { name: 'RGBY', value: 'rgby', colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'] },
  { name: 'Game Boy DMG-01', value: 'gameboy', colors: ['#cadc9f', '#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
  { name: 'Purple & Green', value: 'purplegreen', colors: ['#76c066', '#ad2bbb'] },
  { name: 'Yellow & Red', value: 'yellowred', colors: ['#ffee2c', '#e20023'] },
  { name: 'Blue & Yellow', value: 'blueyellow', colors: ['#134e87', '#fff585'] },
  { name: 'Black White Red', value: 'bwr', colors: ['#ffffff', '#000000', '#ff0000'] },
]

export function hexToRgb(hex: string): Rgb | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!match) return null
  return [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16), Number.parseInt(match[3], 16)]
}

export function rgbToHex([r, g, b]: Rgb): string {
  const encode = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
  return `#${encode(r)}${encode(g)}${encode(b)}`
}

export type Oklab = readonly [l: number, a: number, b: number]

const srgbToLinear = (value: number): number => {
  const channel = value / 255
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
}

/** Allocation-free OKLab conversion for hot loops. Writes [l, a, b] into `out`. */
export function rgbToOklabInto(r8: number, g8: number, b8: number, out: Float64Array): void {
  if (r8 === 0 && g8 === 0 && b8 === 0) {
    out[0] = 0
    out[1] = 0
    out[2] = 0
    return
  }
  const r = srgbToLinear(r8)
  const g = srgbToLinear(g8)
  const b = srgbToLinear(b8)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  out[0] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  out[1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  out[2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
}

export function rgbToOklab([r8, g8, b8]: Rgb): Oklab {
  const out = new Float64Array(3)
  rgbToOklabInto(r8, g8, b8, out)
  return [out[0], out[1], out[2]]
}

export function normalizePalette(colors: readonly string[]): { hex: string[]; rgb: Rgb[] } {
  const entries = colors
    .map((color) => ({ parsed: hexToRgb(color), source: color }))
    .filter((entry): entry is { parsed: Rgb; source: string } => entry.parsed !== null)
  if (entries.length < 2) throw new Error('A palette needs at least two valid colors')
  return {
    hex: entries.map(({ parsed }) => rgbToHex(parsed)),
    rgb: entries.map(({ parsed }) => parsed),
  }
}

export function lightestColorIndex(colors: readonly Rgb[]): number {
  let selected = 0
  let selectedLuminance = -1
  colors.forEach(([r, g, b], index) => {
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if (luminance > selectedLuminance) {
      selected = index
      selectedLuminance = luminance
    }
  })
  return selected
}
