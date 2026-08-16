import { useState } from 'react'
import type { Transcript } from '../store/reducer.js'
import { ToolCard } from './ToolCard.js'
import { ApprovalCard } from './ApprovalCard.js'

export function TranscriptView({ transcript }: { transcript: Transcript | undefined }) {
  if (transcript == null) {
    return <div className="stream"><p style={{ color: 'var(--fg-muted)', padding: 24 }}>正在连接引擎…</p></div>
  }

  return (
    <div className="stream">
      {transcript.items.map((item, i) => {
        switch (item.kind) {
          case 'user':
            return <div key={i} className="msg msg-user">{item.text}</div>
          case 'assistant':
            return (
              <div key={i} className="msg msg-assistant">
                {item.reasoning && <ReasoningBlock text={item.reasoning} />}
                {item.text}
              </div>
            )
          case 'tool':
            return <ToolCard key={i} item={item} />
          case 'approval':
            return <ApprovalCard key={i} item={item} rpcId={item.rpcId} />
          default:
            return null
        }
      })}

      {transcript.streaming && (
        <div className="msg msg-assistant">
          {transcript.streaming.reasoning && <ReasoningBlock text={transcript.streaming.reasoning} />}
          {transcript.streaming.text}
          {[...transcript.streaming.toolArgs.entries()].map(([idx, tc]) => (
            <div key={idx} className="tool-card" style={{ marginTop: 10 }}>
              <div className="tool-head">
                <span className="name">{tc.name || '…'}</span>
                <span className="pending-note">调用中</span>
              </div>
            </div>
          ))}
          <span className="live-dot" style={{ display: 'inline-block', marginLeft: 6 }} />
        </div>
      )}
    </div>
  )
}

function ReasoningBlock({ text }: { text: string }) {
  const [collapsed, setCollapsed] = useState(true)
  return (
    <div
      className={`reasoning${collapsed ? ' collapsed' : ''}`}
      onClick={() => setCollapsed(c => !c)}
      title="点击展开/折叠思考过程"
    >
      {text}
    </div>
  )
}
