import { contextBridge, ipcRenderer } from 'electron'

// 产品自有页面的桥：故障页/任务中心 + 自研工作台（efferent 命名空间 = 网关契约）
contextBridge.exposeInMainWorld('dshDesktop', {
  engineError: {
    onInfo: (cb: (msg: string) => void): void => {
      ipcRenderer.on('engine-error:info', (_e, msg) => cb(msg))
    },
    restart: (): Promise<void> => ipcRenderer.invoke('engine-error:restart'),
  },
  tasks: {
    onRows: (cb: (rows: unknown) => void): void => {
      ipcRenderer.on('tasks:rows', (_e, rows) => cb(rows))
    },
    focusMain: (): Promise<void> => ipcRenderer.invoke('tasks:focus-main'),
  },
})

contextBridge.exposeInMainWorld('efferent', {
  rpc: (method: string, payload: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('ef:rpc', method, payload),
  onFrame: (cb: (frame: unknown) => void): void => {
    ipcRenderer.on('ef:frame', (_e, frame) => cb(frame))
  },
  subscribeSession: (sessionId: string): void => {
    void ipcRenderer.invoke('ef:subscribe', sessionId)
  },
  respond: (rpcId: string, value: unknown): Promise<unknown> =>
    ipcRenderer.invoke('ef:respond', rpcId, value),
  defaultWorkspaceDir: process.env.EFFERENT_DEFAULT_WS ?? '',
})
