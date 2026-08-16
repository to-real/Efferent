export interface DiffLine {
  kind: 'same' | 'add' | 'del'
  text: string
}

/**
 * 极简 LCS 行 diff（编辑工具的 old/new 字符串 → 统一 diff 行）。
 * 规模假设：单文件编辑，行数量级小，O(n·m) 足够。
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.length === 0 ? [] : oldText.split('\n')
  const b = newText.length === 0 ? [] : newText.split('\n')
  const n = a.length
  const m = b.length

  // LCS 表
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i]! })
      i += 1
      j += 1
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ kind: 'del', text: a[i]! })
      i += 1
    } else {
      out.push({ kind: 'add', text: b[j]! })
      j += 1
    }
  }
  while (i < n) {
    out.push({ kind: 'del', text: a[i]! })
    i += 1
  }
  while (j < m) {
    out.push({ kind: 'add', text: b[j]! })
    j += 1
  }
  return out
}

/** 从工具调用参数中提取编辑类工具的 old/new 字符串（DSH str_replace_editor 语义）。 */
export function extractEditArgs(argsJson: string): { oldText: string; newText: string } | undefined {
  try {
    const args = JSON.parse(argsJson) as Record<string, unknown>
    const oldStr = args['old_string'] ?? args['oldText']
    const newStr = args['new_string'] ?? args['newText']
    if (typeof oldStr === 'string' && typeof newStr === 'string') return { oldText: oldStr, newText: newStr }
    return undefined
  } catch {
    return undefined
  }
}
