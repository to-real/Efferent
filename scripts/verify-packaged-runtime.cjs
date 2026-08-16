// electron-builder afterPack 钩子：校验打包产物内运行时完整性。
// （结构思路参照社区项目 verify-packaged-runtime，实现从零编写并按本项目产物清单定制。）
const fs = require('node:fs')
const path = require('node:path')

module.exports.default = async function verifyPackagedRuntime(context) {
  const res = path.join(context.appOutDir, 'resources')
  const checks = [
    'runtime/node.exe',
    path.join('engine', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
    path.join('engine', 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'index.html'),
  ]
  const missing = checks.filter(rel => !fs.existsSync(path.join(res, rel)))
  if (missing.length > 0) {
    throw new Error(`verify-packaged-runtime: 产物缺少关键文件：\n${missing.join('\n')}`)
  }
  // 原生模块抽查：node-pty 二进制必须在（预编译 prebuilds 布局或源码构建 build/Release 布局）
  const ptyRoot = path.join(res, 'engine', 'node_modules', 'node-pty')
  const ptyPrebuild = fs.existsSync(path.join(ptyRoot, 'prebuilds', 'win32-x64', 'pty.node'))
  const ptyBuilt = fs.existsSync(path.join(ptyRoot, 'build', 'Release'))
    && fs.readdirSync(path.join(ptyRoot, 'build', 'Release')).some(f => f.endsWith('.node'))
  if (!ptyPrebuild && !ptyBuilt) {
    throw new Error('verify-packaged-runtime: node-pty 原生二进制缺失（PTY 终端将不可用）')
  }
  console.log('[verify-packaged-runtime] OK：node.exe / dsh bin.js / web 前端 / node-pty 全部在位')
}
