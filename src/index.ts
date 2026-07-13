import type { Path, TreeNode } from './types'
import { parse as momoaParse } from '@humanwhocodes/momoa'
import { parseConditions } from './conditions'
import { buildTree, evaluateTree, stringifyTree } from './tree'
import { COMMON } from './types'

export class JsonuDocument {
  constructor(private root: TreeNode) {}

  evaluate(platform: string): unknown {
    return evaluateTree(this.root, platform)
  }

  stringify(indent = 2): string {
    return stringifyTree(this.root, indent)
  }

  // 覆盖：移除该位置该平台已有的条件数据，再写入新的
  // COMMON 走按 key 删的精细语义（避免误清同容器内其他通用配置）
  // 路径不存在时按 data 类型自动创建中间对象/数组
  set(platform: string, data: unknown, path?: Path): this {
    const leafType = Array.isArray(data) ? 'array' : 'object'
    // create=true 时 navigate 一定返回节点或抛错，不会 undefined
    const container = this.navigate(path, true, leafType)!
    if (platform === COMMON)
      this.removeCommonForSet(container, data)
    else
      this.removeConditional(container, platform)
    this.addConditional(container, data, platform)
    return this
  }

  // 添加：对象→合并字段，数组→追加元素；不移除已有
  // 路径不存在时按 data 类型自动创建中间对象/数组
  merge(platform: string, data: unknown, path?: Path): this {
    const leafType = Array.isArray(data) ? 'array' : 'object'
    const container = this.navigate(path, true, leafType)!
    this.addConditional(container, data, platform)
    return this
  }

  // 路径不存在时 no-op（删除不存在的数据是合法的空操作）
  delete(platform: string, path?: Path): this {
    const container = this.navigate(path, false)
    if (container)
      this.removeConditional(container, platform)
    return this
  }

  // navigate 沿 path 定位节点
  // create=true 时自动创建缺失的中间对象/数组；leafType 指定终点节点类型（由 data 决定）
  // 返回 undefined 表示路径不存在且未创建
  private navigate(path: Path | undefined, create: boolean, leafType?: 'object' | 'array'): TreeNode | undefined {
    const segs = normalizePath(path)
    if (segs.length === 0)
      return this.root

    let current = this.root
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]
      const isLast = i === segs.length - 1
      const nextSeg = segs[i + 1]
      // 节点类型：终点用 leafType，中间根据下一 seg 推断
      const nodeType: 'object' | 'array' = isLast && leafType
        ? leafType
        : (typeof nextSeg === 'number' ? 'array' : 'object')

      if (typeof seg === 'number') {
        if (current.type !== 'array') {
          if (create)
            throw new Error(`路径期望数组，但遇到 ${current.type}`)
          return undefined
        }
        const el = current.elements[seg]
        if (!el) {
          if (!create)
            return undefined
          // 仅允许追加到末尾，禁止跳过索引填充
          if (seg !== current.elements.length)
            throw new Error(`数组索引越界: ${seg}（当前长度 ${current.elements.length}）`)
          const newNode: TreeNode = nodeType === 'array'
            ? { type: 'array', elements: [] }
            : { type: 'object', members: [] }
          current.elements.push({ value: newNode })
          current = newNode
        }
        else {
          current = el.value
        }
      }
      else {
        if (current.type !== 'object') {
          if (create)
            throw new Error(`路径期望对象，但遇到 ${current.type}`)
          return undefined
        }
        let member = current.members.find(m => m.key === seg)
        if (!member) {
          if (!create)
            return undefined
          const newNode: TreeNode = nodeType === 'array'
            ? { type: 'array', elements: [] }
            : { type: 'object', members: [] }
          member = { key: seg, value: newNode }
          current.members.push(member)
        }
        current = member.value
      }
    }
    return current
  }

  // 删除由 set/merge 用同一 platform 字符串写入的条件块（精确匹配 platform 字段）
  // platform === COMMON 时删除无 condition 的通用节点（用于 delete）
  private removeConditional(container: TreeNode, platform: string): void {
    if (platform === COMMON) {
      if (container.type === 'object') {
        container.members = container.members.filter(m => m.condition)
      }
      else if (container.type === 'array') {
        container.elements = container.elements.filter(el => el.condition)
      }
      return
    }
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

  // set(COMMON, data, path) 用：按 key 删除容器中无 condition 的同 key member
  // 数组无 key 概念，全删无 condition 元素
  private removeCommonForSet(container: TreeNode, data: unknown): void {
    if (container.type === 'object') {
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const keys = new Set(Object.keys(data as Record<string, unknown>))
        container.members = container.members.filter(m => m.condition || !keys.has(m.key))
      }
    }
    else if (container.type === 'array') {
      container.elements = container.elements.filter(el => el.condition)
    }
  }

  private addConditional(container: TreeNode, data: unknown, platform: string): void {
    const node = toTreeNode(data)
    const condition = platform === COMMON ? undefined : { kind: 'ifdef' as const, platform }

    if (container.type === 'object') {
      if (node.type !== 'object')
        throw new Error('对象容器需要对象数据')
      for (const m of node.members) {
        container.members.push(condition ? { ...m, condition } : m)
      }
    }
    else if (container.type === 'array') {
      if (node.type !== 'array')
        throw new Error('数组容器需要数组数据')
      for (const el of node.elements) {
        container.elements.push(condition ? { ...el, condition } : el)
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
