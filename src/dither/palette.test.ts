import { describe, expect, it } from 'vitest'
import { hexToRgb, rgbToHex, rgbToOklab } from './palette'

describe('palette helpers', () => {
  it('round-trips hex colors', () => {
    expect(hexToRgb('#12aBcF')).toEqual([18, 171, 207])
    expect(rgbToHex([18, 171, 207])).toBe('#12abcf')
  })

  it('rejects malformed hex colors', () => {
    expect(hexToRgb('nope')).toBeNull()
  })

  it('converts black and white to stable OKLab values', () => {
    expect(rgbToOklab([0, 0, 0])).toEqual([0, 0, 0])
    expect(rgbToOklab([255, 255, 255])[0]).toBeCloseTo(1, 4)
  })
})
