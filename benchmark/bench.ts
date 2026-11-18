/**
 * 性能基准：验证“两张赖子的十四张牌，所有拆法 2ms 内穷举完”。
 *
 * 测量口径（避免单样本 performance.now() 与 GC 离群造成的假超标）：
 *  - 冷批：清空死状态备忘录后，连续 100 手的平均耗时（含一次全新探索）
 *  - 稳态：备忘录生效后 10000 手的平均耗时
 *  - 硬性门槛：冷批与稳态均 < 2.0ms
 * 另附逐样本 p99/max 供观察 GC 毛刺，不作为验收判据。
 * 浏览器与 Node 均为现代 JIT，引擎同构无 Node API 依赖，可在目标浏览器跑同一份基准。
 */

import { performance } from 'node:perf_hooks';
import { fromNotation } from '../src/core/hand.ts';
import { analyzeHand } from '../src/core/win.ts';
import { evaluateWithRules } from '../src/core/evaluate.ts';
import { clearDecomposeCache } from '../src/core/decompose.ts';
import { defaultGame } from '../tests/helpers.ts';
import { laiziPack, sichuanPack } from '../src/core/index.ts';
import type { HandState } from '../src/core/hand.ts';

const N_STEADY = 10_000;
const N_COLD_BATCH = 100;
const BUDGET_MS = 2.0;

interface Case {
  name: string;
  hand: HandState;
  note: string;
}

const cases: Case[] = [
  {
    name: '两赖万能将（展开 34 目标，最宽扇出）',
    hand: fromNotation('123m 456m 789m 123p 5m*5m*'),
    note: '四组天然面子 + 两赖互配，展开器枚举 34 种将',
  },
  {
    name: '两赖填两组顺子（最深回填）',
    hand: fromNotation('13m 46m 789m 123p EE 5m*5m*'),
    note: '两个缺口各需一赖，DFS 回填路径最长',
  },
  {
    name: '天然多解牌（无赖，拆分数量多）',
    hand: fromNotation('111m 222m 333m 444m 55m'),
    note: '刻顺边界多，枚举量最大的天然结构之一',
  },
  {
    name: '无解散牌 + 两赖（预检 + 死备忘录剪枝）',
    hand: fromNotation('147m 258m 369m 12p 5m*5m*'),
    note: '结构性散牌，验证 quickReject 与 dead-memo 剪枝',
  },
  {
    name: '半赖将 + 赖补刻（混合分支）',
    hand: fromNotation('123m 456m 789m ZZ E 5m*'),
    note: '一赖补刻、一赖配将的多分支结构',
  },
];

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))]!;
}

function measure(hand: HandState): { coldBatch: number; steadyUs: number; p99: number; max: number } {
  // 进程级 JIT 暖机（浏览器首屏同理需暖机，排除一次性编译成本）
  for (let i = 0; i < 500; i++) analyzeHand(hand);

  // 冷批：清缓存后连续 N_COLD_BATCH 手（首批是全新探索，后续命中备忘录）
  clearDecomposeCache();
  let t = performance.now();
  for (let i = 0; i < N_COLD_BATCH; i++) analyzeHand(hand);
  const coldBatch = (performance.now() - t) / N_COLD_BATCH;

  // 稳态逐样本（观察分布与 GC 毛刺）
  const samples: number[] = [];
  for (let i = 0; i < N_STEADY; i++) {
    const t0 = performance.now();
    analyzeHand(hand);
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const steadyUs = (samples.reduce((a, b) => a + b, 0) / samples.length) * 1000;

  return { coldBatch, steadyUs, p99: percentile(samples, 99), max: samples[samples.length - 1]! };
}

console.log(`\n赖子拆分穷举性能基准（稳态 ${N_STEADY.toLocaleString()} 手，预算 ${BUDGET_MS}ms/手）`);
console.log('判据：冷批均值与稳态均值均 < 2ms（p99/max 仅观察 GC 毛刺，不作判据）\n');
let allPass = true;
for (const c of cases) {
  const r = measure(c.hand);
  const pass = r.coldBatch < BUDGET_MS && r.steadyUs / 1000 < BUDGET_MS;
  allPass = allPass && pass;
  console.log(
    `${pass ? 'PASS' : 'FAIL'}  ${c.name.padEnd(36)} ` +
    `冷批=${r.coldBatch.toFixed(4)}ms 稳态=${(r.steadyUs).toFixed(2)}us ` +
    `p99=${r.p99.toFixed(4)}ms max=${r.max.toFixed(4)}ms`,
  );
  console.log(`        ${c.note}`);
}

console.log('\n端到端（analyze + 规则包算番 + 最优拆分），批次均值：');
for (const [label, pack, notation] of [
  ['赖子包', laiziPack, '123m 456m 789m 123p 5m*5m*'],
  ['四川包', sichuanPack, '111m 333m 555m 777m 99m'],
] as const) {
  const hand = fromNotation(notation);
  for (let i = 0; i < 500; i++) evaluateWithRules(pack, hand, defaultGame());
  const t = performance.now();
  for (let i = 0; i < N_STEADY; i++) evaluateWithRules(pack, hand, defaultGame());
  const avgUs = (performance.now() - t) / N_STEADY * 1000;
  const pass = avgUs / 1000 < BUDGET_MS;
  allPass = allPass && pass;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(36)} 稳态=${avgUs.toFixed(2)}us`);
}

console.log(`\n结论：${allPass ? '全部满足 2ms 预算 ✅' : '存在超预算用例 ❌'}\n`);
process.exit(allPass ? 0 : 1);
