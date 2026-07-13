import { describe, expect, it } from 'vitest'
import { parse } from '../src'
import { jsonuBlock } from './fixtures'

describe('ifndef + 块注释', () => {
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
})
