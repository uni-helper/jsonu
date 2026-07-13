import { describe, expect, it } from 'vitest'
import { parse } from '../src'
import { jsonu, jsonuBlock } from './fixtures'

describe('stringify', () => {
  it('parse 后 stringify 保持条件块且不重复嵌套', () => {
    const doc = parse(jsonu)
    expect(doc.stringify()).toBe(`{
  "pages": [
    {
      "path": "pages/index",
      "style": {
        "navigationBarTitleText": "默认"
      }
    },
    // #ifdef MP-WEIXIN
    {
      "path": "pages/wx",
      "style": {
        "navigationBarTitleText": "微信"
      }
    },
    // #endif
    {
      "path": "pages/about",
      "style": {
        "navigationBarTitleText": "关于"
      }
    }
  ]
}`)
  })

  it('ifndef + 块注释 stringify 往返保持条件块（统一输出 // 风格）', () => {
    const doc = parse(jsonuBlock)
    expect(doc.stringify()).toBe(`{
  "pages": [
    {
      "path": "pages/index"
    },
    // #ifndef H5
    {
      "path": "pages/native"
    }
    // #endif
  ]
}`)
  })
})
