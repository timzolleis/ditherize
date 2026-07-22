import { describe, expect, it } from 'vitest'
import { toJsCode, toJson, toSvg } from './exporters'
import type { DotData } from './types'

const fixture: DotData = {
  kind: 'bw',
  width: 2,
  height: 2,
  cornerRadius: 0,
  dots: [[0, 1]],
}

describe('exporters', () => {
  it('exports parseable JSON', () => {
    expect(JSON.parse(toJson(fixture))).toEqual(fixture)
  })

  it('exports a typed JavaScript module snippet', () => {
    const code = toJsCode(fixture)
    expect(code).toContain('export const DITHERED_DOTS')
    expect(code).toContain('as const')
    expect(code).toContain('"dots"')
  })

  it('exports a crisp, standalone SVG image', () => {
    const svg = toSvg(fixture, 4)
    expect(svg).toContain('<svg')
    expect(svg).toContain('width="8"')
    expect(svg).toContain('shape-rendering="crispEdges"')
    expect(svg).toContain('<rect x="0.4" y="4.4"')
  })
})
