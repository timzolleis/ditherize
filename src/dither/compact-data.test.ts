import { describe, expect, it } from 'vitest'
import { decodeDotData, encodeDotData } from './compact-data'
import type { DotData } from './types'

describe('compact dot data', () => {
  it('round-trips a monochrome field', () => {
    const data: DotData = {
      kind: 'bw', width: 5, height: 3, cornerRadius: 1, dots: [[0, 0], [4, 2]],
    }
    const encoded = encodeDotData(data)
    expect(encoded).toMatch(/^ds1:b:5:3:1::/)
    expect(decodeDotData(encoded)).toEqual(data)
  })

  it('round-trips palette indices', () => {
    const data: DotData = {
      kind: 'palette', width: 2, height: 2, cornerRadius: 0,
      palette: ['#ffffff', '#ff0000', '#000000'],
      dots: [[0, 0, 2], [1, 1, 1]],
    }
    const encoded = encodeDotData(data)
    expect(encoded).toContain(':ffffff,ff0000,000000:')
    expect(decodeDotData(encoded)).toEqual(data)
  })

  it('is substantially smaller than tuple JSON for populated grids', () => {
    const data: DotData = {
      kind: 'bw', width: 32, height: 32, cornerRadius: 0,
      dots: Array.from({ length: 512 }, (_, index) => [index % 32, Math.floor(index / 32)] as const),
    }
    expect(encodeDotData(data).length).toBeLessThan(JSON.stringify(data).length / 5)
  })
})
