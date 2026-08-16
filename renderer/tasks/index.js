// 任务中心页逻辑（无构建步骤，原生 JS）
const rowsBody = document.getElementById('rows')

const relTime = (ts) => {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return `${Math.floor(diff / 86_400_000)} 天前`
}

const render = (rows) => {
  if (!rows || rows.length === 0) {
    rowsBody.innerHTML = '<tr><td colspan="4" class="empty">暂无会话——在主窗口开启一个任务后，这里会实时汇总</td></tr>'
    return
  }
  rowsBody.innerHTML = rows.map((r) => `
    <tr class="row" data-session="${r.sessionId}">
      <td>${escapeHtml(r.title)}</td>
      <td>${escapeHtml(r.workspace)}</td>
      <td class="${r.running ? 'running-badge' : 'idle-badge'}">${r.running ? '● 运行中' : '○ 空闲'}</td>
      <td>${relTime(r.updatedAt)}</td>
    </tr>`).join('')
  for (const tr of rowsBody.querySelectorAll('tr.row')) {
    tr.addEventListener('click', () => { window.dshDesktop.tasks.focusMain() })
  }
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]))

window.dshDesktop.tasks.onRows(render)
