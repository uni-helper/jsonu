import type { Condition, Path, TreeNode } from './types'
import { parse as momoaParse } from '@humanwhocodes/momoa'
import { matchPlatform, parseConditions } from './conditions'
import { buildTree, evaluateTree, stringifyTree } from './tree'
import { COMMON } from './types'

export class JsonuDocument {
  constructor(private root: TreeNode) {}

  evaluate<T = unknown>(platform: string): T {
    return evaluateTree(this.root, platform) as T
  }

  stringify(indent = 2): string {
    return stringifyTree(this.root, indent)
  }

  // 覆盖：移除该位置该平台已有的条件数据，再写入新的
  // COMMON 走按 key 删的精细语义（避免误清同容器内其他通用配置）
  // 路径不存在时按 data 类型自动创建中间对象/数组
  // 标量 data：把 path 最后一段作为 key，包成单字段对象写入父容器
  set(platform: string, data: unknown, path?: Path): this {
    if (isScalar(data)) {
      const { parentPath, key } = splitScalarPath(path)
      return this.set(platform, { [key]: data }, parentPath)
    }
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
  // 标量 data：把 path 最后一段作为 key，包成单字段对象合并进父容器
  merge(platform: string, data: unknown, path?: Path): this {
    if (isScalar(data)) {
      const { parentPath, key } = splitScalarPath(path)
      return this.merge(platform, { [key]: data }, parentPath)
    }
    const leafType = Array.isArray(data) ? 'array' : 'object'
    const container = this.navigate(path, true, leafType)!
    this.addConditional(container, data, platform)
    return this
  }

  // 路径不存在时 no-op（删除不存在的数据是合法的空操作）
  // options.semantic=true 时按语义匹配（matchPlatform），可删除复合表达式条件块
  delete(platform: string, path?: Path, options?: { semantic?: boolean }): this {
    const container = this.navigate(path, false)
    if (container)
      this.removeConditional(container, platform, options?.semantic)
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

  // 删除条件块
  // semantic=false（默认，set 用）：精确匹配 platform 字段，保证 set 覆盖语义可预期
  // semantic=true（delete 可选）：用 matchPlatform 语义匹配，命中复合表达式（如 'H5 || MP-WEIXIN'）
  // platform === COMMON 时删除无 condition 的通用节点
  private removeConditional(container: TreeNode, platform: string, semantic = false): void {
    if (platform === COMMON) {
      if (container.type === 'object') {
        container.members = container.members.filter(m => m.condition)
      }
      else if (container.type === 'array') {
        container.elements = container.elements.filter(el => el.condition)
      }
      return
    }
    const match = semantic
      ? (cond: Condition) => matchPlatform(cond, platform)
      : (cond: Condition) => cond.platform === platform
    if (container.type === 'object') {
      container.members = container.members.filter(
        m => !(m.condition && match(m.condition)),
      )
    }
    else if (container.type === 'array') {
      container.elements = container.elements.filter(
        el => !(el.condition && match(el.condition)),
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
  return parsePathString(path)
}

// 解析路径字符串，支持 dot / bracket / 引号包裹的 key
// 例: 'pages[0].style' / 'a["b.c"].d' / 'pages.0.style' / "['x']['y']"
// 纯数字段（含 bracket 内）转 number 作数组索引；引号包裹的段保留原始字符串
function parsePathString(str: string): (string | number)[] {
  const result: (string | number)[] = []
  const re = /\['([^']*)'\]|\["([^"]*)"\]|(\d+)|([^.[\]]+)/g
  for (let m = re.exec(str); m !== null; m = re.exec(str)) {
    if (m[1] !== undefined)
      result.push(m[1])
    else if (m[2] !== undefined)
      result.push(m[2])
    else if (m[3] !== undefined)
      result.push(Number(m[3]))
    else if (m[4] !== undefined)
      result.push(m[4])
  }
  return result
}

// 标量叶子写入：path 最后一段作为 key，剩余作为父容器路径
// 要求 path 非空且最后一段是 string（数组索引不支持标量替换）
function splitScalarPath(path: Path | undefined): { parentPath: (string | number)[] | undefined, key: string } {
  const segs = normalizePath(path)
  if (segs.length === 0)
    throw new Error('标量数据需要 path 指定目标 key')
  const last = segs[segs.length - 1]
  if (typeof last !== 'string')
    throw new Error('标量叶子的 path 最后一段必须是 string key（数组请用对象包装）')
  const parent = segs.slice(0, -1)
  return { parentPath: parent.length ? parent : undefined, key: last }
}

function isScalar(value: unknown): boolean {
  return value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
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
