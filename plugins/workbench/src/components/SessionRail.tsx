import { useApp } from '../store/session-store.js'

export function SessionRail() {
  const sessions = useApp(s => s.sessions)
  const activeId = useApp(s => s.activeId)
  const open = useApp(s => s.openSession)
  const newSession = useApp(s => s.newSession)

  return (
    <>
      <div className="rail-sessions">
        {sessions.map(s => (
          <div
            key={s.sessionId}
            className={`rail-item${s.sessionId === activeId ? ' active' : ''}`}
            onClick={() => open(s.sessionId)}
          >
            <span className={`dot${s.running ? ' running' : ''}`} />
            <span className="label">{s.title ?? '未命名会话'}</span>
          </div>
        ))}
      </div>
      <div className="rail-new" onClick={() => { void newSession() }}>＋ 新会话</div>
    </>
  )
}
