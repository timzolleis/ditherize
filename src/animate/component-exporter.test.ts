import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'
import type { DotData } from '../dither/types'
import { DEFAULT_ANIM_CONFIG } from './useDotAnimation'
import { toReactComponent, toReactPreset } from './component-exporter'

const data: DotData = {
  kind: 'bw', width: 2, height: 2, cornerRadius: 0, dots: [[0, 1]],
}

describe('copyable React component exporter', () => {
  it('exports an agnostic framework with data and configuration supplied through props', () => {
    const source = toReactComponent()
    expect(source).toContain("from 'react'")
    expect(source).toContain('export function DitherAnimation')
    expect(source).toContain('data: DotData | EncodedDitherData')
    expect(source).toContain('config: AnimationConfig')
    expect(source).toContain("fit?: 'cover' | 'contain'")
    expect(source).toContain("fit = 'cover'")
    expect(source).toContain('Math.max(widthScale, heightScale)')
    expect(source).not.toContain('export const DITHER_DATA')
    expect(source).not.toContain('DITHER_ANIMATION_CONFIG')
    expect(source).not.toContain('ds1:b:2:2:0::')
    expect(source).not.toContain("width: '100%'")
    expect(source).not.toContain("height: '100%'")
    expect(source).toContain('requestAnimationFrame')
    expect(source).not.toContain("from '../")
    expect(source).not.toContain("from './")
    const compilerOptions: ts.CompilerOptions = {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
      strict: true,
      skipLibCheck: true,
    }
    const fileName = new URL('../../dither-animation.tsx', import.meta.url).pathname
    const host = ts.createCompilerHost(compilerOptions)
    const getSourceFile = host.getSourceFile.bind(host)
    host.fileExists = ((original) => (name) => name === fileName || original(name))(host.fileExists.bind(host))
    host.readFile = ((original) => (name) => name === fileName ? source : original(name))(host.readFile.bind(host))
    host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) =>
      name === fileName
        ? ts.createSourceFile(name, source, languageVersion, true, ts.ScriptKind.TSX)
        : getSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile)
    const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([fileName], compilerOptions, host))
      .filter(({ category }) => category === ts.DiagnosticCategory.Error)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
    expect(diagnostics).toEqual([])
  })

  it('can export a small TypeScript preset without JSON', () => {
    const source = toReactPreset(data, DEFAULT_ANIM_CONFIG)
    expect(source).toContain('// dither-preset.ts')
    expect(source).toContain("data: 'ds1:b:2:2:0::")
    expect(source).toContain('config: {')
  })
})
