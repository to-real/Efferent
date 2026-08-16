import { useRef, useState, type KeyboardEvent } from 'react'
import { useApp } from '../store/session-store.js'

export function Composer() {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const send = useApp(s => s.sendPrompt)
  const activeId = useApp(s => s.activeId)
  const queued = useApp(s => {
    const t = s.activeId ? s.transcripts.get(s.activeId) : undefined
    return t?.queued ?? 0
  })

  const doSend = async () => {
    const value = text.trim()
    if (value === '' || activeId == null) return
    setText('')
    await send(value)
    ref.current?.focus()
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void doSend()
    }
  }

  return (
    <div className="composer">
      {queued > 0 && <div className="composer-queue">⏳ {queued} 条排队中</div>}
      <div className="composer-row">
        <textarea
          ref={ref}
          value={text}
          placeholder={activeId == null ? '正在准备会话…' : '给 Efferent 下达任务…（Enter 发送，Shift+Enter 换行）'}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
          disabled={activeId == null}
        />
        <button className="send" onClick={() => { void doSend() }} disabled={text.trim() === '' || activeId == null}>
          发送
        </button>
      </div>
    </div>
  )
}
