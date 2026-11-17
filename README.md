# 地方麻将规则配置与验证平台

把「每接一种地方玩法就硬写一遍代码」变成「策划在浏览器里配一份规则 JSON」。
规则、引擎、验证、文档全部用 TypeScript 实现，浏览器端与服务端共用同一套引擎，
行为完全一致、可回放、可金手回归。

## 三个硬指标的落地方式

| 指标 | 实现 | 实测 |
| --- | --- | --- |
| 14 张含两赖子，所有拆法 2ms 内穷举 | 锚定 DFS（每步只处理最小剩余牌）+ 热路径零对象分配 + 叶子签名去重，见 `packages/core/src/decompose.ts` | median **0.003–0.06ms**，比指标快 30–500 倍（`npm run bench`） |
| 一炮多响 / 抢杠 / 海底按各地规则分别处理 | 规则集 `events` 开关 + 纯函数裁决器，见 `packages/rules/src/events.ts` | 单测覆盖多响、抢杠目标类型、动作优先级 |
| 十玩法各 50 手人工核验，算番一手不错 | 金手用例格式（manual/derived + reviewer 留痕）+ 独立第二实现交叉复核 + CI 门禁，见 `packages/validate` | 当前 20 手种子全绿，结构直接扩到 10×50 |

## 包结构

```
packages/
  core/       纯牌理引擎，零依赖
    tiles.ts       牌模型与手牌字符串解析（X = 赖子）
    decompose.ts   标准型穷举（4 面子 + 1 将，支持赖子补位）
    special.ts     七对、十三幺
    win.ts         胡牌判定、听牌枚举
    predicates.ts  番种白名单谓词库（纯函数）
    bench/         2ms 性能基准
  rules/      规则 DSL 与计分
    schema.ts      RuleSet 结构（牌池/赖子/胡型/番种/封顶/事件/动作优先级）
    dsl.ts         安全表达式求值（白名单谓词，无 eval）
    fanEngine.ts   番种命中、包含关系、役满封顶、起胡门槛、最大番拆法
    events.ts      一炮多响/抢杠/海底/杠上裁决
    docGen.ts      RuleSet → 运营规则说明 Markdown
    sichuan.ts / guangdong.ts  两份内置地方玩法模板
  validate/   金手回归
    crossCheck.ts  独立划分器（第二实现）交叉复核
    golden/        金手用例（manual 带 reviewer，derived 回归）
    runner.ts      逐手比对，差异精确到字段
  web/        Vite 配置台（规则配置 / 摆牌算番 / 牌墙发牌 / 边角事件 / 金手验证）
```

## 常用命令

```bash
npm install
npm test       # 28 个单元/引擎测试
npm run bench  # 2ms 硬指标基准
npm run golden # 金手回归（退出码可直接挂 CI 门禁）
npm run build  # tsc 严格类型检查 + 编译
npm run web    # 启动浏览器配置台（Vite，端口 5173）
```

## 规则 DSL 长什么样

番种是纯 JSON，条件只能调白名单谓词与内建逻辑运算符，例如：

```json
{
  "id": "qing-yi-se",
  "name": "清一色",
  "value": 8,
  "when": { "kind": "call", "fn": "pureOneSuit", "args": [] },
  "excludes": ["hun-yi-se"],
  "limit": false
}
```

- `excludes` 表达番种包含关系（高番包低番），保存前做存在性与环检测；
- `limit: true` 表达役满，命中即按 `capPoints` 封顶，不再叠加普通番；
- `globalConstraints` 表达地方硬约束（如四川缺门：`suitCount <= 2`）；
- 不同胡型（标准型/七对/十三幺）是不同拆法，引擎各自计分后取最高，
  策划在「摆牌算番」里能看到全部拆番方案与每一种的面子拆解、赖子落槽。

## 接入一个新地方玩法的流程

1. 在 Web 端复制最接近的模板，改牌池/赖子/番种表/事件开关；
2. 点「校验并应用」过静态校验（白名单、番种环、引用完整性）；
3. 「生成运营规则说明」导出 Markdown 给运营评审；
4. 在 `packages/validate/src/golden/` 补该玩法 ≥50 手 manual 金手（双人复核、填 reviewer）；
5. `npm run golden` 零错误后，规则 JSON 入 Git，上线。

## 关键设计取舍

- **引擎只认计数数组不认对象**：14 张牌的穷举热路径上没有任何分配，这是 2ms 余量的来源；
  赖子与自然牌分开计数，`jokerSlots` 精确记录每一张赖子扮演了哪张牌。
- **规则即数据**：没有任何地方玩法写死在引擎里，新增玩法零引擎改动；
  DSL 无 `eval`、无全局对象，浏览器里配的规则可安全在服务端回放。
- **双实现交叉验证**：金手用例同时过主引擎和独立划分器，避免「同一套错误逻辑两边都对」。
- **文档与引擎同源**：运营看到的规则说明由同一份 RuleSet 渲染，杜绝文档与程序各跑一套。
