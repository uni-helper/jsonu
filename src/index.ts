import type { Path, TreeNode } from './types'
import { parse as momoaParse } from '@humanwhocodes/momoa'
import { parseConditions } from './conditions'
import { buildTree, evaluateTree, stringifyTree } from './tree'

export class JsonuDocument {
  constructor(private root: TreeNode) {}

  evaluate(platform: string): unknown {
    return evaluateTree(this.root, platform)
  }

  stringify(indent = 2): string {
    return stringifyTree(this.root, indent)
  }

  // 覆盖：移除该位置该平台已有的条件数据，再写入新的
  set(platform: string, data: unknown, path?: Path): this {
    const container = this.navigate(path)
    this.removeConditional(container, platform)
    this.addConditional(container, data, platform)
    return this
  }

  // 添加：对象→合并字段，数组→追加元素；不移除已有
  merge(platform: string, data: unknown, path?: Path): this {
    const container = this.navigate(path)
    this.addConditional(container, data, platform)
    return this
  }

  delete(platform: string, path?: Path): this {
    const container = this.navigate(path)
    this.removeConditional(container, platform)
    return this
  }

  private navigate(path?: Path): TreeNode {
    const segs = normalizePath(path)
    let current = this.root
    for (const seg of segs) {
      if (typeof seg === 'number') {
        if (current.type !== 'array')
          throw new Error(`路径期望数组，但遇到 ${current.type}`)
        current = current.elements[seg].value
      }
      else {
        if (current.type !== 'object')
          throw new Error(`路径期望对象，但遇到 ${current.type}`)
        const member = current.members.find(m => m.key === seg)
        if (!member)
          throw new Error(`找不到键: ${seg}`)
        current = member.value
      }
    }
    return current
  }

  // 删除由 set/merge 用同一 platform 字符串写入的条件块（精确匹配 platform 字段）
  private removeConditional(container: TreeNode, platform: string): void {
    if (container.type === 'object') {
      container.members = container.members.filter(
        m => !(m.condition && m.condition.platform === platform),
      )
    }
    else if (container.type === 'array') {
      container.elements = container.elements.filter(
        el => !(el.condition && el.condition.platform === platform),
      )
    }
  }

  private addConditional(container: TreeNode, data: unknown, platform: string): void {
    const condition = { kind: 'ifdef' as const, platform }
    const node = toTreeNode(data)

    if (container.type === 'object') {
      if (node.type !== 'object')
        throw new Error('对象容器需要对象数据')
      for (const m of node.members) {
        container.members.push({ ...m, condition })
      }
    }
    else if (container.type === 'array') {
      if (node.type !== 'array')
        throw new Error('数组容器需要数组数据')
      for (const el of node.elements) {
        container.elements.push({ ...el, condition })
      }
    }
    else {
      throw new Error(`无法在 ${container.type} 上添加条件数据`)
    }
  }
}

function normalizePath(path?: Path): (string | number)[] {
  if (!path)
    return []
  if (Array.isArray(path))
    return path
  return path.split('.').map(seg => /^\d+$/.test(seg) ? Number(seg) : seg)
}

function toTreeNode(value: unknown): TreeNode {
  if (value === null)
    return { type: 'value', value: null }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return { type: 'value', value }
  if (Array.isArray(value))
    return { type: 'array', elements: value.map(v => ({ value: toTreeNode(v) })) }
  if (typeof value === 'object')
    return { type: 'object', members: Object.entries(value as Record<string, unknown>).map(([k, v]) => ({ key: k, value: toTreeNode(v) })) }
  throw new Error(`不支持的数据类型: ${typeof value}`)
}

export function parse(jsonu: string): JsonuDocument {
  const ast = momoaParse(jsonu, {
    mode: 'jsonc',
    ranges: true,
    tokens: true,
  })

  // 筛出注释 token
  const commentTokens = (ast.tokens ?? [])
    .filter(t => t.type === 'LineComment' || t.type === 'BlockComment')
    .map(t => ({ range: t.range as [number, number], text: jsonu.slice(...(t.range as [number, number])) }))

  const ranges = parseConditions(commentTokens)
  const tree = buildTree(ast.body, ranges)
  return new JsonuDocument(tree)
}

export { evaluateTree, stringifyTree }
export * from './types'
