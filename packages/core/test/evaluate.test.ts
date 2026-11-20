import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHand } from '../src/evaluate.ts';
import { parseTiles, type Tile } from '../src/tiles.ts';
import type { RulePack, WinContext } from '../src/rule.ts';
import { wuhan, sichuan, mcr, guangdong, changsha } from '../../rulepacks/src/index.ts';

function run(pack: RulePack, hand: string, ctx: WinContext = {}) {
  return evaluateHand(parseTiles(hand), pack, ctx);
}

function fanNames(r: ReturnType<typeof run>): string[] {
  return (r.best?.fans ?? []).map((f) => f.name).sort();
}

// ---------- 武汉 ----------

test('武汉:软胡(赖子代牌)不计硬胡', () => {
  const r = run(wuhan, '1m 2m 3m 4p 5p 6p 7s 8s 9s 2s 3s 4s 9p 5z');
  assert.equal(r.win, true);
  assert.equal(r.best!.totalFan, 0); // 软胡,无其他番
});

test('武汉:硬胡 + 自摸 = 2 番', () => {
  const r = run(wuhan, '1m 2m 3m 4m 5m 6m 7p 8p 9p 2s 2s 5z 5z 5z', { isZimo: true });
  assert.equal(r.win, true);
  assert.equal(r.best!.totalFan, 2);
  assert.deepEqual(fanNames(r), ['硬胡', '自摸']);
  assert.equal(r.best!.view.laiziWild, 0);
});

test('武汉:碰碰胡 + 硬胡 = 3 番', () => {
  const r = run(wuhan, '1m 1m 1m 2m 2m 2m 3p 3p 3p 5s 5s 5s 7m 7m');
  assert.equal(r.best!.totalFan, 3);
  assert.deepEqual(fanNames(r), ['硬胡', '碰碰胡']);
});

test('武汉:清一色碰碰胡硬胡 = 6 番', () => {
  const r = run(wuhan, '1m 1m 1m 2m 2m 2m 3m 3m 3m 5m 5m 5m 7m 7m');
  assert.equal(r.best!.totalFan, 6);
  assert.deepEqual(fanNames(r), ['清一色', '硬胡', '碰碰胡']);
});

test('武汉:七对硬胡 = 3 番', () => {
  const r = run(wuhan, '1m 1m 2m 2m 3m 3m 4p 4p 5p 5p 6s 6s 7s 7s');
  assert.equal(r.best!.totalFan, 3);
  assert.deepEqual(fanNames(r), ['七对', '硬胡']);
});

test('武汉:抢杠胡计番', () => {
  const r = run(wuhan, '1m 2m 3m 4p 5p 6p 7s 8s 9s 2s 3s 4s 9p 9p', { isRobKong: true });
  assert.equal(r.best!.totalFan, 2); // 抢杠胡1 + 硬胡1(无赖子)
  assert.ok(fanNames(r).includes('抢杠胡'));
});

// ---------- 四川 ----------

test('四川:不缺门不能胡', () => {
  const r = run(sichuan, '1m 2m 3m 4p 5p 6p 7s 8s 9s 2s 3s 4s 9p 9p');
  assert.equal(r.win, false);
});

test('四川:缺一门平胡可胡,0 番', () => {
  const r = run(sichuan, '1m 2m 3m 4m 5m 6m 7m 8m 9m 2p 3p 4p 9p 9p');
  assert.equal(r.win, true);
  assert.equal(r.best!.totalFan, 0);
});

test('四川:清一色 4 番', () => {
  const r = run(sichuan, '1m 2m 3m 2m 3m 4m 4m 5m 6m 7m 8m 9m 9m 9m');
  assert.equal(r.win, true);
  assert.equal(r.best!.totalFan, 4);
  assert.deepEqual(fanNames(r), ['清一色']);
});

test('四川:自摸 + 根(一杠) = 2 番', () => {
  const r = run(sichuan, '1m 2m 3m 4m 5m 6m 7m 8m 9m 5p 5p', {
    isZimo: true,
    melds: [{ kind: 'gang', base: 11 }], // 杠 3p
  });
  assert.equal(r.win, true);
  assert.equal(r.best!.totalFan, 2);
  assert.deepEqual(fanNames(r), ['根', '自摸']);
});

// ---------- 国标 ----------

test('国标:不足 8 分不能胡', () => {
  // 只有 无字1 + 门前清2 = 3 分
  const r = run(mcr, '1m 2m 3m 2m 3m 4m 5p 6p 7p 8s 8s 8s 9p 9p');
  assert.equal(r.win, false);
});

