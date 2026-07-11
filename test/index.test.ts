import { describe, expect, it } from 'vitest'
import { parse } from '../src'

const jsonu = /* jsonu */`{
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
}
`

describe('evaluate', () => {
  it('h5 平台：剔除 MP-WEIXIN 条件块', () => {
    const doc = parse(jsonu)
    expect(doc.evaluate('H5')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '默认' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
      ],
    })
  })

  it('mP-WEIXIN 平台：保留条件块', () => {
    const doc = parse(jsonu)
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '默认' } },
        { path: 'pages/wx', style: { navigationBarTitleText: '微信' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
      ],
    })
  })
})

describe('stringify 往返', () => {
  it('parse 后 stringify 保持条件块且不重复嵌套', () => {
    const doc = parse(jsonu)
    const text = doc.stringify()
    expect(text).toBe(`{
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
})

describe('set / merge / delete', () => {
  it('set 在根级覆盖平台数据', () => {
    const doc = parse(jsonu)
    doc.set('MP-WEIXIN', { globalStyle: { navigationBarTitleText: '微信全局' } })
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '默认' } },
        { path: 'pages/wx', style: { navigationBarTitleText: '微信' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
      ],
      globalStyle: { navigationBarTitleText: '微信全局' },
    })
    expect(doc.evaluate('H5')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '默认' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
      ],
    })
  })

  it('merge 往 pages 数组追加条件元素', () => {
    const doc = parse(jsonu)
    doc.merge('MP-WEIXIN', [{ path: 'pages/wx2', style: { navigationBarTitleText: '微信2' } }], 'pages')
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '默认' } },
        { path: 'pages/wx', style: { navigationBarTitleText: '微信' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
        { path: 'pages/wx2', style: { navigationBarTitleText: '微信2' } },
      ],
    })
  })

  it('set 在嵌套路径覆盖', () => {
    const doc = parse(jsonu)
    doc.set('MP-WEIXIN', { navigationBarTitleText: '微信标题' }, ['pages', 0, 'style'])
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '微信标题' } },
        { path: 'pages/wx', style: { navigationBarTitleText: '微信' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
      ],
    })
    expect(doc.evaluate('H5')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '默认' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
      ],
    })
  })

  it('delete 移除指定平台的条件数据', () => {
    const doc = parse(jsonu)
    doc.delete('MP-WEIXIN', 'pages')
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '默认' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
      ],
    })
  })

  it('delete 不误删 ifndef 等非目标平台的条件块', () => {
    const doc = parse(`{
      "pages": [
        { "path": "pages/index" },
        // #ifndef H5
        { "path": "pages/native" }
        // #endif
      ]
    }`)
    doc.delete('MP-WEIXIN', 'pages')
    // ifndef H5 块应保留（它的 platform 字段是 'H5'，不是 'MP-WEIXIN'）
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [
        { path: 'pages/index' },
        { path: 'pages/native' },
      ],
    })
    // 再 delete('H5') 才会移除 ifndef H5 块
    doc.delete('H5', 'pages')
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [{ path: 'pages/index' }],
    })
  })

  it('set 后 stringify 输出带条件注释', () => {
    const doc = parse(jsonu)
    doc.set('MP-WEIXIN', { globalStyle: { navigationBarTitleText: '微信' } })
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
  ],
  // #ifdef MP-WEIXIN
  "globalStyle": {
    "navigationBarTitleText": "微信"
  }
  // #endif
}`)
  })
})

describe('ifndef + BlockComment', () => {
  const jsonuBlock = /* jsonu */`{
  "pages": [
    {
      "path": "pages/index"
    },
    /* #ifndef H5 */
    {
      "path": "pages/native"
    }
    /* #endif */
  ]
}`

  it('h5 平台：ifndef H5 剔除条件块', () => {
    const doc = parse(jsonuBlock)
    expect(doc.evaluate('H5')).toEqual({
      pages: [
        { path: 'pages/index' },
      ],
    })
  })

  it('mP-WEIXIN 平台：ifndef H5 保留条件块', () => {
    const doc = parse(jsonuBlock)
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [
        { path: 'pages/index' },
        { path: 'pages/native' },
      ],
    })
  })

  it('stringify 往返保持条件块', () => {
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
