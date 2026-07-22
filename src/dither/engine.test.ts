import { describe, expect, it } from 'vitest'
import { ditherImage } from './engine'
import { DEFAULT_DITHER_CONFIG, type DitherConfig, type PixelBuffer } from './types'

function grayscale(width: number, height: number, values: number[]): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4)
  values.forEach((value, index) => {
    data[index * 4] = value
    data[index * 4 + 1] = value
    data[index * 4 + 2] = value
    data[index * 4 + 3] = 255
  })
  return { width, height, data }
}

function config(overrides: Partial<DitherConfig> = {}): DitherConfig {
  return { ...DEFAULT_DITHER_CONFIG, scale: 1, errorStrength: 0, ...overrides }
}

describe('ditherImage', () => {
  it('thresholds luminance into dark-pixel dots', () => {
    const result = ditherImage(grayscale(3, 1, [0, 127, 255]), config())
    expect(result).toMatchObject({ kind: 'bw', width: 3, height: 1 })
    expect(result.dots).toEqual([[0, 0], [1, 0]])
  })

  it('inverts the source before thresholding', () => {
    const result = ditherImage(grayscale(2, 1, [0, 255]), config({ invert: true }))
    expect(result.dots).toEqual([[1, 0]])
  })

  it('downscales to the configured grid', () => {
    const result = ditherImage(grayscale(4, 2, new Array(8).fill(0)), config({ scale: 0.5 }))
    expect(result).toMatchObject({ width: 2, height: 1 })
  })

  it('diffuses quantization error using the selected kernel', () => {
    const source = grayscale(4, 1, [100, 100, 100, 100])
    const withoutDiffusion = ditherImage(source, config({ errorStrength: 0 }))
    const withDiffusion = ditherImage(source, config({ errorStrength: 1 }))
    expect(withoutDiffusion.dots).toHaveLength(4)
    expect(withDiffusion.dots.length).toBeLessThan(4)
  })

  it('masks output to a rounded rectangle', () => {
    const result = ditherImage(
      grayscale(5, 5, new Array(25).fill(0)),
      config({ cornerRadius: 0.4 }),
    )
    expect(result.cornerRadius).toBe(2)
    expect(result.dots).not.toContainEqual([0, 0])
    expect(result.dots).toContainEqual([2, 2])
  })

  it('returns palette indices and can omit the lightest background color', () => {
    const result = ditherImage(
      {
        width: 3,
        height: 1,
        data: new Uint8ClampedArray([
          0, 0, 0, 255,
          255, 0, 0, 255,
          255, 255, 255, 255,
        ]),
      },
      config({
        contrast: 0,
        palette: {
          kind: 'palette',
          colors: ['#000000', '#ff0000', '#ffffff'],
          colorSpace: 'rgb',
          omitBackground: true,
        },
      }),
    )
    expect(result.kind).toBe('palette')
    if (result.kind !== 'palette') throw new Error('Expected palette result')
    expect(result.palette).toEqual(['#000000', '#ff0000', '#ffffff'])
    expect(result.dots).toEqual([[0, 0, 0], [1, 0, 1]])
  })

  it('supports OKLab palette matching', () => {
    const result = ditherImage(
      {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([250, 30, 20, 255]),
      },
      config({
        palette: {
          kind: 'palette',
          colors: ['#ff0000', '#0000ff'],
          colorSpace: 'oklab',
          omitBackground: false,
        },
      }),
    )
    expect(result.dots).toEqual([[0, 0, 0]])
  })
})
