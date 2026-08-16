import { contextBridge, ipcRenderer } from 'electron'

// 产品自有页面（故障页/任务中心）与主进程的桥
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
