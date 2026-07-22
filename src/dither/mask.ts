export function isInsideRoundedRectCell(
  col: number,
  row: number,
  width: number,
  height: number,
  radius: number,
): boolean {
  if (col < 0 || row < 0 || col >= width || row >= height) return false
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2))
  if (r <= 0) return true
  const x = col + 0.5
  const y = row + 0.5
  const nearestX = Math.max(r, Math.min(width - r, x))
  const nearestY = Math.max(r, Math.min(height - r, y))
  const dx = x - nearestX
  const dy = y - nearestY
  return dx * dx + dy * dy <= r * r
}
