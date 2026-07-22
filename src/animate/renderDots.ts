import type { DotLayout } from './layout'

export interface RenderBuckets {
  readonly indices: Int32Array[]
  readonly lengths: Int32Array
}

/** Group dot indices by palette color once; the grouping never changes after layout. */
export function createRenderBuckets(layout: DotLayout): RenderBuckets {
  const bucketCount = Math.max(1, layout.palette.length)
  const lengths = new Int32Array(bucketCount)
  for (let index = 0; index < layout.count; index++) {
    lengths[Math.min(bucketCount - 1, layout.paletteIndex[index])]++
  }
  const indices = Array.from({ length: bucketCount }, (_, bucket) => new Int32Array(lengths[bucket]))
  const cursors = new Int32Array(bucketCount)
  for (let index = 0; index < layout.count; index++) {
    const bucket = Math.min(bucketCount - 1, layout.paletteIndex[index])
    indices[bucket][cursors[bucket]++] = index
  }
  return { indices, lengths }
}

/** Draw all dots batched by palette color, avoiding fill-style changes inside a batch. */
export function renderDots(
  context: CanvasRenderingContext2D,
  layout: DotLayout,
  renderX: Float32Array,
  renderY: Float32Array,
  width: number,
  height: number,
  buckets: RenderBuckets,
): void {
  context.clearRect(0, 0, width, height)

  for (let colorIndex = 0; colorIndex < buckets.indices.length; colorIndex++) {
    const length = buckets.lengths[colorIndex]
    if (length === 0) continue
    context.fillStyle = layout.palette[colorIndex] ?? layout.palette[0] ?? '#e8e7e2'
    const indices = buckets.indices[colorIndex]
    for (let position = 0; position < length; position++) {
      const index = indices[position]
      const size = layout.size[index]
      context.fillRect(renderX[index] - 0.25, renderY[index] - 0.25, size + 0.5, size + 0.5)
    }
  }
}
