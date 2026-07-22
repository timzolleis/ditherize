import type { PixelBuffer } from './dither/types'

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)))

function roundedRectDistance(x: number, y: number, halfWidth: number, halfHeight: number, radius: number): number {
  const qx = Math.abs(x) - halfWidth + radius
  const qy = Math.abs(y) - halfHeight + radius
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
}

/** Programmatic starter artwork: a rounded tile with a softly lit radial sphere. */
export function makePlaceholder(size = 600): PixelBuffer {
  const data = new Uint8ClampedArray(size * size * 4)
  const center = size / 2
  const tileHalf = size * 0.37
  const tileRadius = size * 0.11
  const sphereX = size * 0.54
  const sphereY = size * 0.48
  const sphereRadius = size * 0.225

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4
      const tileDistance = roundedRectDistance(x - center, y - center, tileHalf, tileHalf, tileRadius)
      let value = 247

      if (tileDistance <= 0) {
        const tileShade = 220 - 18 * ((y - (center - tileHalf)) / (tileHalf * 2))
        value = tileShade

        const dx = x - sphereX
        const dy = y - sphereY
        const distance = Math.hypot(dx, dy)
        if (distance < sphereRadius) {
          const nx = dx / sphereRadius
          const ny = dy / sphereRadius
          const radial = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
          const light = Math.max(0, radial * 0.86 - nx * 0.35 - ny * 0.42)
          const rim = Math.pow(distance / sphereRadius, 4)
          value = 28 + light * 215 - rim * 25
        }

        // A subtle orbital shadow grounds the sphere without requiring an asset.
        const shadowX = (x - sphereX) / (sphereRadius * 1.14)
        const shadowY = (y - (sphereY + sphereRadius * 0.68)) / (sphereRadius * 0.18)
        const shadow = Math.exp(-(shadowX * shadowX + shadowY * shadowY) * 2.2)
        if (dy > sphereRadius * 0.45) value -= shadow * 30
      }

      const edgeSoftness = Math.max(0, Math.min(1, 1 - tileDistance))
      if (tileDistance > 0 && tileDistance < 1) value = value * edgeSoftness + 247 * (1 - edgeSoftness)
      data[index] = clamp(value)
      data[index + 1] = clamp(value)
      data[index + 2] = clamp(value + 2)
      data[index + 3] = 255
    }
  }

  return { width: size, height: size, data }
}
