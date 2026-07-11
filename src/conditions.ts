import type { Condition, ConditionalRange } from './types'

// 指令正则（同时支持 // 和 /* */ 注释）
// 行注释: // #ifdef PLATFORM
// 块注释: /* #ifdef PLATFORM */
const RE_IFDEF = /^\/\/ #ifdef (\S.*)$|^\/\* #ifdef (\S.*?) \*\/$/
const RE_IFNDEF = /^\/\/ #ifndef (\S.*)$|^\/\* #ifndef (\S.*?) \*\/$/
const RE_ENDIF = /^\/\/ #endif$|^\/\* #endif \*\/$/

interface CommentToken {
  range: [number, number]
  text: string
}

// 从 comment tokens 解析出条件区间
export function parseConditions(tokens: CommentToken[]): ConditionalRange[] {
  const ranges: ConditionalRange[] = []
  const stack: { condition: Condition, start: number }[] = []

  for (const token of tokens) {
    const text = token.text

    const ifdef = text.match(RE_IFDEF)
    const ifndef = text.match(RE_IFNDEF)
    const endif = text.match(RE_ENDIF)

    if (ifdef) {
      stack.push({
        condition: { kind: 'ifdef', platform: (ifdef[1] ?? ifdef[2]).trim() },
        start: token.range[1], // 注释结束位置
      })
    }
    else if (ifndef) {
      stack.push({
        condition: { kind: 'ifndef', platform: (ifndef[1] ?? ifndef[2]).trim() },
        start: token.range[1],
      })
    }
    else if (endif) {
      const top = stack.pop()
      if (!top)
        throw new Error('多余的 #endif')
      ranges.push({
        start: top.start,
        end: token.range[0], // #endif 注释开始位置
        condition: top.condition,
      })
    }
  }

  if (stack.length > 0)
    throw new Error(`未闭合的 #${stack[stack.length - 1].condition.kind}`)

  return ranges
}

// 判断 offset 是否落在某个条件区间内，返回该区间（取最内层）
export function findRange(ranges: ConditionalRange[], offset: number): ConditionalRange | undefined {
  let match: ConditionalRange | undefined
  for (const r of ranges) {
    if (offset >= r.start && offset <= r.end) {
      // 取最内层（后出现的嵌套更深）
      if (!match || (r.start >= match.start && r.end <= match.end))
        match = r
    }
  }
  return match
}

// 平台匹配：判断当前平台是否满足条件表达式
// 表达式只有 ||，如 'H5 || MP-WEIXIN'
export function matchPlatform(condition: Condition, platform: string): boolean {
  const platforms = condition.platform.split('||').map(p => p.trim())
  const hit = platforms.includes(platform)
  return condition.kind === 'ifdef' ? hit : !hit
}
