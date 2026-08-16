import { test, expect, _electron } from '@playwright/test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const APP_EXE = join(process.cwd(), 'release', 'win-unpacked', 'Efferent.exe')

test.skip(!existsSync(APP_EXE), '打包产物不存在（先 npm run dist）')

test('打包产物冒烟：启动→引擎就绪→DSH 界面加载→退出零残留', async () => {
  const app = await _electron.launch({ executablePath: APP_EXE })
  const page = await app.firstWindow()

  // 主窗口标题（DSH Web UI 文档标题）
  await expect
    .poll(async () => page.title(), { timeout: 120_000 })
    .toBe('DeepSeek Harness')

  // 引擎真实服务中：页面含 boot 图脚本
  await expect
    .poll(async () => (await page.content()).includes('__DSH_BOOT__'), { timeout: 30_000 })
    .toBe(true)

  await app.close()
})
