import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enumerateStandardDecomps } from '../src/decompose.ts';
import { enumerateQidui, enumerateShisanyao } from '../src/structures.ts';
import { countsOf, parseTiles } from '../src/tiles.ts';

const ZHONG = 31; // 红中
const FA = 32; // 发财

function decomps(hand: string, laiziTypes: number[] = []) {
  const tiles = parseTiles(hand);
  const laizi = tiles.filter((t) => laiziTypes.includes(t)).length;
  const counts = countsOf(tiles.filter((t) => !laiziTypes.includes(t)));
  return enumerateStandardDecomps(counts, laizi, laiziTypes);
}

test('无赖子:标准胡牌可拆', () => {
  // 1m2m3m 2m3m4m 5p6p7p 8s8s8s 9p9p
  const d = decomps('1m 2m 3m 2m 3m 4m 5p 6p 7p 8s 8s 8s 9p 9p');
  assert.ok(d.length >= 1);
  assert.ok(d.some((x) => x.pair.base === 17)); // 将 9p
});

test('无赖子:不能胡的牌拆不出', () => {
  const d = decomps('1m 2m 3m 4m 5m 6m 7m 8m 9m 1p 2p 3p 5s 7s');
  assert.equal(d.length, 0);
});

test('1 张赖子:赖子补成对子,唯一拆法', () => {
  // 4 组顺子 + 单张 9p,红中补成 9p 对
  const d = decomps('1m 2m 3m 4p 5p 6p 7s 8s 9s 2s 3s 4s 9p 5z', [ZHONG]);
  assert.equal(d.length, 1);
  assert.equal(d[0].pair.base, 17); // 9p
  assert.equal(d[0].pair.laizi, 1);
  assert.equal(d[0].laiziAsSelf, 0);
});

test('2 张赖子:多种拆法全部枚举', () => {
  // 1m2m3m 4p5p6p 7s8s9s 5s5s 9m + 中中
  // 拆法 A:赖子当 8m10m?不行(10m 不存在)→ 赖子补 7m9m 顺子? 9m 已有…实际可:
  //   赖子→(8m? 无)… 顺子 8m9m+赖(7m)? 9m 单张 + 2 赖:赖当 7m8m → 顺子 789m,将 5s ✓
  //   赖 1 张当 5s → 刻子 5s,另 1 张当 9m 的对 → 将 9m ✓
  const d = decomps('1m 2m 3m 4p 5p 6p 7s 8s 9s 5s 5s 9m 5z 5z', [ZHONG]);
  assert.ok(d.length >= 2, `期望至少 2 种拆法,实际 ${d.length}`);
  // 每种拆法都是 4 面子 + 1 将
  for (const x of d) {
    assert.equal(x.sets.length, 4);
    assert.equal(x.pair.laizi + x.sets.reduce((s, y) => s + y.laizi, 0) + x.laiziAsSelf, 2);
  }
});

test('2 张赖子:赖子自结成对', () => {
  // 4 面子齐全 + 单张 5m,双赖必须一个配 5m 一个…不行,2 赖子 + 5m 单张:
  // 赖当 5m 成对后还剩 1 赖无处安放 → 必须赖子成对、5m 进面子? 5m 单张进不了面子。
  // 换:4 面子 + 5m5m 对子 + 双赖 → 双赖自结成对不行(对子只有一个)。
  // 所以:3 面子 + 5m5m + 双赖 → 双赖当任意对子?不行,5m5m 已是对子。
  // 正例:3 面子(9 张)+ 5m5m(2)+ 9p(1)= 12 张 + 双赖:
  //   赖 A 配 9p 成对,赖 B 配…只剩 1 赖,不行 → 此牌不能胡?再补一张:
  // 直接用:3 面子 + 5m5m5m(刻)+ 9p + 双赖 = 14:赖配 9p 对 + 1 赖剩 → 不行;
  //   赖 2 张当 9p 对 → 胡!将 9p(赖×2)
  const d = decomps('1m 2m 3m 4p 5p 6p 7s 8s 9s 5m 5m 5m 5z 5z', [ZHONG]);
  assert.ok(d.length >= 1);
  // 存在双赖直接成将的拆法
  assert.ok(d.some((x) => x.pair.laizi === 2));
  // 每张赖子都必须有去向:当野牌、或当自身
  for (const x of d) {
    const used = x.pair.laizi + x.sets.reduce((s, y) => s + y.laizi, 0) + x.laiziAsSelf;
    assert.equal(used, 2);
  }
});

