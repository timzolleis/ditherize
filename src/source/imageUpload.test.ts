import { describe, expect, it } from 'vitest'
import { IMAGE_UPLOAD_ACCEPT, isSupportedImageFile, readImageFile } from './imageUpload'

describe('image upload', () => {
  it('accepts SVG image files', () => {
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'artwork.svg', {
      type: 'image/svg+xml',
    })

    expect(isSupportedImageFile(svg)).toBe(true)
    expect(IMAGE_UPLOAD_ACCEPT).toContain('image/svg+xml')
  })

  it('rejects unsupported files before browser decoding', async () => {
    const text = new File(['not an image'], 'notes.txt', { type: 'text/plain' })

    await expect(readImageFile(text)).resolves.toEqual({
      ok: false,
      error: { _tag: 'UnsupportedImageType' },
    })
  })
})
