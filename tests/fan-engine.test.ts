import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHand } from '../src/core/fan-engine.ts';
import { analyzeHand } from '../src/core/win.ts';
import { sichuanPack, guobiaoPack, laiziPack } from '../src/core/index.ts';
import { h, defaultGame } from './helpers.ts';

function score(pack: ReturnType<typeof Object>, handNotation: string, game = defaultGame()) {
  const hand = h(handNotation);
  const analysis = analyzeHand(hand);
  assert.ok(analysis.isWin, `牌例应胡: ${handNotation}`);
  return evaluateHand(hand, analysis.decompositions, pack.fans, pack.scoring, game);
}

test('四川：平胡点炮 = 1 番', () => {
  const r = score(sichuanPack, '123m 456m 789m 123p 55p');
  assert.equal(r.best!.total, 1);
  assert.ok(r.best!.applied.some((f) => f.id === 'pinghu'));
});

test('四川：清一色自摸 = 3 番（清 2 + 自摸 1），平胡被包含', () => {
  const r = score(sichuanPack, '123m 456m 789m 234m 55m', defaultGame({ winMethod: 'selfDraw' }));
  assert.equal(r.best!.total, 3);
  assert.ok(r.best!.applied.some((f) => f.id === 'qingyise'));
  assert.ok(r.best!.excluded.some((f) => f.id === 'pinghu' && f.reason === 'included'));
});

test('四川：三番封顶生效（清2 + 碰1 + 自摸1 + 海底1 + 杠上花1 = 6 -> 封 3）', () => {
  const r = score(
    sichuanPack,
    '111m 333m 555m 777m 99m',
    defaultGame({ winMethod: 'supplementKong', isLastTile: true }),
  );
  assert.equal(r.best!.rawTotal, 6);
  assert.equal(r.best!.total, 3);
  assert.equal(r.best!.capped, true);
});

test('四川：结构互斥组只保留碰碰胡，平胡不入账', () => {
  const r = score(sichuanPack, '111m 333m 555m 777m 99m');
  assert.ok(r.best!.applied.some((f) => f.id === 'penghu'));
  assert.ok(!r.best!.applied.some((f) => f.id === 'pinghu'));
});

test('国标：十三幺 88 番，满足 8 番起胡', () => {
  const r = score(guobiaoPack, '19m 19s 19p ESWN ZFB E');
  assert.equal(r.best!.total, 88);
  assert.equal(r.canWin, true);
});

test('国标：平和+无字+门前清+自摸 = 6 番，未达 8 番起胡线', () => {
  const r = score(guobiaoPack, '123m 456m 789m 234p 55p', defaultGame({ winMethod: 'selfDraw' }));
  // 平和2 + 无字1 + 门前清2 + 自摸1 = 6
  assert.equal(r.best!.total, 6);
  assert.equal(r.canWin, false);
});

test('国标：清一色覆盖混一色/无字/断幺/平和', () => {
  const r = score(guobiaoPack, '234m 456m 678m 789m 55m');
  const appliedIds = r.best!.applied.map((f) => f.id);
  assert.ok(appliedIds.includes('qingyise'));
  assert.ok(!appliedIds.includes('hunyise'));
  assert.ok(!appliedIds.includes('wuziyise'));
  assert.ok(!appliedIds.includes('pinghuhe'));
});

test('国标：海底捞月 8 番独立成立即达起胡线', () => {
  const r = score(
    guobiaoPack,
    '123m 456m 789m 234p 55p',
    defaultGame({ winMethod: 'lastTile', isLastTile: true }),
  );
  assert.equal(r.canWin, true);
  assert.ok(r.best!.applied.some((f) => f.id === 'haidilao'));
});

test('赖子包：两赖将展开后取最优番型（天然面子 + 赖子胡 + 自摸）', () => {
  const r = score(
    laiziPack,
    '123m 456m 789m 123p 5m*5m*',
    defaultGame({ winMethod: 'selfDraw' }),
  );
  assert.equal(r.best!.applied.some((f) => f.id === 'laizihu'), true);
  assert.ok(r.best!.total >= 2);
});

test('赖子包：清一色被 requireNoWildcard 拦截', () => {
  const r = score(laiziPack, '123m 456m 789m 234m 5m*5m*');
  assert.ok(!r.best!.applied.some((f) => f.id === 'qingyise'));
  assert.ok(r.best!.excluded.some((f) => f.id === 'qingyise' && f.reason === 'wildcard-blocked'));
});

test('赖子包：天然清一色（无赖）可认定，且封顶 6', () => {
  const r = score(
    laiziPack,
    '123m 456m 789m 234m 55m',
    defaultGame({ winMethod: 'selfDraw' }),
  );
  const ids = r.best!.applied.map((f) => f.id);
  assert.ok(ids.includes('qingyise'));
  assert.ok(ids.includes('tianran'));
  assert.ok(r.best!.total <= 6);
});

test('最优拆分确定性：重复计算结果一致', () => {
  const hand = h('111m 222m 333m 444m 55m');
  const a = evaluateHand(hand, analyzeHand(hand).decompositions, sichuanPack.fans, sichuanPack.scoring, defaultGame());
  const b = evaluateHand(hand, analyzeHand(hand).decompositions, sichuanPack.fans, sichuanPack.scoring, defaultGame());
  assert.equal(a.best!.decomposition.key, b.best!.decomposition.key);
  assert.equal(a.best!.total, b.best!.total);
});
