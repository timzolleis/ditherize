import { describe, expect, it } from 'vitest'
import { dotDataToLayout } from './layout'
import type { DotData } from '../dither/types'

const fixture: DotData = {
  kind: 'bw', width: 2, height: 2, cornerRadius: 0, dots: [[0, 0]],
}

describe('dotDataToLayout', () => {
  it('centers grid coordinates in the canvas', () => {
    const layout = dotDataToLayout(fixture, 400, 300, {
      scale: 0.5, dotScale: 1, invert: false, foregroundColor: '#eeede7',
    })
    expect(layout.count).toBe(1)
    expect(layout.x[0]).toBe(125)
    expect(layout.y[0]).toBe(75)
    expect(layout.size[0]).toBe(75)
  })

  it('uses the selected preview foreground for monochrome dots', () => {
    const layout = dotDataToLayout(fixture, 100, 100, {
      scale: 1, dotScale: 1, invert: false, foregroundColor: '#1a1a18',
    })
    expect(layout.palette).toEqual(['#1a1a18'])
  })

  it('builds the rounded-rectangle complement in invert mode', () => {
    const layout = dotDataToLayout(fixture, 100, 100, {
      scale: 1, dotScale: 1, invert: true, foregroundColor: '#eeede7',
    })
    expect(layout.count).toBe(3)
  })

  it('preserves palette indices and colors', () => {
    const data: DotData = {
      kind: 'palette', width: 1, height: 1, cornerRadius: 0,
      palette: ['#123456'], dots: [[0, 0, 0]],
    }
    const layout = dotDataToLayout(data, 100, 100, {
      scale: 1, dotScale: 0.5, invert: false, foregroundColor: '#eeede7',
    })
    expect(layout.palette).toEqual(['#123456'])
    expect(layout.paletteIndex[0]).toBe(0)
    expect(layout.size[0]).toBe(50)
  })
})
