import type { Node as MomoaNode } from '@humanwhocodes/momoa'
import type {
  ConditionalRange,
  ElementNode,
  MemberNode,
  TreeNode,
} from './types'
import { findRange, matchPlatform } from './conditions'

// momoa AST → 条件树
// inheritedRange: 当前已处于的条件区间，子节点查到同一区间时不重复标记
export function buildTree(node: MomoaNode, ranges: ConditionalRange[], inheritedRange?: ConditionalRange): TreeNode {
  const n = node as any
  switch (n.type) {
    case 'String':
      return { type: 'value', value: n.value }
    case 'Number':
      return { type: 'value', value: n.value }
    case 'Boolean':
      return { type: 'value', value: n.value }
    case 'Null':
      return { type: 'value', value: null }
    case 'Object':
      return {
        type: 'object',
        members: n.members.map((m: any) => {
          const r = findRange(ranges, m.range[0])
          const condition = r && r !== inheritedRange ? r.condition : undefined
          return {
            key: m.name.value,
            value: buildTree(m.value, ranges, r ?? inheritedRange),
            ...(condition ? { condition } : {}),
          } satisfies MemberNode
        }),
      }
    case 'Array':
      return {
        type: 'array',
        elements: n.elements.map((el: any) => {
          const r = findRange(ranges, el.value.range[0])
          const condition = r && r !== inheritedRange ? r.condition : undefined
          return {
            value: buildTree(el.value, ranges, r ?? inheritedRange),
            ...(condition ? { condition } : {}),
          } satisfies ElementNode
        }),
      }
    default:
      throw new Error(`未知的节点类型: ${(node as any).type}`)
  }
}

// 条件树 → 普通 JS 值（按平台裁剪）
export function evaluateTree(node: TreeNode, platform: string): unknown {
  switch (node.type) {
    case 'value':
      return node.value
    case 'object': {
      const result: Record<string, unknown> = {}
      for (const m of node.members) {
        if (m.condition && !matchPlatform(m.condition, platform))
          continue
        // 后出现的同 key member 覆盖前者（uniapp 行为）
        result[m.key] = evaluateTree(m.value, platform)
      }
      return result
    }
    case 'array':
      return node.elements
        .filter(el => !el.condition || matchPlatform(el.condition, platform))
        .map(el => evaluateTree(el.value, platform))
  }
}

// 条件树 → jsonu 字符串
export function stringifyTree(node: TreeNode, indent = 2): string {
  return stringifyNode(node, 1, indent)
}

function stringifyNode(node: TreeNode, depth: number, indent: number): string {
  const pad = ' '.repeat(depth * indent)
  const padEnd = ' '.repeat((depth - 1) * indent)

  switch (node.type) {
    case 'value':
      return JSON.stringify(node.value)
    case 'object': {
      if (node.members.length === 0)
        return '{}'
      const lines = node.members.map((m, i) => {
        const valueStr = stringifyNode(m.value, depth + 1, indent)
        const comma = i < node.members.length - 1 ? ',' : ''
        const line = `${pad}"${m.key}": ${valueStr}${comma}`
        return m.condition
          ? wrapCondition(line, m.condition, pad)
          : line
      })
      return `{\n${lines.join('\n')}\n${padEnd}}`
    }
    case 'array': {
      if (node.elements.length === 0)
        return '[]'
      const lines = node.elements.map((el, i) => {
        const valueStr = stringifyNode(el.value, depth + 1, indent)
        const comma = i < node.elements.length - 1 ? ',' : ''
        const line = `${pad}${valueStr}${comma}`
        return el.condition
          ? wrapCondition(line, el.condition, pad)
          : line
      })
      return `[\n${lines.join('\n')}\n${padEnd}]`
    }
  }
}

// 逗号放在条件块内部（值之后、#endif 之前）
function wrapCondition(line: string, condition: { kind: string, platform: string }, pad: string): string {
  return `${pad}// #${condition.kind} ${condition.platform}\n${line}\n${pad}// #endif`
}
