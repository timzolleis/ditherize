import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router'
import type { DitherConfig, PixelBuffer } from './dither/types'
import { AnimatePage } from './pages/AnimatePage'
import { DitherPage } from './pages/DitherPage'
import { makePlaceholder } from './placeholder'
import type { PreviewAppearance } from './preview/appearance'
import {
  loadDitherConfig,
  loadPersistedSource,
  loadPreviewAppearance,
  saveDitherConfig,
  savePreviewAppearance,
} from './store/sessionStore'

export default function App() {
  // Keep the editing session above the routes so route changes do not discard uploads or settings.
  const [ditherSource, setDitherSource] = useState<PixelBuffer>(() => makePlaceholder())
  const [ditherSourceName, setDitherSourceName] = useState('Studio sphere')
  const [ditherConfig, setDitherConfig] = useState<DitherConfig>(() => loadDitherConfig())
  const [previewAppearance, setPreviewAppearance] = useState<PreviewAppearance>(() => loadPreviewAppearance())

  useEffect(() => saveDitherConfig(ditherConfig), [ditherConfig])
  useEffect(() => savePreviewAppearance(previewAppearance), [previewAppearance])

  useEffect(() => {
    let cancelled = false
    void loadPersistedSource().then((persisted) => {
      if (!persisted || cancelled) return
      setDitherSource({ width: persisted.width, height: persisted.height, data: persisted.data })
      setDitherSourceName(persisted.name)
    })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/dither" aria-label="Dither Studio home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>Dither Studio</span>
        </NavLink>
        <nav aria-label="Studio tools">
          <NavLink to="/dither">Dither</NavLink>
          <NavLink to="/animate">Animate</NavLink>
        </nav>
        <span className="topbar-meta">Error diffusion lab</span>
      </header>
      <Routes>
        <Route index element={<Navigate to="/dither" replace />} />
        <Route
          path="/dither"
          element={(
            <DitherPage
              source={ditherSource}
              setSource={setDitherSource}
              sourceName={ditherSourceName}
              setSourceName={setDitherSourceName}
              config={ditherConfig}
              setConfig={setDitherConfig}
              previewAppearance={previewAppearance}
              setPreviewAppearance={setPreviewAppearance}
            />
          )}
        />
        <Route
          path="/animate"
          element={(
            <AnimatePage
              previewAppearance={previewAppearance}
              setPreviewAppearance={setPreviewAppearance}
            />
          )}
        />
        <Route path="*" element={<Navigate to="/dither" replace />} />
      </Routes>
    </div>
  )
}