test('国标:清一色不计无字,24+平胡2+门前清2 = 28 分', () => {
  const r = run(mcr, '1m 2m 3m 2m 3m 4m 4m 5m 6m 7m 8m 9m 9m 9m');
  assert.equal(r.win, true);
  assert.equal(r.best!.totalFen, 28);
  const names = fanNames(r);
  assert.ok(names.includes('清一色'));
  assert.ok(!names.includes('无字'), '清一色命中后无字不计');
});

test('国标:十三幺 88 分,不计门前清', () => {
  const r = run(mcr, '1m 9m 1p 9p 1s 9s 1z 2z 3z 4z 5z 6z 7z 7z');
  assert.equal(r.win, true);
  assert.equal(r.best!.totalFen, 88);
  const names = fanNames(r);
  assert.ok(names.includes('十三幺'));
  assert.ok(!names.includes('门前清'));
});

test('国标:碰碰胡+混一色+箭刻+门前清 = 16 分', () => {
  const r = run(mcr, '1m 1m 1m 2m 2m 2m 3m 3m 3m 5z 5z 5z 7m 7m');
  assert.equal(r.best!.totalFen, 16);
  assert.deepEqual(fanNames(r), ['混一色', '碰碰胡', '箭刻', '门前清']);
});

test('国标:花牌按张计分', () => {
  const flowers: Tile[] = [34, 35, 36];
  const r = run(mcr, '1m 1m 1m 2m 2m 2m 3m 3m 3m 5z 5z 5z 7m 7m', { flowers });
  // 16 + 花牌3 = 19
  assert.equal(r.best!.totalFen, 19);
});

// ---------- 广东 ----------

test('广东:鸡胡 0 番', () => {
  const r = run(guangdong, '1m 1m 1m 2m 3m 4m 5p 6p 7p 8s 8s 8s 9p 9p');
  assert.equal(r.win, true);
  assert.equal(r.best!.totalFan, 0);
});

test('广东:清一色碰碰胡自摸 7 番,爆胡封顶 5 番', () => {
  const r = run(guangdong, '1m 1m 1m 2m 2m 2m 3m 3m 3m 5m 5m 5m 7m 7m', { isZimo: true });
  assert.equal(r.best!.totalFan, 5);
  assert.equal(r.best!.capped, true);
});

test('广东:字一色不计碰碰胡', () => {
  const r = run(guangdong, '1z 1z 1z 2z 2z 2z 3z 3z 3z 5z 5z 5z 7z 7z');
  const names = fanNames(r);
  assert.ok(names.includes('字一色'));
  assert.ok(!names.includes('碰碰胡'));
});

// ---------- 长沙 ----------

test('长沙:将将胡 + 碰碰胡 = 6 番', () => {
  const r = run(changsha, '2m 2m 2m 5m 5m 5m 8p 8p 8p 2s 2s 2s 5s 5s');
  assert.equal(r.best!.totalFan, 6);
  assert.deepEqual(fanNames(r), ['将将胡', '碰碰胡']);
});

test('长沙:缺一色 1 番', () => {
  const r = run(changsha, '1m 2m 3m 4m 5m 6m 7m 8m 9m 2p 3p 4p 9p 9p');
  assert.equal(r.best!.totalFan, 1);
  assert.deepEqual(fanNames(r), ['缺一色']);
});

// ---------- 最大番选取 ----------

test('取番最大的拆法:同一手牌不同拆法番数不同', () => {
  // 1m1m1m 2m3m4m 5m6m7m 8m9m + 中(赖):可拆 789m顺+将1m?不行…
  // 用武汉:1m2m3m 1m2m3m 4m5m6m 7m8m9m 9m9m + 中
  // 拆法A:将9m,四顺 → 清一色3+硬胡? 中当什么? 必须用完…此手 13 张+1 赖:
  // 真实手牌 14 张:1m2m3m 1m2m3m 4m5m6m 7m8m9m 9m 5z
  // 中当 9m → 将 9m,清一色 3 番(软胡无硬胡)
  const r = run(wuhan, '1m 2m 3m 1m 2m 3m 4m 5m 6m 7m 8m 9m 9m 5z');
  assert.equal(r.win, true);
  assert.equal(r.best!.totalFan, 3);
  assert.ok(r.analyses.length >= 1);
});
