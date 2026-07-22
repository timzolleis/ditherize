import type { PixelBuffer } from './types'

export type Rgb = readonly [r: number, g: number, b: number]

const clampByte = (value: number) => Math.max(0, Math.min(255, value))

export function resampleRgb(source: PixelBuffer, width: number, height: number): Float64Array {
  if (source.width < 1 || source.height < 1 || source.data.length < source.width * source.height * 4) {
    throw new Error('Invalid PixelBuffer')
  }

  const result = new Float64Array(width * height * 3)
  for (let y = 0; y < height; y++) {
    const sourceY = Math.min(source.height - 1, Math.floor(((y + 0.5) * source.height) / height))
    for (let x = 0; x < width; x++) {
      const sourceX = Math.min(source.width - 1, Math.floor(((x + 0.5) * source.width) / width))
      const sourceIndex = (sourceY * source.width + sourceX) * 4
      const targetIndex = (y * width + x) * 3
      const alpha = source.data[sourceIndex + 3] / 255
      result[targetIndex] = source.data[sourceIndex] * alpha + 255 * (1 - alpha)
      result[targetIndex + 1] = source.data[sourceIndex + 1] * alpha + 255 * (1 - alpha)
      result[targetIndex + 2] = source.data[sourceIndex + 2] * alpha + 255 * (1 - alpha)
    }
  }
  return result
}

export function rgbToLuminance(rgb: ArrayLike<number>, pixelCount: number): Float64Array {
  const result = new Float64Array(pixelCount)
  for (let index = 0; index < pixelCount; index++) {
    const offset = index * 3
    result[index] = 0.2126 * rgb[offset] + 0.7152 * rgb[offset + 1] + 0.0722 * rgb[offset + 2]
  }
  return result
}

/** Box blur for an interleaved channel buffer. Sliding-window sums keep it O(1) per pixel. */
export function boxBlur(
  values: Float64Array,
  width: number,
  height: number,
  radius: number,
  channels: number,
): Float64Array {
  const r = Math.max(0, Math.round(radius))
  if (r === 0) return values.slice()

  const horizontal = new Float64Array(values.length)
  const output = new Float64Array(values.length)

  for (let y = 0; y < height; y++) {
    for (let channel = 0; channel < channels; channel++) {
      const rowOffset = y * width * channels + channel
      let sum = 0
      const initialRight = Math.min(width - 1, r)
      for (let x = 0; x <= initialRight; x++) sum += values[rowOffset + x * channels]
      let count = initialRight + 1
      for (let x = 0; x < width; x++) {
        horizontal[rowOffset + x * channels] = sum / count
        const entering = x + r + 1
        if (entering < width) {
          sum += values[rowOffset + entering * channels]
          count++
        }
        const leaving = x - r
        if (leaving >= 0) {
          sum -= values[rowOffset + leaving * channels]
          count--
        }
      }
    }
  }

  const stride = width * channels
  for (let x = 0; x < width; x++) {
    for (let channel = 0; channel < channels; channel++) {
      const columnOffset = x * channels + channel
      let sum = 0
      const initialBottom = Math.min(height - 1, r)
      for (let y = 0; y <= initialBottom; y++) sum += horizontal[columnOffset + y * stride]
      let count = initialBottom + 1
      for (let y = 0; y < height; y++) {
        output[columnOffset + y * stride] = sum / count
        const entering = y + r + 1
        if (entering < height) {
          sum += horizontal[columnOffset + entering * stride]
          count++
        }
        const leaving = y - r
        if (leaving >= 0) {
          sum -= horizontal[columnOffset + leaving * stride]
          count--
        }
      }
    }
  }

  return output
}

export interface ToneSettings {
  readonly contrast: number
  readonly gamma: number
  readonly highlights: number
  readonly invert: boolean
}

interface ToneCurve {
  readonly contrastFactor: number
  readonly gammaExponent: number
  readonly compression: number
  readonly invert: boolean
}

function toneCurve(settings: ToneSettings): ToneCurve {
  const contrast = Math.max(-100, Math.min(100, settings.contrast))
  return {
    contrastFactor: (259 * (contrast + 255)) / (255 * (259 - contrast)),
    gammaExponent: 1 / Math.max(0.2, Math.min(3, settings.gamma)),
    compression: Math.max(0, Math.min(100, settings.highlights)) / 100,
    invert: settings.invert,
  }
}

function applyCurve(value: number, curve: ToneCurve): number {
  let result = clampByte(curve.contrastFactor * (value - 128) + 128)
  result = 255 * Math.pow(result / 255, curve.gammaExponent)
  // Pull only the brightest values toward the midtones, preserving shadows.
  result -= 64 * curve.compression * Math.pow(result / 255, 3)
  if (curve.invert) result = 255 - result
  return clampByte(result)
}

export function toneValue(value: number, settings: ToneSettings): number {
  return applyCurve(value, toneCurve(settings))
}

export function applyTone(values: Float64Array, settings: ToneSettings): Float64Array {
  const curve = toneCurve(settings)
  const output = new Float64Array(values.length)
  for (let index = 0; index < values.length; index++) {
    output[index] = applyCurve(values[index], curve)
  }
  return output
}
