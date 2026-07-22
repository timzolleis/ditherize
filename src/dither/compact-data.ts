import type { BwDot, DotData, PaletteDot } from './types'

export type EncodedDitherData = `ds1:${string}`

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function writeValue(bytes: Uint8Array, offset: number, bits: number, value: number): void {
  for (let bit = 0; bit < bits; bit++) {
    if ((value & (1 << bit)) !== 0) bytes[(offset + bit) >> 3] |= 1 << ((offset + bit) & 7)
  }
}

function readValue(bytes: Uint8Array, offset: number, bits: number): number {
  let value = 0
  for (let bit = 0; bit < bits; bit++) {
    value |= ((bytes[(offset + bit) >> 3] >> ((offset + bit) & 7)) & 1) << bit
  }
  return value
}

/** Pack a dot grid into a versioned URL-safe string (one bit per cell in B/W mode). */
export function encodeDotData(data: DotData): EncodedDitherData {
  const paletteSize = data.kind === 'palette' ? data.palette.length : 0
  const bits = data.kind === 'bw' ? 1 : Math.max(1, Math.ceil(Math.log2(paletteSize + 1)))
  const bytes = new Uint8Array(Math.ceil(data.width * data.height * bits / 8))

  if (data.kind === 'bw') {
    for (const [col, row] of data.dots) writeValue(bytes, (row * data.width + col) * bits, bits, 1)
  } else {
    for (const [col, row, paletteIndex] of data.dots) {
      writeValue(bytes, (row * data.width + col) * bits, bits, paletteIndex + 1)
    }
  }

  const mode = data.kind === 'bw' ? 'b' : 'p'
  const palette = data.kind === 'palette' ? data.palette.map((color) => color.replace(/^#/, '').toLowerCase()).join(',') : ''
  return `ds1:${mode}:${data.width}:${data.height}:${data.cornerRadius}:${palette}:${toBase64Url(bytes)}`
}

export function decodeDotData(encoded: EncodedDitherData | string): DotData {
  const [version, mode, widthValue, heightValue, radiusValue, paletteValue, payload] = encoded.split(':')
  const width = Number(widthValue)
  const height = Number(heightValue)
  const cornerRadius = Number(radiusValue)
  if (
    version !== 'ds1' || (mode !== 'b' && mode !== 'p') ||
    !Number.isInteger(width) || width < 1 ||
    !Number.isInteger(height) || height < 1 ||
    !Number.isInteger(cornerRadius) || cornerRadius < 0 ||
    payload === undefined
  ) throw new Error('Invalid compact dither data')

  const palette = mode === 'p'
    ? (paletteValue ?? '').split(',').filter(Boolean).map((color) => `#${color}`)
    : []
  if (mode === 'p' && palette.length < 1) throw new Error('Compact palette is empty')
  const bits = mode === 'b' ? 1 : Math.max(1, Math.ceil(Math.log2(palette.length + 1)))
  const bytes = fromBase64Url(payload)
  if (bytes.length * 8 < width * height * bits) throw new Error('Compact dither payload is truncated')

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
