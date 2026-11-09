<a href="https://github.com/uni-helper/jsonu"><img src="https://cdn.jsdelivr.net/gh/uni-helper/jsonu@main/banner.svg" alt="banner" width="100%"/></a>

# @uni-helper/jsonu

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/uni-helper/jsonu@main/logo.svg" alt="logo" width="256" height="256" />
</p>

<p align="center">
  <a href="https://github.com/uni-helper/jsonu/blob/main/LICENSE"><img src="https://img.shields.io/github/license/uni-helper/jsonu?style=for-the-badge&labelColor=005947&color=eee" alt="License"></a>
  <a href="https://github.com/uni-helper/jsonu/stargazers"><img src="https://img.shields.io/github/stars/uni-helper/jsonu?style=for-the-badge&labelColor=005947&color=eee" alt="GitHub Stars"></a>
  <a href="https://npmx.dev/package/@uni-helper/jsonu"><img src="https://img.shields.io/npm/v/@uni-helper/jsonu?style=for-the-badge&labelColor=005947&color=eee" alt="NPM version"></a>
  <a href="https://npmx.dev/package/@uni-helper/jsonu"><img src="https://img.shields.io/npm/dm/@uni-helper/jsonu?style=for-the-badge&labelColor=005947&color=eee" alt="npm downloads"></a>
</p>
<p align="center">
  <a href="https://github.com/FliPPeDround"><img src="https://img.shields.io/badge/Author-FliPPeDround-blue?style=for-the-badge" alt="Author"></a>
</p>

解析 uni-app 的 JSON 条件编译：读取 `pages.json` 等文件里的 `#ifdef` / `#ifndef` / `#endif` 注释，按平台裁剪、增删数据，再写回带注释的文本。

不想看文档？直接问 AI 🤖 <a href="https://deepwiki.com/uni-helper/jsonu"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>

