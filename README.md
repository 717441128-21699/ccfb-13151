# 地方麻将规则配置与验证平台

策划在浏览器里配置地方玩法(牌墙、赖子、吃碰杠优先级、胡牌牌型、番种及包含关系、封顶),
平台即时生成给运营看的规则说明;任意一手牌摆上桌即可验算:能不能胡、几番、哪种拆法番最大。

## 快速开始

```bash
npm install
npm test          # 全部测试:拆牌/算番/边角规则/性能/fixture 牌局
npm run harness   # 只跑牌局验证装置(packages/harness/fixtures/*.json)
npm run web       # 构建并启动平台 → http://localhost:8420/apps/web/
```

## 目录结构

```
packages/
  core/                 纯 TS 规则引擎,零依赖,浏览器/Node 同构
    src/tiles.ts        牌型编码(34 种 + 8 花),解析/格式化
    src/decompose.ts    带赖子的标准结构全拆法穷举
    src/structures.ts   七对、十三幺(同样支持赖子)
    src/rule.ts         RulePack:一种地方玩法的全部可配维度
    src/predicates.ts   番种谓词库(碰碰胡/清一色/海底捞/缺门/将将胡…)
    src/evaluate.ts     算番流水线:命中 → 不计关系 → 封顶 → 取最大番拆法
    src/table.ts        桌级边角:一炮多响/截胡、抢杠范围、吃碰杠胡优先级
    src/docgen.ts       规则包 → 运营版规则说明(Markdown)
    src/wall.ts         按配置砌牌墙、洗牌、发牌
  rulepacks/            内置玩法:武汉(赖子)/四川血战/国标核心/广东鸡平胡/长沙
  harness/
    fixtures/*.json     人工核过的牌局(每玩法一个文件)
    run.ts              验证装置:逐手比对,任何一手不符退出码 1
apps/web/               浏览器平台:牌桌验算 / 规则配置 / 规则说明
```

## 三项硬指标的对账

**1. 两张赖子十四张牌,全拆法 2ms 内穷举完**
`packages/core/test/bench.test.ts`:3000 手(半数构造必胡牌)实测
avg ≈ 0.02ms,p99 ≈ 0.2ms,max < 1ms,单手最多枚举 41 种拆法。
算法:先枚举"赖子当自身"的分配(硬胡需要),再定将、递归剥离面子
(每张真牌可用 0-2 张赖子补齐),剩余赖子自成面子;按抽象结构去重。

**2. 一炮多响 / 抢杠胡 / 海底捞月按各地规则分开处理**
全部收敛到 `RulePack.edge` 配置 + `WinContext` 上下文:
- `edge.yiPaoDuoXiang`:true 多家同胡(四川/广东),false 截胡取最近(国标)→ `table.ts resolveDiscardWinners`
- `edge.qiangGangHu`:'none' | 'addedKong'(只抢补杠,武汉/国标)| 'all' → `table.ts canRobKong`
- 海底捞月 / 河底捞鱼 / 杠上开花:各玩法独立开关,由 ctx 标志触发对应番种

**3. 十种玩法各五十手人工核过的牌局,一手都不能错**
装置已就绪:`packages/harness/fixtures/` 每个玩法一个 JSON,
格式见现有 5 个文件(共 32 手已全部核对通过)。把人工核过的牌局按同格式
补到 10 个玩法 × 50 手,`npm run harness` 任何一手不符即退出码 1 并打印差异
(期望/实际的胡牌判定、总番、番种清单)。fixture 里 `expect.fans` 可选,
只写 `totalFan` 也行,便于先粗后细地录入。

## 接一种新玩法要做什么

1. 在 `packages/rulepacks/src/` 复制一个现有规则包改配置(纯数据,无新代码):
   牌墙构成、赖子(牌型/能否当自身/能否打出)、胡牌结构、番种表
   (谓词 + 参数 + `excludes` 不计关系)、封顶、优先级、边角开关。
2. 番种判定从 `predicates.ts` 谓词库选(30+ 个);库里没有的,
   用规则包的 `customPredicates` 加一个函数(代码级扩展点)。
3. 在浏览器"规则配置"页改 JSON → 校验 → 应用,当场摆牌验证;
   "规则说明"页一键导出给运营。
4. 把人工核过的牌局写进 fixtures,纳入 `npm test`。

## 已知边界

- 番种库覆盖了主流番型;极地方化的番型(如某些"飘""报听"玩法)走 customPredicates。
- 赖子张数 >4 时"剩余赖子自成面子"的枚举分支会变多,2ms 指标按 2 赖子验收。
- 计分公式目前支持:番数累加、2^番翻倍、分数累加(国标);更复杂的
  底分×倍数表可在 `evaluate.ts` 的 payout 处扩展。
