import type { PixelBuffer } from '../dither/types'

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp',
])

const SUPPORTED_IMAGE_EXTENSIONS = /\.(?:gif|jpe?g|png|svg|webp)$/i

/** File-picker filter for every source format the Studio can rasterize. */
export const IMAGE_UPLOAD_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg'

/** Check a browser File before attempting to decode it as an image source. */
export function isSupportedImageFile(file: File): boolean {
  return SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase()) || SUPPORTED_IMAGE_EXTENSIONS.test(file.name)
}

/** Expected failure when importing an image selected by the user. */
export type ImageUploadError =
  | { readonly _tag: 'UnsupportedImageType' }
  | { readonly _tag: 'ImageDecodeFailed' }
  | { readonly _tag: 'CanvasUnavailable' }

/** Result of rasterizing an uploaded image into source pixels. */
export type ImageUploadResult =
  | { readonly ok: true; readonly value: PixelBuffer }
  | { readonly ok: false; readonly error: ImageUploadError }

/** Decode and rasterize a supported browser image, capped to 1200px on its longest edge. */
export async function readImageFile(file: File): Promise<ImageUploadResult> {
  if (!isSupportedImageFile(file)) {
    return { ok: false, error: { _tag: 'UnsupportedImageType' } }
  }

  let url: string | null = null
  try {
    url = URL.createObjectURL(file)
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    if (image.naturalWidth < 1 || image.naturalHeight < 1) {
      return { ok: false, error: { _tag: 'ImageDecodeFailed' } }
    }

    const maxDimension = 1200
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return { ok: false, error: { _tag: 'CanvasUnavailable' } }
    context.drawImage(image, 0, 0, width, height)
    const imageData = context.getImageData(0, 0, width, height)
    return {
      ok: true,
      value: { width, height, data: new Uint8ClampedArray(imageData.data) },
    }
  } catch {
    return { ok: false, error: { _tag: 'ImageDecodeFailed' } }
  } finally {
    if (url !== null) URL.revokeObjectURL(url)
  }
}
