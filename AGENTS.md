# jsonu

`@uni-helper/jsonu`：解析 uni-app 的 JSON 条件编译。把 `pages.json` 里 `#ifdef` / `#ifndef` / `#endif` 注释包围的 JSON 文本读成条件树，之后按平台裁剪（`evaluate`）、按平台增删（`set` / `merge` / `delete`），或写回带注释的文本（`stringify`）。

## Project

- TypeScript，`strict`，`verbatimModuleSyntax`，`noEmit`（`tsconfig.json`）。
- 纯 ESM，单一入口 `src/index.ts`，产物 `dist/index.mjs` + `dist/index.d.mts`。`exports`、`main`、`types`、`inlinedDependencies` 都由 tsdown 的 `exports: true` 写回，不要手改。
- 没有运行时依赖。`@humanwhocodes/momoa` 在 devDependencies 里，构建时整个打进 bundle（日志会打印 `Detected dependencies in bundle`），升级只改 catalog。
- 包管理器 pnpm 12.18.0（`packageManager`）。Node 版本未固定，CI 跑 22 / 24 / 26。
- `pnpm-workspace.yaml` 没有工作区成员，只提供 `catalog:` 版本表和 `allowBuilds`。所有依赖版本写在那里，`package.json` 用 `catalog:cli` 之类的协议引用；直接写版本号无效。
- 构建：tsdown（rolldown 内核），`tsdown.config.ts` 里开了 `dts` / `exports` / `publint`，并挂了 `StaleGuardRecorder()` 插件。`dist/` 已 gitignore。

## Commands

```bash
pnpm install            # 安装依赖；prepare 跑 skills-npm，在仓库根铺 skills/ 和 agent 目录（软链接，可删可重建）
pnpm run build          # tsdown → dist/，同时跑 publint 校验
pnpm run dev            # tsdown --watch
pnpm run test           # 先 build 再 vitest（CI 的调用方式）
pnpm exec vitest run    # 只跑测试，不进监听模式（`run` 关闭 watch）
pnpm exec vitest run test/evaluate.test.ts   # 单文件
pnpm run lint           # eslint，覆盖 ts / md / json / yaml
pnpm run lint:fix       # eslint --fix
pnpm run typecheck      # tsc --noEmit
pnpm run release        # bumpp：改版本、提交、打 tag（维护者用）
```

测试 `import { parse } from '../src'`，跑源码，不依赖 `dist/`。`pnpm run test` 里的 build 是为了顺带验证入口、类型声明和 publint。

## Architecture

| 文件 | 职责 |
| --- | --- |
| `src/index.ts` | `parse` 与 `JsonuDocument`：`evaluate` / `stringify` / `set` / `merge` / `delete`，私有的 `navigate`（路径定位与自动创建）、`removeConditional`、`removeCommonForSet`、`addConditional` |
| `src/conditions.ts` | `parseConditions`（注释 token → 条件区间）、`findRange`（按 offset 取最内层区间）、`matchPlatform`（按平台判断条件是否生效，`ifndef` 取反） |
| `src/tree.ts` | `buildTree`（momoa AST → 条件树）、`evaluateTree`、`stringifyTree` |
| `src/types.ts` | `Condition` / `TreeNode` / `MemberNode` / `ElementNode` / `ConditionalRange` / `Path`，以及 `COMMON = '*'` |

数据流：`parse` → momoa（jsonc、ranges、tokens）→ `parseConditions` → `buildTree` → 树；消费端是 `evaluate`（树 → 普通值）和 `stringify`（树 → 文本）。

### 条件标记的挂载规则

- 条件只挂在 `MemberNode` / `ElementNode` 上，`value` / `object` / `array` 节点自己不带条件。`buildTree` 用 `inheritedRange` 去重，子节点查到同一区间时不再重复标记，所以条件只出现在最外层节点上。
- 嵌套条件块能解析，但语义是拍平的：`evaluate` 只看节点最内层的条件，外层条件不参与判断；`stringify` 把嵌套输出成同级块。已有行为，改之前先确认这是不是要修的 bug。
- 区间靠 comment token 的字节偏移配对，`findRange` 取最内层命中。注释指令正则要求严格格式：`// #ifdef X`、`/* #ifdef X */`、`// #endif`、`/* #endif */`，前面多空格或 `#endif` 后面跟文字都不匹配。

### 写入语义

- `navigate(path, create, leafType)`：`create=true` 时按 `leafType` 建节点，类型不符或数组索引跳号直接抛错；`create=false`（`delete` 用）返回 `undefined`，`delete` 因此是空操作而不是抛错。
- 标量 `data` 先经 `splitScalarPath` 变成 `{ [key]: data }`，效果等同单字段对象；`path` 为空或最后一段是数字时抛错。
- `removeConditional` 有两种匹配：默认精确比较 `cond.platform === platform`（`set` 用，覆盖范围可预期），`semantic: true` 走 `matchPlatform`（`delete` 可传）。改一处要同时检查另一处。
- `platform === COMMON` 时走独立分支：`removeCommonForSet` 按 key 删同名无条件成员，数组容器全删无条件元素；`removeConditional` 的 COMMON 分支删掉该位置全部无条件成员或元素，是整段清空。

### 序列化不变量

- 逗号只跟随节点顺序输出，不增不减：条件块的逗号放在块内部（值之后、`#endif` 之前）。输入必须保证条件块剔除前后都是合法 JSON，否则会留下悬空逗号。
- 输出统一 `//` 注释，`/* */` 输入会被改写；非条件注释和原始缩进丢失，往返非无损。
- 空对象输出 `{}`、空数组输出 `[]`，其余按 `indent`（默认 2）分层，第一层缩进就是 `indent`。

## Conventions

- ESLint 用 `@antfu/eslint-config`（`type: 'lib'`，`pnpm: true`，关了 `ts/explicit-function-return-type`），不使用 Prettier。风格问题交给 `pnpm run lint:fix`，`.vscode/settings.json` 已配置保存时自动修。
- 注释和测试标题用中文，简短说明「为什么」。类型定义和对外 API 的注释留在 `src/types.ts` 与 `src/index.ts`。
- 测试按能力分文件（`evaluate` / `set` / `merge` / `delete` / `delete-semantic` / `stringify` / `scalar-leaf` / `path-autocreate` / `ifndef-block-comment` / `common`），无快照。期望值手写，不要用 `-u` 覆盖失败输出。
- 提交信息遵循 Conventional Commits（`feat` / `fix` / `docs` / `chore` / `ci` / `refactor`，破坏性变更用 `!`）。仓库没有 git 钩子，提交前手动跑 `pnpm run lint && pnpm run typecheck && pnpm run test`。
- 不要手改 `dist/` 和 `pnpm-lock.yaml`；不要手动 `npm publish`，发布走 `pnpm run release` + tag。
