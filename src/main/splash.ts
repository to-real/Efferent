import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))

let splashWin: BrowserWindow | null = null

/** 启动页：引擎就绪前的本地秒开小窗（产品名 + slogan + 脉动动画）。 */
export function showSplash(): void {
  if (splashWin != null && !splashWin.isDestroyed()) {
    splashWin.show()
    return
  }
  splashWin = new BrowserWindow({
    width: 480,
    height: 300,
    frame: false,
    resizable: false,
    center: true,
    show: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  splashWin.once('ready-to-show', () => { splashWin?.show() })
  void splashWin.loadFile(join(here, '..', '..', 'renderer', 'splash', 'index.html'))
}

export function hideSplash(): void {
  splashWin?.close()
  splashWin = null
}
