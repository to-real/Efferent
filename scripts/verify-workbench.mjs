// M2 端到端验证：拉起真实应用 → Composer 发送 → 断言转写渲染（用户消息/工具卡/助手回答）。
// 用法：node scripts/verify-workbench.mjs（需要 plugins/workbench 已构建）
import { _electron } from 'playwright'
import { setTimeout as sleep } from 'node:timers/promises'

const TIMEOUT = 180_000

async function main() {
  console.log('[verify] 启动 Electron…')
  const app = await _electron.launch({
    executablePath: 'node_modules/electron/dist/electron.exe',
    args: ['.'],
  })
  app.process().stdout.on('data', (d) => process.stdout.write(`[main] ${d}`))
  app.process().stderr.on('data', (d) => process.stderr.write(`[main-err] ${d}`))

  const win = await app.waitForEvent('window', {
    predicate: (w) => w.url().includes('workbench/dist/index.html'),
    timeout: 60_000,
  })
  console.log('[verify] 主窗口已加载:', win.url())
  win.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[renderer ${m.type()}]`, m.text()) })
  win.on('pageerror', (e) => console.log('[renderer pageerror]', e.message))

  console.log('[verify] 等待会话就绪（引擎启动 + bootstrap）…')
  await win.waitForSelector('textarea:not([disabled])', { timeout: 90_000 })
  const railCount = await win.locator('.rail-item').count()
  console.log(`[verify] 会话栏条目: ${railCount}`)
  if (railCount < 1) throw new Error('会话栏为空')

  const prompt = '请用 pwsh 执行 echo hello-efferent，然后用一句话告诉我输出是什么。'
  await win.locator('textarea').fill(prompt)
  await win.locator('button.send').click()
  console.log('[verify] 已发送 prompt，等待转写渲染…')

  try {
    await win.waitForSelector('.msg-user', { timeout: 25_000 })
  } catch {
    const streamHtml = await win.evaluate(() => document.querySelector('.stream')?.innerHTML?.slice(0, 2000) ?? '(no .stream)')
    console.log('[verify][dump] .stream =', streamHtml)
    const dbg = await win.evaluate(() => ({
      frames: (globalThis).__EF_FRAMES ?? [],
      route: (globalThis).__EF_ROUTE ?? null,
      etypes: (globalThis).__EF_ETYPES ?? [],
    }))
    console.log('[verify][dump] renderer 收帧 =', JSON.stringify(dbg.frames))
    console.log('[verify][dump] 会话路由 =', JSON.stringify(dbg.route))
    console.log('[verify][dump] event.type =', JSON.stringify(dbg.etypes))
    const bridge = await win.evaluate(() => ({
      hasEfferent: !!window.efferent,
      hasDsh: !!window.dshDesktop,
    }))
    console.log('[verify][dump] bridge =', JSON.stringify(bridge))
    throw new Error('用户消息未渲染')
  }
  console.log('[verify] ✓ 用户消息已渲染')

  await win.waitForSelector('.tool-card .name', { timeout: TIMEOUT })
  const toolName = (await win.locator('.tool-card .name').first().textContent())?.trim()
  console.log(`[verify] ✓ 工具卡已渲染: ${toolName}`)

  await win.waitForFunction(
    () => [...document.querySelectorAll('.msg-assistant')].some((el) => el.textContent?.includes('hello-efferent')),
    undefined,
    { timeout: TIMEOUT },
  )
  console.log('[verify] ✓ 助手最终回答包含 hello-efferent')

  const reasoning = await win.locator('.reasoning').count()
  console.log(`[verify] 思考块数量: ${reasoning}`)

  await win.screenshot({ path: 'workbench-live.png' })
  console.log('[verify] 截图: workbench-live.png')

  console.log('[verify] 全链路 PASS：Composer→网关→引擎→WS 事件流→reducer→DOM')
  await app.close()
}

main().catch(async (err) => {
  console.error('[verify] FAIL:', err.message)
  process.exit(1)
})
