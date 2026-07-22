import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_ANIM_CONFIG } from '../animate/useDotAnimation'
import { DEFAULT_DITHER_CONFIG } from '../dither/types'
import {
  DITHER_CONFIG_KEY,
  loadAnimConfig,
  loadDitherConfig,
  loadPreviewAppearance,
  saveAnimConfig,
  saveDitherConfig,
  savePreviewAppearance,
} from './sessionStore'

const values = new Map<string, string>()
const storage = {
  getItem: vi.fn((key: string) => values.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => values.set(key, value)),
}

beforeEach(() => {
  values.clear()
  vi.stubGlobal('localStorage', storage)
})

describe('dither session settings', () => {
  it('round-trips a valid configuration', () => {
    const config = { ...DEFAULT_DITHER_CONFIG, contrast: 42, scale: 0.2 }
    saveDitherConfig(config)
    expect(loadDitherConfig()).toEqual(config)
  })

  it('falls back safely when persisted settings are corrupt', () => {
    values.set(DITHER_CONFIG_KEY, '{broken')
    expect(loadDitherConfig()).toEqual(DEFAULT_DITHER_CONFIG)
  })

  it('merges older partial settings with current defaults', () => {
    values.set(DITHER_CONFIG_KEY, JSON.stringify({ contrast: -20 }))
    expect(loadDitherConfig()).toEqual({ ...DEFAULT_DITHER_CONFIG, contrast: -20 })
  })

  it('persists animation controls too', () => {
    const config = { ...DEFAULT_ANIM_CONFIG, mouseStrength: 75, invert: false }
    saveAnimConfig(config)
    expect(loadAnimConfig()).toEqual(config)
  })

  it('persists the shared preview appearance', () => {
    const appearance = { mode: 'light' as const, backgroundColor: '#ffcc00' }
    savePreviewAppearance(appearance)
    expect(loadPreviewAppearance()).toEqual(appearance)
  })
})
