import { useEffect } from 'react'
import { useApp } from './store/session-store.js'
import { TranscriptView } from './components/TranscriptView.js'
import { Composer } from './components/Composer.js'
import { SessionRail } from './components/SessionRail.js'

export function App() {
  const bootstrap = useApp(s => s.bootstrap)
  const activeId = useApp(s => s.activeId)
  const transcript = useApp(s => (s.activeId ? s.transcripts.get(s.activeId) : undefined))
  const running = transcript?.streaming !== undefined || transcript?.queued !== undefined && transcript.queued > 0

  useEffect(() => { void bootstrap() }, [bootstrap])

  return (
    <div className="workbench">
      <aside className="rail">
        <div className="rail-brand">Efferent</div>
        <SessionRail />
      </aside>
      <main className="stage">
        <header className="stage-header">
          <span className="session-title">{transcript?.title ?? '新会话'}</span>
          {running && <span className="live-dot" title="运行中" />}
        </header>
        <TranscriptView transcript={transcript} />
        <Composer />
      </main>
    </div>
  )
}
