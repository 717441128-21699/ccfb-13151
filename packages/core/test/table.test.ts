import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canRobKong, resolveClaims, resolveDiscardWinners } from '../src/table.ts';
import { generateRuleDoc, validateRulePack } from '../src/docgen.ts';
import { wuhan, sichuan, mcr, guangdong, builtinPacks } from '../../rulepacks/src/index.ts';

test('一炮多响:四川允许多家同胡', () => {
  const winners = resolveDiscardWinners(sichuan, 0, [1, 2, 3]);
  assert.deepEqual(winners, [1, 2, 3]);
});

test('截胡:国标只算离炮手最近的一家', () => {
  // 炮手 0 号,1 号和 3 号都可胡 → 1 号更近(逆时针先到)
  const winners = resolveDiscardWinners(mcr, 0, [3, 1]);
  assert.deepEqual(winners, [1]);
});

test('截胡:座位环绕时按距离取最近', () => {
  // 炮手 3 号,0 号距离 1,2 号距离 3 → 0 号截胡
  const winners = resolveDiscardWinners(mcr, 3, [2, 0]);
  assert.deepEqual(winners, [0]);
});

test('抢杠胡范围:武汉只抢补杠,不抢暗杠', () => {
  assert.equal(canRobKong(wuhan, 'added'), true);
  assert.equal(canRobKong(wuhan, 'concealed'), false);
  assert.equal(canRobKong(wuhan, 'discard'), false);
});

test('宣示优先级:胡 > 杠 > 碰 > 吃', () => {
  const claims = [
    { player: 0, type: 'chi' as const },
    { player: 1, type: 'peng' as const },
    { player: 2, type: 'hu' as const },
    { player: 3, type: 'gang' as const },
  ];
  const winners = resolveClaims(wuhan, claims);
  assert.deepEqual(winners, [{ player: 2, type: 'hu' }]);
});

test('所有内置规则包通过配置校验', () => {
  for (const pack of builtinPacks) {
    const errors = validateRulePack(pack);
    assert.deepEqual(errors, [], `${pack.id}: ${errors.map((e) => e.message).join('; ')}`);
  }
});

test('规则说明生成:包含番种表与边角规则', () => {
  const doc = generateRuleDoc(guangdong);
  assert.ok(doc.includes('# 广东鸡平胡 规则说明'));
  assert.ok(doc.includes('清一色'));
  assert.ok(doc.includes('一炮多响'));
  assert.ok(doc.includes('封顶:5 番'));
});

test('配置校验能发现坏引用', () => {
  const bad = structuredClone(wuhan);
  bad.fans.push({ id: 'x', name: '坏番', score: 1, unit: 'fan', predicate: 'notExist' });
  bad.fans[0].excludes = ['ghost'];
  const errors = validateRulePack(bad);
  assert.ok(errors.some((e) => e.message.includes('notExist')));
  assert.ok(errors.some((e) => e.message.includes('ghost')));
});