test('赖子当自身(硬):红中刻子', () => {
  // 1m2m3m 4m5m6m 7p8p9p 2s2s + 中中中 = 14 张,赖子全部当自身 → laiziAsSelf = 3
  const d = decomps('1m 2m 3m 4m 5m 6m 7p 8p 9p 2s 2s 5z 5z 5z', [ZHONG]);
  assert.ok(d.some((x) => x.laiziAsSelf === 3), '应存在赖子全当自身的拆法(硬胡)');
});

test('不允许赖子当自身时,硬拆法消失', () => {
  const tiles = parseTiles('1m 2m 3m 4m 5m 6m 7p 8p 9p 2s 2s 5z 5z 5z');
  const laizi = tiles.filter((t) => t === ZHONG).length;
  const counts = countsOf(tiles.filter((t) => t !== ZHONG));
  const d = enumerateStandardDecomps(counts, laizi, [ZHONG], false);
  assert.ok(d.every((x) => x.laiziAsSelf === 0));
});

test('七对:无赖子', () => {
  const tiles = parseTiles('1m 1m 2m 2m 3m 3m 4p 4p 5p 5p 6s 6s 7s 7s');
  const q = enumerateQidui(countsOf(tiles), 0, []);
  assert.equal(q.length, 1);
  assert.equal(q[0].pairs.length, 7);
});

test('七对:1 赖子配单张', () => {
  const tiles = parseTiles('1m 1m 2m 2m 3m 3m 4p 4p 5p 5p 6s 6s 7s 5z');
  const q = enumerateQidui(countsOf(tiles.filter((t) => t !== ZHONG)), 1, [ZHONG]);
  assert.equal(q.length, 1);
  assert.ok(q[0].pairs.some((p) => p.tile === 24 && p.laizi === 1)); // 7s 对含 1 赖
});

test('七对:四张相同算两对(龙七对的基础)', () => {
  const tiles = parseTiles('1m 1m 1m 1m 2m 2m 3p 3p 4p 4p 5s 5s 6s 6s');
  const q = enumerateQidui(countsOf(tiles), 0, []);
  assert.equal(q.length, 1);
  assert.equal(q[0].pairs.filter((p) => p.tile === 0).length, 2);
});

test('十三幺:无赖子', () => {
  const tiles = parseTiles('1m 9m 1p 9p 1s 9s 1z 2z 3z 4z 5z 6z 7z 7z');
  const s = enumerateShisanyao(countsOf(tiles), 0, []);
  assert.equal(s.length, 1);
  assert.equal(s[0].pairTile, 33); // 白
});

test('十三幺:2 赖子补 1 缺张 + 成对', () => {
  // 缺 白(7z),无对子 → 1 赖补白,1 赖成对
  const tiles = parseTiles('1m 9m 1p 9p 1s 9s 1z 2z 3z 4z 5z 6z 5z 5z');
  // 注意 5z(中)本身是幺九也是赖子:允许当自身
  const laiziTypes = [ZHONG];
  const laizi = tiles.filter((t) => laiziTypes.includes(t)).length; // 3 张中
  const counts = countsOf(tiles.filter((t) => !laiziTypes.includes(t)));
  const s = enumerateShisanyao(counts, laizi, laiziTypes);
  // 中当自身 1 张 + 2 赖:补白 + 任意对;或中全当野牌…多种,但都必须能成十三幺
  assert.ok(s.length >= 1);
});

test('拆法去重:同一抽象拆法不重复出现', () => {
  const d = decomps('1m 1m 1m 2m 2m 2m 3m 3m 3m 4m 4m 4m 5m 5m');
  const keys = d.map((x) => `${x.sets.map((s) => s.kind + s.base).sort().join()}|${x.pair.base}|${x.laiziAsSelf}`);
  assert.equal(new Set(keys).size, keys.length);
});