> **请考虑持续[赞助](https://afdian.com/a/flippedround)以维持该项目的持续健康发展，非常感谢！🙏**

## 目录

- [简介](#简介)
- [安装](#安装)
- [快速开始](#快速开始)
- [使用](#使用)
- [API 参考](#api-参考)
- [注意事项](#注意事项)
- [参与贡献](#参与贡献)
- [许可证](#许可证)

## 简介

uni-app 的条件编译写在注释里，编译时按平台剔除不生效的块。要在构建脚本里读或改 `pages.json`，就得自己认注释、判断平台。

`@uni-helper/jsonu` 把这类文本解析成带条件标记的树：按平台求出普通对象、按平台写入数据、再序列化回带注释的 JSON。一个文件管所有平台，不必按平台维护多份。

## 安装

```bash
pnpm add @uni-helper/jsonu
```

## 快速开始

```ts
import { parse } from '@uni-helper/jsonu'

const doc = parse(`{
  "pages": [
    { "path": "pages/index" },
    // #ifdef MP-WEIXIN
    { "path": "pages/wx" },
    // #endif
    { "path": "pages/about" }
  ]
}`)

doc.evaluate('H5')
// { pages: [{ path: 'pages/index' }, { path: 'pages/about' }] }

doc.evaluate('MP-WEIXIN')
// { pages: [
//   { path: 'pages/index' },
//   { path: 'pages/wx' },
//   { path: 'pages/about' }
// ] }
```

## 使用

### 条件注释

`//` 和 `/* */` 两种写法都认：

```js
// #ifdef MP-WEIXIN
/* #ifdef MP-WEIXIN */
```

`#ifndef` 的判断反过来：除了列出的平台都保留。`#endif` 不带平台名。指令必须成对，`parse` 遇到未闭合的 `#ifdef` 或多出来的 `#endif` 会抛错。

### 按平台裁剪

`evaluate` 返回普通 JS 值，条件注释全部消掉。平台名与 uni-app 的条件编译平台一致：`H5`、`MP-WEIXIN`、`APP-PLUS` 等。多平台用 `||` 连接，如 `#ifdef H5 || MP-WEIXIN`。

返回类型可以指定，便于调用方收窄：

```ts
interface PageConfig { path: string, style?: Record<string, unknown> }

const config = doc.evaluate<{ pages: PageConfig[] }>('MP-WEIXIN')
```

### 按平台写入

`set` / `merge` 接收 `platform`、`data` 和可选的 `path`，`delete` 接收 `platform`、可选的 `path` 和 `options`。省略 `path` 时操作根级。

**`set`** 覆盖：先清掉该位置该平台已有的条件数据，再写入新的。

```ts
doc.set('MP-WEIXIN', {
  globalStyle: { navigationBarTitleText: '微信' }
})
doc.set('MP-WEIXIN', { navigationBarTitleText: '微信' }, ['pages', 0, 'style'])
```

**`merge`** 增量：保留已有条件数据。对象追加成员，数组追加元素，同 key 时后出现的生效。

```ts
doc.merge('MP-WEIXIN', [
  { path: 'pages/wx2' }
], ['pages'])
doc.merge('MP-WEIXIN', { navigationBarTitleText: '微信' }, ['pages', 0, 'style'])
```

**`delete`** 删除该位置该平台的条件数据：

```ts
doc.delete('MP-WEIXIN', ['pages'])
```

`options.semantic` 决定怎么算“匹配”：

- `false`（默认）精确比较 `platform` 字段。`#ifdef H5 || MP-WEIXIN` 的块不会被 `delete('MP-WEIXIN')` 删掉，因为表达式字符串不相等。`set` 覆盖时也用这个规则，覆盖范围可预期。
- `true` 按语义匹配，判断条件块在指定平台是否生效。复合表达式（`H5 || MP-WEIXIN`）和命中的 `#ifndef` 块都能删除。

```ts
// 精确：删不掉 #ifdef H5 || MP-WEIXIN 块
doc.delete('MP-WEIXIN', ['pages'])

// 语义：删掉所有在 MP-WEIXIN 生效的条件块
doc.delete('MP-WEIXIN', ['pages'], { semantic: true })
```

**路径**只接受数组形式，每段为 `string`（对象 key）或 `number`（数组索引），不支持 `'pages.0.style'` 这样的字符串路径。含点号、空格的 key 直接当字符串段传，不用转义：

```ts
doc.set('MP-WEIXIN', { navigationBarTitleText: '微信' }, ['pages', 0, 'style'])
```

**标量**可以直接写。`data` 为 string / number / boolean / null 时，`path` 最后一段作为 key 写入父容器，等价于单字段对象：

```ts
// 以下两行等价
doc.set('MP-WEIXIN', '微信', [
  'pages',
  0,
  'style',
  'navigationBarTitleText'
])
doc.set('MP-WEIXIN', { navigationBarTitleText: '微信' }, ['pages', 0, 'style'])
```

标量写入要求 `path` 非空，且最后一段是 string。数组索引不能用标量替换，请用对象包装。

**路径不存在时按 `data` 的类型自动创建中间节点**，对象数据创建对象，数组数据创建数组。数组只允许追加到末尾，跳过索引会抛错。

### 通用配置（COMMON）

不带条件编译的配置传 `COMMON` 作为 `platform`：

```ts
import { COMMON, parse } from '@uni-helper/jsonu'

doc.set(COMMON, {
  globalStyle: { navigationBarTitleText: '通用标题' }
})
doc.set(COMMON, { navigationBarTitleText: '通用' }, ['pages', 0, 'style'])
doc.merge(COMMON, [
  { path: 'pages/common' }
], ['pages'])

// 清空 pages 下所有无条件数据，见下方说明
doc.delete(COMMON, ['pages'])
```

`COMMON` 的值是 `'*'`，三个方法对它的处理各不相同：

- `set(COMMON, data, path?)`：按 key 替换容器里同名的无条件成员，不动同容器其它 key。数组容器则清掉所有无条件元素再追加。
- `merge(COMMON, data, path?)`：直接追加无条件的成员或元素。
- `delete(COMMON, path?)`：删掉该位置所有无条件成员或元素。⚠️ 这是整段清空，和 `delete('MP-WEIXIN', path)` 清空该平台数据的效果一样。

`evaluate` 对所有平台都保留无条件节点。

### 写回

`stringify` 输出带条件注释的文本，`indent` 默认 `2`：

```ts
doc.stringify()
```

### 完整示例

```ts
import { parse } from '@uni-helper/jsonu'

const doc = parse(`{
  "pages": [
    { "path": "pages/index", "style": { "navigationBarTitleText": "默认" } }
  ]
}`)

// 给微信小程序加一个页面
doc.merge('MP-WEIXIN', [
  {
    path: 'pages/wx',
    style: { navigationBarTitleText: '微信' }
  }
], ['pages'])

// 在 style 内追加条件成员，同 key 覆盖
doc.set('MP-WEIXIN', { navigationBarTitleText: '微信首页' }, ['pages', 0, 'style'])

console.log(doc.stringify())
// {
//   "pages": [
//     {
//       "path": "pages/index",
//       "style": {
//         "navigationBarTitleText": "默认",
//         // #ifdef MP-WEIXIN
//         "navigationBarTitleText": "微信首页"
//         // #endif
//       }
//     },
//     // #ifdef MP-WEIXIN
//     {
//       "path": "pages/wx",
//       "style": {
//         "navigationBarTitleText": "微信"
//       }
//     }
//     // #endif
//   ]
// }

doc.evaluate('H5')
// { pages: [{ path: 'pages/index', style: { navigationBarTitleText: '默认' } }] }

doc.evaluate('MP-WEIXIN')
// { pages: [
//   { path: 'pages/index', style: { navigationBarTitleText: '微信首页' } },
//   { path: 'pages/wx', style: { navigationBarTitleText: '微信' } }
// ] }
```

## API 参考

| 导出 | 签名 | 说明 |
| --- | --- | --- |
| `parse` | `(jsonu: string) => JsonuDocument` | 解析文本；指令不成对、JSON 语法错误时抛错 |
| `JsonuDocument` | `class` | `parse` 的返回值类型，下面的方法都挂在它上面 |
| `COMMON` | `'*'` | 表示不带条件的通用配置 |
| `doc.evaluate` | `<T = unknown>(platform: string) => T` | 按平台裁剪，返回普通 JS 值 |
| `doc.stringify` | `(indent = 2) => string` | 序列化为带条件注释的文本 |
| `doc.set` | `(platform, data, path?) => this` | 覆盖写入 |
| `doc.merge` | `(platform, data, path?) => this` | 增量写入 |
| `doc.delete` | `(platform, path?, options?) => this` | 删除条件数据，`options` 为 `{ semantic?: boolean }` |
| `evaluateTree` | `(node: TreeNode, platform: string) => unknown` | 树层裁剪，`doc.evaluate` 的底层实现 |
| `stringifyTree` | `(node: TreeNode, indent = 2) => string` | 树层序列化，`doc.stringify` 的底层实现 |

### 类型

`parse` 之外还会导出这些类型，自定义树操作时会用到：

| 类型 | 定义 |
| --- | --- |
| `Path` | `(string \| number)[]` |
| `Condition` | `{ kind: 'ifdef' \| 'ifndef', platform: string }` |
| `TreeNode` | `{ type: 'value', value }` \| `{ type: 'object', members }` \| `{ type: 'array', elements }` |
| `MemberNode` | `{ key: string, value: TreeNode, condition?: Condition }` |
| `ElementNode` | `{ value: TreeNode, condition?: Condition }` |
| `ConditionalRange` | `{ start: number, end: number, condition: Condition }` |

## 注意事项

- **逗号策略**：只剔除条件节点，不修正逗号。输入要保证编译前后都是合法 JSON。
- **同 key 覆盖**：`evaluate` 在同一容器里遇到重复 key 时，后出现的值生效（与 `JSON.parse` 一致）。
- **`stringify` 非无损**：统一输出 `//` 风格注释，即使输入用的是 `/* */`。非条件注释、原始缩进都会丢失。
- **嵌套条件会拍平**：`stringify` 把嵌套的 `#ifdef` 输出成同级块；`evaluate` 只看节点最内层的条件，外层条件不参与判断。
- **只产出 `#ifdef`**：`set` / `merge` 不会生成 `#ifndef` 块，需要时手工编辑源文件。
- **平台名大小写敏感**：`set('mp-weixin', ...)` 会生成 `#ifdef mp-weixin`，而 `evaluate('MP-WEIXIN')` 匹配不到。
- **类型不匹配就抛错**：容器类型与 `data` 不符（如往对象容器写数组）、数组索引越界、路径指向标量，都会抛错而不是静默跳过。`delete` 是例外，路径不存在时什么都不做。

## 参与贡献

请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解本地开发、测试和提交规范。

## 许可证

[MIT](./LICENSE) License © [uni-helper](https://github.com/uni-helper)
