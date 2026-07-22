# Dither Studio

A client-side image-to-dot tool and interactive animation playground built with Vite, React, TypeScript, and react-router.

## Features

- 11 error-diffusion kernels, including Floyd–Steinberg, Atkinson, Jarvis, Stucki, and Sierra variants
- Tone, scale, blur, threshold, error-strength, serpentine, invert, and rounded-mask controls
- Optional preset or custom palettes with Rec. 709 RGB and OKLab matching
- High-resolution PNG, crisp SVG, JSON, and TypeScript exports generated from your own images
- Cursor repulsion, spring return, and click shockwaves with live physics controls
- Dither and animation settings persist through localStorage; uploaded pixels persist through IndexedDB
- Copyable `dither-animation.tsx` implementation with React as its only dependency
- Compact `ds1` presets (bit-packed and embedded in TypeScript—no JSON asset required)
- Dot data shared between routes through localStorage

## Run locally

```bash
pnpm install
pnpm dev
```

Validation:

```bash
pnpm test
pnpm lint
pnpm build
```

## Reuse the animation

Choose **Copy component** once and paste the agnostic framework into your project as `dither-animation.tsx`. Then configure the Animate tab, choose **Copy compact preset**, and save it as `dither-preset.ts`.

The component contains no embedded artwork or animation settings. Both are required props supplied by the preset:

```tsx
import { DitherAnimation } from './dither-animation'
import { ditherPreset } from './dither-preset'

export function Hero() {
  return (
    <div style={{ position: 'relative', width: '100%', height: 560 }}>
      <DitherAnimation className="absolute inset-0 h-full w-full" {...ditherPreset} />
    </div>
  )
}
```

The component defaults to `fit="cover"`, matching `object-fit: cover` when the canvas and dot field have different aspect ratios. Use `fit="contain"` to show the complete field, and `fieldScale` for additional zoom. It also accepts normal canvas props. The same framework can render any number of independently generated presets.

The `ds1` preset is a versioned, URL-safe bit-packed string: one bit per B/W grid cell, or the minimum necessary bits per palette cell. No separate JSON file or runtime package is needed.

## Credits & source boundaries

The interactive dot animation was inspired by [Emil Kowalski](https://emilkowal.ski/)'s work and the dithered dot interaction on [Linear](https://linear.app)'s website. The interaction design was studied from publicly available sourcemaps; none of that code or data is included in this repository. In particular, Linear's original dot-coordinate data is not shipped; Dither Studio creates and exports its own dot data.

The error-diffusion kernel table and palette presets were adapted from [ditherit-v3](https://github.com/alexharris/ditherit-v3), used under its MIT license.
