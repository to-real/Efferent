import { useApp } from '../store/session-store.js'
import type { TranscriptItem } from '../store/reducer.js'

/** 审批卡：approval/requested 帧（answerable）携带 rpcId；批准/拒绝经 /api/respond 回传。
 * 注：持久化 approval/asked 事件无 rpcId，仅展示（等待引擎侧路径补全时不可交互）。 */
export function ApprovalCard({ item, rpcId }: { item: Extract<TranscriptItem, { kind: 'approval' }>; rpcId?: string }) {
  const respond = useApp(s => s.respondApproval)

  if (item.outcome !== undefined) {
    return (
      <div className="msg approval">
        <div className="title">审批 · {item.toolName}</div>
        <div className="outcome">
          {item.outcome === 'allowed-once' ? '✓ 已允许' : item.outcome === 'rejected' ? '✕ 已拒绝' : `已处理（${item.outcome}）`}
        </div>
      </div>
    )
  }

  return (
    <div className="msg approval">
      <div className="title">需要批准 · {item.toolName}</div>
      {item.reason && <div className="reason">{item.reason}</div>}
      {rpcId !== undefined ? (
        <div className="actions">
          <button className="allow" onClick={() => { void respond(rpcId, item.approvalId, 'allowed-once') }}>允许一次</button>
          <button onClick={() => { void respond(rpcId, item.approvalId, 'rejected') }}>拒绝</button>
        </div>
      ) : (
        <div className="outcome">等待审批通路（此卡来自历史事件）</div>
      )}
    </div>
  )
}
