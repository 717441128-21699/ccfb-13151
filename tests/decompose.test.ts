import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enumerateStandard, hasStandardWin } from '../src/core/decompose.ts';
import { h } from './helpers.ts';

test('标准胡牌：四面子一将，含刻子和顺子', () => {
  const hand = h('123m 456m 789m 123p EE');
  const sols = enumerateStandard(hand);
  assert.ok(sols.length >= 1);
  assert.equal(sols[0]!.melds.length, 4);
  assert.equal(sols[0]!.pair?.targetTiles[0], 27);
});

test('非胡牌返回空：14 张散牌', () => {
  const hand = h('135m 246m 789m 123p ES');
  assert.equal(hasStandardWin(hand), false);
  assert.deepEqual(enumerateStandard(hand), []);
});

test('刻子+将的纯碰碰胡结构', () => {
  const hand = h('111m 333m 555m 777m 99m');
  const sols = enumerateStandard(hand);
  assert.ok(sols.length >= 1);
  assert.ok(sols.every((s) => s.melds.every((m) => m.type === 'triplet')));
});

test('同一结构只出现一次（去重）', () => {
  const hand = h('111m 222m 333m 444m 55m');
  const sols = enumerateStandard(hand);
  const keys = new Set(sols.map((s) => s.key));
  assert.equal(keys.size, sols.length);
});

test('一张赖子补顺子缺口：12m+赖 视作 123m', () => {
  // 12m + 赖子(天然 5m 标记) + 456m + 789m + 123p + EE
  const hand = h('12m 5m* 456m 789m 123p EE');
  assert.equal(hand.wildcards, 1);
  const sols = enumerateStandard(hand);
  assert.ok(sols.length >= 1);
  const seqWithWild = sols[0]!.melds.find((m) => m.wildUsed > 0);
  assert.ok(seqWithWild);
  assert.deepEqual(seqWithWild!.targetTiles, [0, 1, 2]);
  assert.deepEqual(seqWithWild!.naturalTiles, [0, 1]);
});

test('一张赖子补刻子：99m+赖 视作 999m', () => {
  const hand = h('99m 5m* 456m 789m 123p EE');
  const sols = enumerateStandard(hand);
  assert.ok(sols.some((s) => s.melds.some(
    (m) => m.type === 'triplet' && m.wildUsed === 1 && m.targetTiles[0] === 8,
  )));
});

test('半赖将：单张东 + 赖子 组成东将', () => {
  const hand = h('123m 456m 789m 123p E 5m*');
  const sols = enumerateStandard(hand);
  assert.ok(sols.some((s) => s.pair?.wildUsed === 1 && s.pair.targetTiles[0] === 27));
});

test('两张赖子互配为将：wildRemaining=2 且面子全天然', () => {
  const hand = h('123m 456m 789m 123p 5m*5m*');
  assert.equal(hand.wildcards, 2);
  const sols = enumerateStandard(hand);
  assert.ok(sols.length >= 1);
  assert.ok(sols.some((s) => s.wildRemaining === 2 && s.pair === null));
});

test('两赖分别填两个顺子缺口', () => {
  // 13m + 46m + 789m + 123p + EE，两赖补成 123m/456m
  const hand = h('13m 46m 789m 123p EE 5m*5m*');
  const sols = enumerateStandard(hand);
  assert.ok(sols.some((s) => s.melds.filter((m) => m.wildUsed > 0).length === 2));
});

test('赖子补字牌刻子：中中 + 赖', () => {
  // 两组顺子 6 张 + 123p 3 张 + 中中 2 张 + 赖 1 张 = 12？重算：
  // 123m 456m 789m = 9，ZZ = 2，赖 = 1，共 12；再加 EE 将 = 14
  const hand = h('123m 456m 789m ZZ EE 5m*');
  const sols = enumerateStandard(hand);
  assert.ok(sols.some((s) => s.melds.some(
    (m) => m.type === 'triplet' && m.targetTiles[0] === 31 && m.wildUsed === 1,
  )));
});

test('anyOnly 快速路径与完整枚举结论一致', () => {
  const hand = h('123m 456m 789m 123p 5m*5m*');
  assert.equal(hasStandardWin(hand), enumerateStandard(hand).length > 0);
  const bad = h('135m 246m 789m 123p ES');
  assert.equal(hasStandardWin(bad), false);
});

test('边界：赖子无法救活的散牌', () => {
  const hand = h('147m 258m 369m 12p 5m*5m*');
  // 14 张含两赖，结构性散牌，穷举后无解
  assert.equal(hasStandardWin(hand), false);
});
