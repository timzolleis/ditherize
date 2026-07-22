import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DOT_STORE_KEY, loadDotData, saveDotData } from './dotStore'
import type { DotData } from '../dither/types'

const values = new Map<string, string>()
const storage = {
  getItem: vi.fn((key: string) => values.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => values.set(key, value)),
}

beforeEach(() => {
  values.clear()
  vi.stubGlobal('localStorage', storage)
})

describe('dot store', () => {
  const fixture: DotData = {
    kind: 'bw', width: 2, height: 2, cornerRadius: 0, dots: [[1, 1]],
  }

  it('round-trips dot data', () => {
    saveDotData(fixture)
    expect(loadDotData()).toEqual(fixture)
  })

  it('returns null for corrupt or invalid data', () => {
    values.set(DOT_STORE_KEY, '{bad json')
    expect(loadDotData()).toBeNull()
    values.set(DOT_STORE_KEY, JSON.stringify({ kind: 'bw', dots: 'wrong' }))
    expect(loadDotData()).toBeNull()
  })
})
