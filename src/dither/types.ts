export interface PixelBuffer {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray
}

export type KernelName =
  | 'FloydSteinberg'
  | 'Atkinson'
  | 'JarvisJudiceNinke'
  | 'Stucki'
  | 'Burkes'
  | 'Sierra3'
  | 'Sierra2'
  | 'Sierra24A'
  | 'Fan'
  | 'ShiauFan'
  | 'ShiauFan2'

export type PaletteMode =
  | { readonly kind: 'bw' }
  | {
      readonly kind: 'palette'
      readonly colors: readonly string[]
      readonly colorSpace: 'rgb' | 'oklab'
      readonly omitBackground: boolean
    }

export interface DitherConfig {
  readonly algorithm: KernelName
  readonly luminanceThreshold: number
  readonly invert: boolean
  readonly scale: number
  readonly contrast: number
  readonly gamma: number
  readonly highlights: number
  readonly blurRadius: number
  readonly errorStrength: number
  readonly serpentine: boolean
  /** Fraction of the shortest grid edge, from 0 to 0.5. */
  readonly cornerRadius: number
  readonly palette: PaletteMode
}

export type BwDot = readonly [col: number, row: number]
export type PaletteDot = readonly [col: number, row: number, paletteIndex: number]

export type DotData =
  | {
      readonly kind: 'bw'
      readonly width: number
      readonly height: number
      readonly cornerRadius: number
      readonly dots: ReadonlyArray<BwDot>
    }
  | {
      readonly kind: 'palette'
      readonly width: number
      readonly height: number
      readonly cornerRadius: number
      readonly palette: readonly string[]
      readonly dots: ReadonlyArray<PaletteDot>
    }

export const DEFAULT_DITHER_CONFIG: DitherConfig = {
  algorithm: 'FloydSteinberg',
  luminanceThreshold: 128,
  invert: false,
  scale: 0.34,
  contrast: 12,
  gamma: 1,
  highlights: 0,
  blurRadius: 0,
  errorStrength: 1,
  serpentine: true,
  cornerRadius: 0.18,
  palette: { kind: 'bw' },
}
