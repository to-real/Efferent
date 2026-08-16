import { useState } from 'react'
import type { TranscriptItem } from '../store/reducer.js'
import { diffLines, extractEditArgs } from '../store/diff.js'

export function ToolCard({ item }: { item: Extract<TranscriptItem, { kind: 'tool' }> }) {
  const [open, setOpen] = useState(false)
  const edit = extractEditArgs(item.args)
  const prettyArgs = (() => {
    try {
      return JSON.stringify(JSON.parse(item.args), null, 2)
    } catch {
      return item.args
    }
  })()

  return (
    <div className={`msg tool-card${open ? ' open' : ''}`}>
      <div className="tool-head" onClick={() => setOpen(o => !o)}>
        <span className="name">{item.name}</span>
        <span>{item.pending ? '· 运行中…' : '· 完成'}</span>
        <span className="chev">›</span>
      </div>
      <div className="tool-body">
        <pre>{prettyArgs}</pre>
        {edit && (
          <div className="diff">
            {diffLines(edit.oldText, edit.newText).map((line, i) => (
              <div key={i} className={`line ${line.kind}`}>{line.kind === 'add' ? '+ ' : line.kind === 'del' ? '- ' : '  '}{line.text}</div>
            ))}
          </div>
        )}
        {item.result !== undefined && (
          <div className="result">
            <pre>{item.result.slice(0, 4000)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
