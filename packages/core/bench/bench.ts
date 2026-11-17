/**
 * 2ms 硬指标基准：14 张含两张赖子的牌，穷举全部拆法。
 * 输出各牌例的 min/median/p95/max 与拆法数量。
 */
import { performance } from 'node:perf_hooks';
import { parseHand, totalTiles } from '../src/tiles.ts';
import { enumerateStandard } from '../src/decompose.ts';
import { checkWin } from '../src/win.ts';

const CASES: Array<{ name: string; hand: string }> = [
  { name: '高分支中张连对 + 两赖', hand: '2334455667m11pXX' },
  { name: '两赖分补两顺', hand: '1245789m234p11pXX' },
  { name: '两赖补刻补顺混合', hand: '111234m5678p88pXX' },
  { name: '全花色宽分支 + 两赖', hand: '234m345s456p778mXX' },
  { name: '无赖子基线（对照）', hand: '123m456m789m222s11p' },
  { name: '字牌刻子为主 + 两赖', hand: '111z222z333z444zXX' },
];

function bench(handStr: string, rounds = 1000) {
  const hand = parseHand(handStr);
  if (totalTiles(hand) !== 14) {
    throw new Error(`基准牌例必须 14 张，实际 ${totalTiles(hand)} 张: ${handStr}`);
  }
  assertWin(handStr, hand);
  const times: number[] = [];
  let count = 0;
  for (let i = 0; i < rounds; i++) {
    const t0 = performance.now();
    const ds = enumerateStandard(hand);
    const t1 = performance.now();
    times.push(t1 - t0);
    count = ds.length;
  }
  times.sort((a, b) => a - b);
  return {
    count,
    min: times[0]!,
    median: times[Math.floor(rounds / 2)]!,
    p95: times[Math.floor(rounds * 0.95)]!,
    max: times[rounds - 1]!,
  };
}

function assertWin(handStr: string, hand: ReturnType<typeof parseHand>) {
  const r = checkWin(hand, { sevenPairs: true, thirteenOrphans: true });
  if (!r.win) throw new Error(`基准牌例本身不胡: ${handStr}`);
}

console.log('拆牌穷举性能基准（目标：含两赖 14 张 < 2ms）\n');
let allPass = true;
for (const c of CASES) {
  const r = bench(c.hand);
  const pass = r.median < 2;
  if (!pass) allPass = false;
  console.log(
    `${pass ? 'PASS' : 'FAIL'}  ${c.name.padEnd(22)} ${c.hand.padEnd(20)} ` +
      `拆法=${String(r.count).padStart(3)}  min=${fmt(r.min)}  median=${fmt(r.median)}  ` +
      `p95=${fmt(r.p95)}  max=${fmt(r.max)}`,
  );
}
console.log(`\n结论：${allPass ? '全部牌例 median < 2ms' : '存在超标牌例，需要优化'}`);
if (!allPass) process.exitCode = 1;

function fmt(ms: number): string {
  return `${ms.toFixed(4)}ms`.padStart(10);
}
