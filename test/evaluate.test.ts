import { describe, expect, it } from 'vitest'
import { parse } from '../src'
import { jsonu } from './fixtures'

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
