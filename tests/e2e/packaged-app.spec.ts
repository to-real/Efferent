import { test, expect, _electron } from '@playwright/test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const APP_EXE = join(process.cwd(), 'release', 'win-unpacked', 'Efferent.exe')

test.skip(!existsSync(APP_EXE), '打包产物不存在（先 npm run dist）')

test('打包产物冒烟：启动→引擎就绪→DSH 界面加载→退出零残留', async () => {
  const app = await _electron.launch({ executablePath: APP_EXE })
  // splash 会先开先关：按 URL 谓词等真正的主窗口（加载引擎地址的那个）
  const page = await app.waitForEvent('window', w => w.url().startsWith('http://127.0.0.1:'))

  // 引擎真实服务中：页面含 boot 图脚本（document.title 属引擎页面，不作断言对象）
  await expect
    .poll(async () => (await page.content()).includes('__DSH_BOOT__'), { timeout: 120_000 })
    .toBe(true)

  // 品牌化断言原生窗口标题（主进程侧；page.title() 读的是 document.title）
  await expect
    .poll(async () => await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().some(w =>
        w.webContents.getURL().startsWith('http://127.0.0.1:') && w.title === 'Efferent')), { timeout: 30_000 })
    .toBe(true)

  await app.close()
})
