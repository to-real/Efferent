import { create } from 'zustand'
import { createTranscript, reduceFrame, type Transcript } from './reducer.js'
import { getBridge, type Bridge } from '../bridge.js'

export interface SessionInfo {
  sessionId: string
  title?: string
  running: boolean
  updatedAt: number
}

interface AppState {
  bridge: Bridge
  sessions: SessionInfo[]
  activeId: string | null
  transcripts: Map<string, Transcript>
  bootstrapped: boolean

  bootstrap(): Promise<void>
  openSession(sessionId: string): void
  newSession(): Promise<void>
  sendPrompt(text: string): Promise<void>
  respondApproval(rpcId: string, approvalId: string, outcome: 'allowed-once' | 'rejected'): Promise<void>
  frameIn(frame: unknown): void
}

export const useApp = create<AppState>((set, get) => {
  const bridge = getBridge()

  // 网关帧分发：host 帧维护会话列表，session 帧喂对应 transcript
  const dispatch = (frame: any) => {
    const state = get()
    if (frame?.method === 'host/session-added') {
      void refreshSessions()
      return
    }
    if (frame?.method === 'host/session-status' || frame?.method === 'host/session-removed') {
      void refreshSessions()
      return
    }
    const sid = frame?.payload?.sessionId
    if (typeof sid === 'string') {
      const t = state.transcripts.get(sid)
      if (t) {
        reduceFrame(t, frame)
        // reduceFrame 是原地折叠：必须给 transcript 换新引用，
        // 否则选择器 Object.is 判等跳过重渲染（曾导致帧到了 store 而 DOM 不更新）
        const transcripts = new Map(state.transcripts)
        transcripts.set(sid, { ...t, items: [...t.items] })
        set({ transcripts })
      }
    }
  }

  const refreshSessions = async () => {
    try {
      const bridge = get().bridge
      const listed = await bridge.rpc('session.list', {}) as any
      const items = (listed?.items ?? []).map((s: any) => ({
        sessionId: s.sessionId,
        title: (s.projections?.values?.title as string | undefined) ?? undefined,
        running: Boolean(s.running),
        updatedAt: s.updatedAt ?? 0,
      }))
      set({ sessions: items })
    } catch {
      // 引擎未就绪：静默，下次帧触发重试
    }
  }

  bridge.onFrame(dispatch)

  return {
    bridge,
    sessions: [],
    activeId: null,
    transcripts: new Map(),
    bootstrapped: false,

    async bootstrap() {
      if (get().bootstrapped) return
      set({ bootstrapped: true })
      await refreshSessions()
      if (get().sessions.length === 0) {
        await get().newSession()
      } else {
        get().openSession(get().sessions[0]!.sessionId)
      }
    },

    openSession(sessionId) {
      const state = get()
      if (!state.transcripts.has(sessionId)) {
        state.transcripts.set(sessionId, createTranscript(sessionId))
        state.bridge.subscribeSession(sessionId)
      }
      set({ activeId: sessionId, transcripts: new Map(state.transcripts) })
    },

    async newSession() {
      const bridge = get().bridge
      try {
        // 工作区：默认目录（引擎要求已存在——由主进程在启动时确保）
        const workspaces = await bridge.rpc('workspace.list', {}) as any
        let workspaceId: string | undefined = workspaces?.items?.[0]?.workspaceId
        if (workspaceId === undefined) {
          const created = await bridge.rpc('workspace.create', { path: bridge.defaultWorkspaceDir }) as any
          workspaceId = created?.workspace?.workspaceId
        }
        const created = await bridge.rpc('session.create', { workspaceId }) as any
        const sessionId = created?.sessionId
        if (typeof sessionId === 'string') {
          get().openSession(sessionId)
          await refreshSessions()
        }
      } catch (err) {
        console.error('[store] 新建会话失败', err)
      }
    },

    async sendPrompt(text) {
      const { activeId, bridge } = get()
      if (activeId == null || text.trim() === '') return
      await bridge.rpc('session.prompt', {
        sessionId: activeId,
        mode: 'queue',
        content: [{ type: 'text', text }],
      })
    },

    async respondApproval(rpcId, approvalId, outcome) {
      const { activeId, bridge } = get()
      if (activeId == null) return
      await bridge.respond(rpcId, { sessionId: activeId, approvalId, outcome })
    },

    frameIn(frame) {
      dispatch(frame)
    },
  }
})
