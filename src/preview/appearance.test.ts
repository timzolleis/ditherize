import { describe, expect, it } from 'vitest'
import { resolvePreviewColors } from './appearance'

describe('preview appearance', () => {
  it('uses mode foreground colors while allowing a custom background', () => {
    expect(resolvePreviewColors({ mode: 'dark', backgroundColor: null })).toEqual({
      background: '#151513',
      foreground: '#eeede7',
    })
    expect(resolvePreviewColors({ mode: 'light', backgroundColor: '#ffcc00' })).toEqual({
      background: '#ffcc00',
      foreground: '#1a1a18',
    })
  })
})
