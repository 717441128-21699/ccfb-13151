import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHand } from '../src/evaluate.ts';
import { seededRng } from '../src/wall.ts';
import { wuhan } from '../../rulepacks/src/wuhan.ts';

const ZHONG = 31;

/** 构造一手必胡的牌:随机 4 面子 + 1 对,再把其中 2 张换成赖子 */
function makeWinnableHand(rng: () => number): number[] {
  const tiles: number[] = [];
  const used = new Map<number, number>();
  const take = (t: number): boolean => {
    const n = (used.get(t) ?? 0) + 1;
    if (n > 4) return false;
    used.set(t, n);
    tiles.push(t);
    return true;
  };
  while (tiles.length < 12) {
    // 随机一个面子
    if (rng() < 0.5) {
      const t = Math.floor(rng() * 34);
      if (t === ZHONG) continue;
      if (take(t) && take(t) && take(t)) continue;
      // 失败回退
      while (tiles.length % 3 !== 0) {
        const last = tiles.pop()!;
        used.set(last, used.get(last)! - 1);
      }
    } else {
      const suit = Math.floor(rng() * 3);
      const r = Math.floor(rng() * 7);
      const b = suit * 9 + r;
      if (b === ZHONG) continue;
      if (take(b) && take(b + 1) && take(b + 2)) continue;
      while (tiles.length % 3 !== 0) {
        const last = tiles.pop()!;
        used.set(last, used.get(last)! - 1);
      }
    }
  }
  // 对子
  for (;;) {
    const t = Math.floor(rng() * 34);
    if (t === ZHONG) continue;
    if ((used.get(t) ?? 0) <= 2) {
      take(t);
      take(t);
      break;
    }
  }
  // 换 2 张为赖子
  const hand = [...tiles];
  for (let k = 0; k < 2; k++) {
    const j = Math.floor(rng() * hand.length);
    hand.splice(j, 1);
    hand.push(ZHONG);
  }
  return hand;
}

/** 完全随机手牌(测不胡路径) */
function makeRandomHand(rng: () => number): number[] {
  const pool: number[] = [];
  for (let t = 0; t < 34; t++) {
    if (t === ZHONG) continue;
    for (let k = 0; k < 4; k++) pool.push(t);
  }
  const hand: number[] = [ZHONG, ZHONG];
  for (let k = 0; k < 12; k++) hand.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return hand;
}

/**
 * 性能验收:带 2 张赖子的 14 张牌,全拆法穷举 + 算番,单手无不得超过 2ms。
 * 样本一半为必胡牌(重枚举路径),一半为随机牌。
 */
test('性能:2 赖子 14 张牌全拆法 + 算番 < 2ms/手', () => {
  const rng = seededRng(20261120);
  // 预热 JIT
  for (let i = 0; i < 500; i++) evaluateHand(makeWinnableHand(rng), wuhan, {});

  const N = 3000;
  const times: number[] = [];
  let wins = 0;
  let maxDecomps = 0;
  for (let i = 0; i < N; i++) {
    const hand = i % 2 === 0 ? makeWinnableHand(rng) : makeRandomHand(rng);
    const r = evaluateHand(hand, wuhan, { isZimo: i % 3 === 0 });
    times.push(r.elapsedMs);
    if (r.win) wins++;
    if (r.analyses.length > maxDecomps) maxDecomps = r.analyses.length;
  }

  times.sort((a, b) => a - b);
  const avg = times.reduce((s, x) => s + x, 0) / N;
  const p50 = times[Math.floor(N * 0.5)];
  const p99 = times[Math.floor(N * 0.99)];
  const max = times[N - 1];
  console.log(
    `  [性能] ${N} 手(2 赖子,半数为必胡牌): 胡牌率 ${((wins / N) * 100).toFixed(1)}%, ` +
      `最大拆法数 ${maxDecomps}; 耗时 avg=${avg.toFixed(3)}ms p50=${p50.toFixed(3)}ms ` +
      `p99=${p99.toFixed(3)}ms max=${max.toFixed(3)}ms`,
  );
  assert.ok(p99 < 2, `p99 耗时 ${p99.toFixed(3)}ms 超过 2ms`);
  assert.ok(max < 2, `最大耗时 ${max.toFixed(3)}ms 超过 2ms`);
});
