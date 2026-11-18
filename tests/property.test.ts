/**
 * 性质测试：不依赖人工牌例的不变量校验，随机生成大量牌局。
 *  - 张数守恒：任何拆分的名义牌总数 = 输入张数
 *  - 赖子守恒：拆分使用的赖子总数 = 输入赖子数
 *  - 可复算：拆分输出的目标牌重新计数后必然自身胡牌
 *  - 听牌闭环：每个听张加入后一定能胡
 *  - 两赖边界：随机两赖牌局穷举不抛错且去重有效
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeHand } from '../src/core/win.ts';
import { enumerateStandard } from '../src/core/decompose.ts';
import { hasStandardWin } from '../src/core/decompose.ts';
import { addTile } from '../src/core/hand.ts';
import { TILE_KINDS } from '../src/core/tiles.ts';
import { h, randomHand } from './helpers.ts';
import type { Decomposition } from '../src/core/decompose.ts';

function checkConservation(d: Decomposition, total: number, wildcards: number): void {
  let tiles = 0;
  let wild = 0;
  for (const m of d.melds) {
    tiles += m.targetTiles.length;
    wild += m.wildUsed;
  }
  if (d.pair) {
    tiles += d.pair.targetTiles.length;
    wild += d.pair.wildUsed;
  }
  if (d.pairs) for (const p of d.pairs) {
    tiles += p.targetTiles.length;
    wild += p.wildUsed;
  }
  if (d.singles) for (const s of d.singles) {
    tiles += s.targetTiles.length;
    wild += s.wildUsed;
  }
  tiles += d.wildRemaining;
  wild += d.wildRemaining;
  assert.equal(tiles, total);
  assert.equal(wild, wildcards);
}

test('性质：随机 14 张牌（0..2 赖）×2000 局，胡牌拆分全部守恒且可复算', () => {
  let winCount = 0;
  for (let i = 0; i < 2000; i++) {
    const hand = randomHand(Math.random, 2, 14);
    const analysis = analyzeHand(hand);
    if (!analysis.isWin) continue;
    winCount += 1;
    for (const d of analysis.decompositions) {
      checkConservation(d, 14, hand.wildcards);
      // 复算：把目标牌重新堆成 counts，必须仍能胡
      const recount = new Array<number>(TILE_KINDS).fill(0);
      const bump = (t: number): void => { recount[t] = (recount[t] ?? 0) + 1; };
      for (const m of d.melds) for (const t of m.targetTiles) bump(t);
      if (d.pair) for (const t of d.pair.targetTiles) bump(t);
      if (d.pairs) for (const p of d.pairs) for (const t of p.targetTiles) bump(t);
      if (d.singles) for (const s of d.singles) for (const t of s.targetTiles) bump(t);
      const rebuilt = { counts: recount, wildcards: 0 };
      assert.ok(
        hasStandardWin(rebuilt) || d.kind !== 'standard',
        '标准拆分复算失败',
      );
    }
  }
  assert.ok(winCount > 50, `随机胡牌样本过少（${winCount}），检查生成器`);
});

test('性质：随机 13 张牌 ×1000 局，听张闭环（加听张必胡）', () => {
  for (let i = 0; i < 1000; i++) {
    const hand = randomHand(Math.random, 2, 13);
    const analysis = analyzeHand(hand);
    for (const wait of analysis.waits) {
      const next = addTile(hand, wait.tile);
      assert.ok(analyzeHand(next).isWin, '听张加入后不能胡');
    }
  }
});

test('性质：完整枚举与 anyOnly 在胡/不胡结论上恒一致（500 局）', () => {
  for (let i = 0; i < 500; i++) {
    const hand = randomHand(Math.random, 2, 14);
    const full = enumerateStandard(hand).length > 0;
    const fast = hasStandardWin(hand);
    assert.equal(full, fast);
  }
});

test('性质：两赖最坏形态——四组天然面子 + 两赖，展开恰为 34 个具体拆分', () => {
  const hand = h('123m 456m 789m 123p 5m*5m*');
  const analysis = analyzeHand(hand);
  const wildPairDecomps = analysis.decompositions.filter((d) => d.wildRemaining === 0 && d.pair?.wildUsed === 2);
  assert.equal(wildPairDecomps.length, 34);
});

test('性质：去重有效——所有拆分 key 唯一', () => {
  const hand = h('111m 222m 333m 444m 55m');
  const sols = enumerateStandard(hand);
  assert.equal(new Set(sols.map((s) => s.key)).size, sols.length);
});
