import { contextBridge, ipcRenderer } from 'electron'

// 引擎故障页与主进程的桥（向导已移除：新手引导交给 DSH 原生界面）
contextBridge.exposeInMainWorld('dshDesktop', {
  engineError: {
    onInfo: (cb: (msg: string) => void): void => {
      ipcRenderer.on('engine-error:info', (_e, msg) => cb(msg))
    },
    restart: (): Promise<void> => ipcRenderer.invoke('engine-error:restart'),
  },
})
