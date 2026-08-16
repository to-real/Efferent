// 合并 electron-builder 发布竞态产生的重复 Release（同 tag 多条时以含 setup.exe 的一条为主）。
// 用法：GH_TOKEN=xxx node scripts/consolidate-release.mjs <tag>
// 背景：electron-builder 26.15.3 在 GitHub 发布时偶发创建两条同 tag Release，
// 资产被拆分（实测 v0.1.0/v0.1.1 均复现）。本脚本把资产归并到主 Release 并删除多余的。
const API = 'https://api.github.com'
const UPLOADS = 'https://uploads.github.com'
const REPO = process.env.GITHUB_REPOSITORY ?? 'to-real/Efferent'

const tag = process.argv[2]
const token = process.env.GH_TOKEN
if (!tag || !token) {
  console.error('用法：GH_TOKEN=xxx node scripts/consolidate-release.mjs <tag>')
  process.exit(1)
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
}

const main = async () => {
  const res = await fetch(`${API}/repos/${REPO}/releases?per_page=100`, { headers })
  if (!res.ok) throw new Error(`列出 Release 失败：${res.status}`)
  const all = await res.json()
  const sameTag = all.filter(r => r.tag_name === tag)
  if (sameTag.length === 0) throw new Error(`未找到 tag ${tag} 的 Release`)
  if (sameTag.length === 1) {
    console.log(`[consolidate-release] ${tag} 仅一条 Release，无需合并`)
    return
  }

  // 主 Release：持有安装包的那条（electron-updater 的 latest.yml 与它同侧）
  const primary = sameTag.find(r => r.assets.some(a => /setup\.exe$/.test(a.name)))
    ?? sameTag[0]
  console.log(`[consolidate-release] 主 Release id=${primary.id}（资产 ${primary.assets.length} 个）`)

  const primaryNames = new Set(primary.assets.map(a => a.name))
  for (const dup of sameTag) {
    if (dup.id === primary.id) continue
    for (const asset of dup.assets) {
      if (primaryNames.has(asset.name)) continue
      console.log(`  迁移资产 ${asset.name} …`)
      const bin = Buffer.from(await (await fetch(asset.browser_download_url)).arrayBuffer())
      const up = await fetch(`${UPLOADS}/repos/${REPO}/releases/${primary.id}/assets?name=${encodeURIComponent(asset.name)}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/octet-stream' },
        body: bin,
      })
      if (!up.ok) throw new Error(`上传 ${asset.name} 失败：${up.status} ${await up.text()}`)
      primaryNames.add(asset.name)
    }
    const del = await fetch(`${API}/repos/${REPO}/releases/${dup.id}`, { method: 'DELETE', headers })
    if (!del.ok) throw new Error(`删除重复 Release ${dup.id} 失败：${del.status}`)
    console.log(`  已删除重复 Release id=${dup.id}`)
  }
  console.log(`[consolidate-release] 完成：${tag} 现有资产 ${[...primaryNames].join(', ')}`)
}

main().catch(err => {
  console.error('[consolidate-release]', err.message)
  process.exit(1)
})
