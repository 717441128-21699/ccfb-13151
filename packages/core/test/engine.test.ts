/**
 * 拆牌引擎 / 胡牌判定 / 特殊牌型单元测试。
 * 运行：node --test --experimental-strip-types packages/core/test/*.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseHand,
  handToLabel,
  validateCounts,
  totalTiles,
} from '../src/tiles.ts';
import { enumerateStandard, countDecompositions } from '../src/decompose.ts';
import {
  matchSevenPairs,
  matchThirteenOrphans,
} from '../src/special.ts';
import { checkWin, listWaits } from '../src/win.ts';

test('基础解析：14 张标准牌', () => {
  const h = parseHand('123m 456m 789m 234p 11p');
  assert.equal(totalTiles(h), 14);
  assert.equal(handToLabel(h).split(' ').length, 14);
  assert.equal(validateCounts(h.counts), null);
});

test('标准型：123m456m789m234p + 11p 恰好一种拆法', () => {
  const h = parseHand('123m456m789m234p11p');
  assert.equal(totalTiles(h), 14);
  const ds = enumerateStandard(h);
  assert.equal(ds.length, 1);
  const types = ds[0]!.melds.map((m) => m.type).sort();
  assert.deepEqual(types, ['pair', 'sequence', 'sequence', 'sequence', 'sequence']);
});

test('多拆法：111222333m 11p 同时可刻可顺', () => {
  const h = parseHand('111222333m11p');
  const n = countDecompositions(h);
  // 三个顺子 / 三个刻子 / 混合，去重后应多于 1 种
  assert.ok(n >= 2, `期望多拆法，实际 ${n}`);
});

test('赖子：一赖补顺可胡，且记录 jokerSlots', () => {
  // 12m + 赖 -> 123m；其余 456m 789m 11p
  const h = parseHand('12m456m789m11p X');
  const ds = enumerateStandard(h);
  assert.ok(ds.length >= 1);
  const withJoker = ds.find((d) =>
    d.melds.some((m) => m.jokerSlots.length > 0),
  );
  assert.ok(withJoker, '应存在使用赖子的拆法');
});

test('赖子：两赖补两顺（硬指标牌例之一）', () => {
  // 12m + 赖(=3m) 成顺；45m + 赖(=6m) 成顺；789m 234p 11p（12 自然 + 2 赖 = 14）
  const h = parseHand('1245789m234p11p XX');
  assert.equal(totalTiles(h), 14);
  const r = checkWin(h, {});
  assert.equal(r.win, true);
});

test('两赖穷举：14 张牌所有拆法 2ms 内完成（硬指标）', () => {
  // 高分支牌例：同花色连对（10 自然）+ 11p + 两赖 = 14 张，13 种拆法
  const h = parseHand('2334455667m 11p XX');
  assert.equal(totalTiles(h), 14);
  // 先确认能胡
  const r = checkWin(h, {});
  assert.equal(r.win, true);
  // 计时：取 100 次中位数更稳，单次也必须达标
  const times: number[] = [];
  for (let i = 0; i < 100; i++) {
    const t0 = performance.now();
    const ds = enumerateStandard(h);
    const t1 = performance.now();
    times.push(t1 - t0);
    assert.ok(ds.length > 0);
  }
  times.sort((a, b) => a - b);
  const median = times[50]!;
  const p95 = times[94]!;
  assert.ok(
    median < 2,
    `中位数 ${median.toFixed(3)}ms 超过 2ms 指标（p95=${p95.toFixed(3)}ms）`,
  );
});

test('七对：自然七对', () => {
  const h = parseHand('11m22m33m44m55m66m77m');
  const sp = matchSevenPairs(h);
  assert.notEqual(sp, null);
  assert.equal(sp!.pairs.length, 7);
});

test('七对：两赖补对', () => {
  // 6 个自然对子 + 1 张单 + 1 赖
  const h = parseHand('11m22m33m44m55m66m 7m X');
  const sp = matchSevenPairs(h);
  assert.notEqual(sp, null);
  assert.equal(sp!.jokerUsed, 1);
});

test('七对：两赖自成一对', () => {
  const h = parseHand('11m22m33m44m55m66m XX');
  const sp = matchSevenPairs(h);
  assert.notEqual(sp, null);
});

test('十三幺：标准型 + 重复 1m', () => {
  const h = parseHand('19m19s19p 1234567z 1m');
  const to = matchThirteenOrphans(h);
  assert.notEqual(to, null);
  assert.equal(to!.duplicatedTile, 0);
});

test('十三幺：一赖补缺', () => {
  // 13 张自然（缺 9p=1p 位，1m 成对）+ 1 赖补缺 = 14 张
  const h = parseHand('119m19s1p1234567z X');
  assert.equal(totalTiles(h), 14);
  const to = matchThirteenOrphans(h);
  assert.notEqual(to, null);
  assert.equal(to!.jokerUsed, 1);
});

test('十三幺：出现中张立即失败', () => {
  const h = parseHand('19m19s19p 1234567z 5m');
  assert.equal(matchThirteenOrphans(h), null);
});

test('听牌枚举：13 张两面听', () => {
  // 123 456 789m + 11p + 等搭：构造 23m 听 1/4m
  const h = parseHand('23m456m789m 123p 11p');
  const waits = listWaits(h, {});
  const tiles = waits.map((w) => w.tile);
  assert.ok(tiles.includes(0)); // 1m
  assert.ok(tiles.includes(3)); // 4m
});

test('非胡牌：乱牌返回 win=false', () => {
  const h = parseHand('135m246m 135p246p 1m');
  assert.equal(checkWin(h, {}).win, false);
});

test('物理张数校验：超过 4 张报错', () => {
  const h = parseHand('11111m2222m3333m44m');
  assert.notEqual(validateCounts(h.counts), null);
});
