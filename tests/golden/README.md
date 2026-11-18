# 黄金牌局套件（Golden Cases）

每种地方玩法一个 JSON 文件，文件名即规则包 `id`（见 `src/rules/*.ts`）。
每一手牌的 `expected` 字段都由人工核对，CI 中逐手比对——**算番一手都不能错**。

## 扩量到 10 种玩法 × 50 手

1. 在 `src/rules/` 新增规则包并在 `golden.test.ts` 的 `PACKS` 注册表登记；
2. 复制任一现有 JSON，按下面的字段格式填入 50 手人工核对牌局；
3. 文件放到本目录，命名为 `<规则包 id>.json`，运行 `npm run golden` 即可，测试代码无需改动。

## 字段说明

| 字段 | 含义 |
| --- | --- |
| `hand` | 记号法手牌，如 `123m 456p EES 5m*5m*`（`*` 后缀表示赖子） |
| `wildcards` | 赖子张数（测试会校验与记号解析结果一致） |
| `game` | 牌局上下文：胡法、明/暗杠、明露面子、海底、定缺花色 |
| `isWin` | 是否构成胡牌结构 |
| `expectedFanTotal` | 封顶后的番值合计 |
| `expectedFanIds` | 命中番种 id 集合 |
| `canWinExpected` | 是否达到起胡番线（可选，默认不校验） |
| `structuralReject` | 结构性拒绝原因，目前支持 `missingSuit`（未定缺） |
| `assertContainsOnly` | `false` 时只校验 `expectedFanIds` 被包含（允许同时命中其他小番）；默认严格相等 |

## 记号法速查

- 数牌：数字 + 花色后缀，`m`=万 `s`=条 `p`=筒，连写如 `123m`；
- 字牌：`E`东 `S`南 `W`西 `N`北 `Z`中 `F`發 `B`白，连写如 `ESWN`；
- 赖子：牌记号后加 `*`，如 `5m*`，两张写 `5m*5m*`。
