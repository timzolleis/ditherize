import { DEFAULT_ANIM_CONFIG, type AnimConfig } from '../animate/useDotAnimation'
import { KERNEL_NAMES } from '../dither/kernels'
import { DEFAULT_DITHER_CONFIG, type DitherConfig, type PaletteMode, type PixelBuffer } from '../dither/types'

export const DITHER_CONFIG_KEY = 'dither-studio:config:v1'
export const ANIM_CONFIG_KEY = 'dither-studio:animation:v1'
const DATABASE_NAME = 'dither-studio'
const DATABASE_VERSION = 1
const SESSION_STORE = 'session'
const SOURCE_KEY = 'uploaded-source'

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function parsePalette(value: unknown): PaletteMode {
  if (typeof value !== 'object' || value === null) return DEFAULT_DITHER_CONFIG.palette
  const candidate = value as Record<string, unknown>
  if (candidate.kind === 'bw') return { kind: 'bw' }
  if (
    candidate.kind === 'palette' &&
    Array.isArray(candidate.colors) &&
    candidate.colors.length >= 2 &&
    candidate.colors.every((color) => typeof color === 'string') &&
    (candidate.colorSpace === 'rgb' || candidate.colorSpace === 'oklab') &&
    typeof candidate.omitBackground === 'boolean'
  ) {
    return {
      kind: 'palette',
      colors: candidate.colors,
      colorSpace: candidate.colorSpace,
      omitBackground: candidate.omitBackground,
    }
  }
  return DEFAULT_DITHER_CONFIG.palette
}

export function loadDitherConfig(): DitherConfig {
  try {
    const raw = localStorage.getItem(DITHER_CONFIG_KEY)
    if (!raw) return DEFAULT_DITHER_CONFIG
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_DITHER_CONFIG
    const value = parsed as Record<string, unknown>
    return {
      algorithm: typeof value.algorithm === 'string' && KERNEL_NAMES.includes(value.algorithm as DitherConfig['algorithm'])
        ? value.algorithm as DitherConfig['algorithm']
        : DEFAULT_DITHER_CONFIG.algorithm,
      luminanceThreshold: isNumber(value.luminanceThreshold) ? value.luminanceThreshold : DEFAULT_DITHER_CONFIG.luminanceThreshold,
      invert: typeof value.invert === 'boolean' ? value.invert : DEFAULT_DITHER_CONFIG.invert,
      scale: isNumber(value.scale) ? value.scale : DEFAULT_DITHER_CONFIG.scale,
      contrast: isNumber(value.contrast) ? value.contrast : DEFAULT_DITHER_CONFIG.contrast,
      gamma: isNumber(value.gamma) ? value.gamma : DEFAULT_DITHER_CONFIG.gamma,
      highlights: isNumber(value.highlights) ? value.highlights : DEFAULT_DITHER_CONFIG.highlights,
      blurRadius: isNumber(value.blurRadius) ? value.blurRadius : DEFAULT_DITHER_CONFIG.blurRadius,
      errorStrength: isNumber(value.errorStrength) ? value.errorStrength : DEFAULT_DITHER_CONFIG.errorStrength,
      serpentine: typeof value.serpentine === 'boolean' ? value.serpentine : DEFAULT_DITHER_CONFIG.serpentine,
      cornerRadius: isNumber(value.cornerRadius) ? value.cornerRadius : DEFAULT_DITHER_CONFIG.cornerRadius,
      palette: value.palette === undefined ? DEFAULT_DITHER_CONFIG.palette : parsePalette(value.palette),
    }
  } catch {
    return DEFAULT_DITHER_CONFIG
  }
}

export function saveDitherConfig(config: DitherConfig): void {
  try {
    localStorage.setItem(DITHER_CONFIG_KEY, JSON.stringify(config))
  } catch {
    // Settings persistence is best-effort in constrained/private browsing contexts.
  }
}

export function loadAnimConfig(): AnimConfig {
  try {
    const raw = localStorage.getItem(ANIM_CONFIG_KEY)
    if (!raw) return DEFAULT_ANIM_CONFIG
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_ANIM_CONFIG
    const value = parsed as Record<string, unknown>
    return {
      mouseRadius: isNumber(value.mouseRadius) ? value.mouseRadius : DEFAULT_ANIM_CONFIG.mouseRadius,
      mouseStrength: isNumber(value.mouseStrength) ? value.mouseStrength : DEFAULT_ANIM_CONFIG.mouseStrength,
      falloffExponent: isNumber(value.falloffExponent) ? value.falloffExponent : DEFAULT_ANIM_CONFIG.falloffExponent,
      springBack: isNumber(value.springBack) ? value.springBack : DEFAULT_ANIM_CONFIG.springBack,
      shockwaveSpeed: isNumber(value.shockwaveSpeed) ? value.shockwaveSpeed : DEFAULT_ANIM_CONFIG.shockwaveSpeed,
      shockwaveWidth: isNumber(value.shockwaveWidth) ? value.shockwaveWidth : DEFAULT_ANIM_CONFIG.shockwaveWidth,
      shockwaveStrength: isNumber(value.shockwaveStrength) ? value.shockwaveStrength : DEFAULT_ANIM_CONFIG.shockwaveStrength,
      shockwaveDuration: isNumber(value.shockwaveDuration) ? value.shockwaveDuration : DEFAULT_ANIM_CONFIG.shockwaveDuration,
      dotScale: isNumber(value.dotScale) ? value.dotScale : DEFAULT_ANIM_CONFIG.dotScale,
      invert: typeof value.invert === 'boolean' ? value.invert : DEFAULT_ANIM_CONFIG.invert,
    }
  } catch {
    return DEFAULT_ANIM_CONFIG
  }
}

export function saveAnimConfig(config: AnimConfig): void {
  try {
    localStorage.setItem(ANIM_CONFIG_KEY, JSON.stringify(config))
  } catch {
    // Best-effort, like the dither settings above.
  }
}

export interface PersistedSource extends PixelBuffer {
  readonly name: string
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SESSION_STORE)) {
        request.result.createObjectStore(SESSION_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

export async function savePersistedSource(source: PixelBuffer, name: string): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false
  try {
    const database = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(SESSION_STORE, 'readwrite')
      transaction.objectStore(SESSION_STORE).put({
        name,
        width: source.width,
        height: source.height,
        data: source.data,
      } satisfies PersistedSource, SOURCE_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    database.close()
    return true
  } catch {
    return false
  }
}

export async function loadPersistedSource(): Promise<PersistedSource | null> {
  if (typeof indexedDB === 'undefined') return null
  try {
    const database = await openDatabase()
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = database.transaction(SESSION_STORE, 'readonly').objectStore(SESSION_STORE).get(SOURCE_KEY)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    database.close()
    if (typeof value !== 'object' || value === null) return null
    const source = value as Record<string, unknown>
    if (
      typeof source.name !== 'string' ||
      !Number.isInteger(source.width) || (source.width as number) < 1 ||
      !Number.isInteger(source.height) || (source.height as number) < 1 ||
      !(source.data instanceof Uint8ClampedArray) ||
      source.data.length !== (source.width as number) * (source.height as number) * 4
    ) return null
    return source as unknown as PersistedSource
  } catch {
    return null
  }
}
