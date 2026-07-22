import { DIFFUSION_KERNELS } from './kernels'
import { isInsideRoundedRectCell } from './mask'
import { lightestColorIndex, normalizePalette, rgbToOklab, rgbToOklabInto } from './palette'
import { applyTone, boxBlur, resampleRgb, rgbToLuminance } from './tone'
import type { BwDot, DitherConfig, DotData, PaletteDot, PixelBuffer } from './types'

const clampByte = (value: number) => Math.max(0, Math.min(255, value))

function dimensions(source: PixelBuffer, scale: number): readonly [number, number] {
  const safeScale = Math.max(0.05, Math.min(1, scale))
  return [
    Math.max(1, Math.round(source.width * safeScale)),
    Math.max(1, Math.round(source.height * safeScale)),
  ]
}

interface KernelSteps {
  readonly count: number
  readonly weight: Float64Array
  readonly stepX: Int32Array
  readonly stepY: Int32Array
}

/** Flatten the kernel with error strength pre-applied, so the per-pixel loop avoids destructuring. */
function kernelSteps(config: DitherConfig): KernelSteps {
  const kernel = DIFFUSION_KERNELS[config.algorithm]
  const weight = new Float64Array(kernel.length)
  const stepX = new Int32Array(kernel.length)
  const stepY = new Int32Array(kernel.length)
  kernel.forEach(([kernelWeight, dx, dy], index) => {
    weight[index] = kernelWeight * config.errorStrength
    stepX[index] = dx
    stepY[index] = dy
  })
  return { count: kernel.length, weight, stepX, stepY }
}

function ditherBw(
  values: Float64Array,
  width: number,
  height: number,
  radius: number,
  config: DitherConfig,
): DotData {
  const errors = new Float64Array(width * height)
  const dots: BwDot[] = []
  const threshold = clampByte(config.luminanceThreshold)
  const { count, weight, stepX, stepY } = kernelSteps(config)

  for (let y = 0; y < height; y++) {
    const forward = !config.serpentine || y % 2 === 0
    const start = forward ? 0 : width - 1
    const end = forward ? width : -1
    const step = forward ? 1 : -1
    for (let x = start; x !== end; x += step) {
      const index = y * width + x
      const raw = values[index] + errors[index]
      const quantized = raw < threshold ? 0 : 255
      if (quantized === 0 && isInsideRoundedRectCell(x, y, width, height, radius)) dots.push([x, y])
      const error = raw - quantized
      for (let entry = 0; entry < count; entry++) {
        const nextX = x + step * stepX[entry]
        const nextY = y + stepY[entry]
        if (nextX < 0 || nextX >= width || nextY >= height) continue
        errors[nextY * width + nextX] += error * weight[entry]
      }
    }
  }

  return { kind: 'bw', width, height, cornerRadius: radius, dots }
}

function ditherPalette(
  values: Float64Array,
  width: number,
  height: number,
  radius: number,
  config: DitherConfig,
): DotData {
  if (config.palette.kind !== 'palette') throw new Error('Expected palette configuration')
  const palette = normalizePalette(config.palette.colors)
  const background = config.palette.omitBackground ? lightestColorIndex(palette.rgb) : -1
  const useOklab = config.palette.colorSpace === 'oklab'
  const paletteSize = palette.rgb.length

  // Palette targets in the matching color space, flattened for the nearest-color search.
  const target = new Float64Array(paletteSize * 3)
  palette.rgb.forEach((rgb, index) => {
    const [c0, c1, c2] = useOklab ? rgbToOklab(rgb) : rgb
    target[index * 3] = c0
    target[index * 3 + 1] = c1
    target[index * 3 + 2] = c2
  })

  const pixelCount = width * height
  const error0 = new Float64Array(pixelCount)
  const error1 = new Float64Array(pixelCount)
  const error2 = new Float64Array(pixelCount)
  const { count, weight, stepX, stepY } = kernelSteps(config)
  const lab = new Float64Array(3)
  const dots: PaletteDot[] = []

  for (let y = 0; y < height; y++) {
    const forward = !config.serpentine || y % 2 === 0
    const start = forward ? 0 : width - 1
    const end = forward ? width : -1
    const step = forward ? 1 : -1
    for (let x = start; x !== end; x += step) {
      const index = y * width + x
      const offset = index * 3
      let raw0: number
      let raw1: number
      let raw2: number
      let match0: number
      let match1: number
      let match2: number

      if (useOklab) {
        rgbToOklabInto(
          clampByte(values[offset]),
          clampByte(values[offset + 1]),
          clampByte(values[offset + 2]),
          lab,
        )
        raw0 = lab[0] + error0[index]
        raw1 = lab[1] + error1[index]
        raw2 = lab[2] + error2[index]
        match0 = raw0
        match1 = raw1
        match2 = raw2
      } else {
        raw0 = values[offset] + error0[index]
        raw1 = values[offset + 1] + error1[index]
        raw2 = values[offset + 2] + error2[index]
        match0 = clampByte(raw0)
        match1 = clampByte(raw1)
        match2 = clampByte(raw2)
      }

      let selected = 0
      let best = Number.POSITIVE_INFINITY
      for (let candidate = 0; candidate < paletteSize; candidate++) {
        const d0 = match0 - target[candidate * 3]
        const d1 = match1 - target[candidate * 3 + 1]
        const d2 = match2 - target[candidate * 3 + 2]
        const distance = useOklab
          ? d0 * d0 + d1 * d1 + d2 * d2
          : 0.2126 * d0 * d0 + 0.7152 * d1 * d1 + 0.0722 * d2 * d2
        if (distance < best) {
          best = distance
          selected = candidate
        }
      }

      const quantError0 = raw0 - target[selected * 3]
      const quantError1 = raw1 - target[selected * 3 + 1]
      const quantError2 = raw2 - target[selected * 3 + 2]

      if (selected !== background && isInsideRoundedRectCell(x, y, width, height, radius)) {
        dots.push([x, y, selected])
      }

      for (let entry = 0; entry < count; entry++) {
        const nextX = x + step * stepX[entry]
        const nextY = y + stepY[entry]
        if (nextX < 0 || nextX >= width || nextY >= height) continue
        const nextIndex = nextY * width + nextX
        const entryWeight = weight[entry]
        error0[nextIndex] += quantError0 * entryWeight
        error1[nextIndex] += quantError1 * entryWeight
        error2[nextIndex] += quantError2 * entryWeight
      }
    }
  }

  return { kind: 'palette', width, height, cornerRadius: radius, palette: palette.hex, dots }
}

/** Convert an RGBA pixel buffer into compact, exportable dot coordinates. */
export function ditherImage(source: PixelBuffer, config: DitherConfig): DotData {
  const [width, height] = dimensions(source, config.scale)
  const pixelCount = width * height
  const radius = Math.round(Math.max(0, Math.min(0.5, config.cornerRadius)) * Math.min(width, height))
  const rgb = resampleRgb(source, width, height)
  const toneSettings = {
    contrast: config.contrast,
    gamma: config.gamma,
    highlights: config.highlights,
    invert: config.invert,
  }

  if (config.palette.kind === 'bw') {
    const luminance = rgbToLuminance(rgb, pixelCount)
    const blurred = boxBlur(luminance, width, height, config.blurRadius, 1)
    return ditherBw(applyTone(blurred, toneSettings), width, height, radius, config)
  }

  const blurred = boxBlur(rgb, width, height, config.blurRadius, 3)
  return ditherPalette(applyTone(blurred, toneSettings), width, height, radius, config)
}
