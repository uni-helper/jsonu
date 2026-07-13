// 条件编译指令类型
export interface Condition {
  kind: 'ifdef' | 'ifndef'
  // 平台表达式，如 'MP-WEIXIN' 或 'H5 || MP-WEIXIN'（只有 ||，无 &&）
  platform: string
}

// 条件树节点
export type TreeNode
  = | { type: 'value', value: string | number | boolean | null }
    | { type: 'object', members: MemberNode[] }
    | { type: 'array', elements: ElementNode[] }

export interface MemberNode {
  key: string
  value: TreeNode
  condition?: Condition
}

export interface ElementNode {
  value: TreeNode
  condition?: Condition
}

// 指令解析出的条件区间（基于 offset）
export interface ConditionalRange {
  start: number // #ifdef 注释的 endOffset
  end: number // #endif 注释的 startOffset
  condition: Condition
}

// 路径
export type Path = (string | number)[]

// 与平台无关的配置标识
// 当 set/merge/delete 的 platform 传此值时，操作的是不带条件编译的通用节点
export const COMMON = '*'
