import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enumerateSevenPairs, enumerateThirteenOrphans } from '../src/core/special-hands.ts';
import { analyzeHand } from '../src/core/win.ts';
import { expandAll } from '../src/core/expand-wild.ts';
import { h } from './helpers.ts';

test('七对：天然七个对子', () => {
  const hand = h('11m 33m 55m 77m 99m 22p EE');
  const sols = enumerateSevenPairs(hand);
  assert.equal(sols.length, 1);
  assert.equal(sols[0]!.pairs!.length, 7);
  assert.equal(sols[0]!.wildRemaining, 0);
});

test('七对：四张同种算两对（经典七对）', () => {
  const hand = h('1111m 33m 55m 77m 99m 22p');
  const sols = enumerateSevenPairs(hand);
  assert.equal(sols.length, 1);
  assert.equal(sols[0]!.pairs!.length, 7);
});

test('七对：一赖配单张', () => {
  // 六个天然对子（12 张）+ 单张 1m + 赖 -> 7 对
  const hand = h('33m 55m 77m 99m 22p EE 1m 5m*');
  const sols = enumerateSevenPairs(hand);
  assert.equal(sols.length, 1);
  assert.equal(sols[0]!.pairs!.length, 7);
  const wildPair = sols[0]!.pairs!.find((p) => p.wildUsed === 1);
  assert.equal(wildPair?.targetTiles[0], 0);
});

test('七对：两赖互配，展开后覆盖全部 34 个目标', () => {
  const hand = h('11m 33m 55m 77m 99m 22p 5m*5m*');
  const sols = enumerateSevenPairs(hand);
  assert.equal(sols[0]!.wildRemaining, 2);
  const expanded = expandAll(sols);
  assert.equal(expanded.length, 34);
});

test('七对不成立：三张同种', () => {
  const hand = h('111m 33m 55m 77m 99m 22p EE');
  assert.deepEqual(enumerateSevenPairs(hand), []);
});

test('十三幺：13 种齐 + 一张成对（天然）', () => {
  const hand = h('19m 19s 19p ESWN ZFB E');
  const sols = enumerateThirteenOrphans(hand);
  assert.equal(sols.length, 1);
  assert.equal(sols[0]!.pair?.targetTiles[0], 27);
});

test('十三幺：单听 13 张 + 任意幺九字进张可胡（听牌枚举验证）', () => {
  const hand = h('19m 19s 19p ESWN ZFB');
  assert.equal(hand.counts.reduce((a, b) => a + b, 0) + hand.wildcards, 13);
  const analysis = analyzeHand(hand);
  assert.equal(analysis.waits.length, 13);
});

test('十三幺：一赖补缺、另一赖配天然对（14 张）', () => {
  // 天然 12 张：缺白板 B，东成对 EE（SWN 不含东）；两赖：一张补 B，一张配东对
  const hand = h('19m 19s 19p SWN ZF EE 5m*5m*');
  const sols = enumerateThirteenOrphans(hand);
  assert.equal(sols.length, 1);
  assert.equal(sols[0]!.pair?.targetTiles[0], 27);
  assert.equal(sols[0]!.wildRemaining, 0);
});

test('十三幺：两赖场景，一补缺一配天然对，枚举全部在场种为对目标', () => {
  // 天然 12 张（缺 B 且无对子）+ 两赖：一赖补 B，另一赖配任一在场种
  const hand = h('19m 19s 19p ESWN ZF 5m*5m*');
  const sols = enumerateThirteenOrphans(hand);
  assert.equal(sols.length, 12);
  assert.ok(sols.every((s) => s.wildRemaining === 0 && s.pair?.wildUsed === 1));
});

test('十三幺不成立：含中张', () => {
  const hand = h('19m 19s 15p ESWN ZFB E');
  assert.deepEqual(enumerateThirteenOrphans(hand), []);
});

test('听牌：经典两面听 147p', () => {
  // 13 张：123m 456m 789m 123p 5p -> 听 4p/5p? 实际为 4p 与 ... 用标准牌例
  const hand = h('123m 456m 789m 23p EE');
  const analysis = analyzeHand(hand);
  const waitIds = analysis.waits.map((w) => w.tile);
  // 23p 听 1p/4p
  assert.deepEqual(waitIds.sort((a, b) => a - b), [18, 21]);
});

test('听牌：赖子将场景，听任意牌（两赖在手的万能听）', () => {
  // 四组面子已成（12 张天然）+ 两赖 -> 任意进张都能配将
  const hand = h('123m 456m 789m 123p 5m*5m*');
  assert.equal(hand.counts.reduce((a, b) => a + b, 0) + hand.wildcards, 14);
  const hand13 = h('123m 456m 789m 123p 5m*');
  const analysis = analyzeHand(hand13);
  assert.ok(analysis.waits.length >= 30);
});

test('analyzeHand：14 张胡牌给出具体拆分，且所有拆分张数守恒', () => {
  const hand = h('123m 456m 789m 123p EE');
  const analysis = analyzeHand(hand);
  assert.equal(analysis.isWin, true);
  for (const d of analysis.decompositions) {
    let tiles = 0;
    for (const m of d.melds) tiles += m.targetTiles.length;
    if (d.pair) tiles += d.pair.targetTiles.length;
    assert.equal(tiles, 14);
  }
});
