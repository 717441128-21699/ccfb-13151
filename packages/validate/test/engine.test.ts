/**
 * 番种引擎与交叉校验器测试。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseHand } from '@mahjong/core';
import {
  scoreHand,
  validateRuleSet,
  resolveClaims,
  sichuanRule,
  guangdongRule,
} from '@mahjong/rules';
import { crossCheckHandString, runSuite, sichuanGolden, guangdongGolden } from '../src/index.ts';

test('四川：缺门约束拒绝三门胡牌', () => {
  const r = scoreHand({ hand: parseHand('123m456m789m123s11z'), rule: sichuanRule });
  assert.equal(r.win, false);
  assert.ok(r.rejectedReasons.some((x) => x.includes('全局约束')));
});

test('四川：两门平胡 1 番', () => {
  const r = scoreHand({ hand: parseHand('123m456m789m234p11p'), rule: sichuanRule });
  assert.equal(r.win, true);
  assert.equal(r.best!.totalFan, 1);
});

test('交叉校验器：无赖子标准胡牌两实现一致', () => {
  const c = crossCheckHandString('123m456m789m234p11p', sichuanRule);
  assert.equal(c.consistent, true);
  assert.equal(c.partitionWin, true);
});

test('交叉校验器：两赖补牌胡牌两实现一致', () => {
  const c = crossCheckHandString('1245789m234p11pXX', sichuanRule);
  assert.equal(c.consistent, true);
});

test('交叉校验器：乱牌两实现都判不胡', () => {
  const c = crossCheckHandString('135m246m135p246p1m', guangdongRule);
  assert.equal(c.consistent, true);
  assert.equal(c.partitionWin, false);
});

test('广东：十三幺役满直接封 13 且不叠小番', () => {
  const r = scoreHand({ hand: parseHand('19m19s19p1234567z1m'), rule: guangdongRule });
  assert.equal(r.win, true);
  assert.equal(r.best!.points, 13);
  assert.deepEqual(r.best!.hits.map((h) => h.fanId), ['shi-san-yao']);
});

test('广东：自摸与门前清互斥不共存', () => {
  const r = scoreHand({
    hand: parseHand('123m456m789m234p11p'),
    rule: guangdongRule,
    context: { selfDrawn: true },
  });
  const ids = r.best!.hits.map((h) => h.fanId);
  assert.ok(ids.includes('zi-mo'));
  assert.ok(!ids.includes('men-qian'));
});

test('规则集静态校验：两份模板零错误（含环检测）', () => {
  assert.deepEqual(validateRuleSet(sichuanRule), []);
  assert.deepEqual(validateRuleSet(guangdongRule), []);
});

test('事件裁决：四川允许一炮多响，两家荣胡同时成立', () => {
  const res = resolveClaims(sichuanRule, [
    { player: 'A', action: 'win', canWin: true },
    { player: 'B', action: 'win', canWin: true },
    { player: 'C', action: 'pung' },
  ]);
  assert.equal(res.accepted.filter((c) => c.action === 'win').length, 2);
});

test('事件裁决：广东不允许多响，仅头家成立', () => {
  const res = resolveClaims(guangdongRule, [
    { player: 'A', action: 'win', canWin: true },
    { player: 'B', action: 'win', canWin: true },
  ]);
  assert.equal(res.accepted.length, 1);
  assert.equal(res.rejected.length, 1);
});

test('事件裁决：抢杠目标不允许时驳回', () => {
  const res = resolveClaims(guangdongRule, [
    { player: 'A', action: 'robbingKong', canWin: true, kongKind: 'concealed' },
  ]);
  assert.equal(res.accepted.length, 0);
  assert.ok(res.rejected[0]!.reason.includes('不允许抢'));
});

test('金手种子集：两玩法全部通过', () => {
  const sc = runSuite(sichuanGolden, sichuanRule);
  const gd = runSuite(guangdongGolden, guangdongRule);
  assert.equal(sc.failed, 0);
  assert.equal(gd.failed, 0);
});

test('manual 用例缺少 reviewer 会被判失败（留痕要求）', () => {
  const suite = {
    ruleId: sichuanRule.id,
    cases: [
      {
        ...sichuanGolden.cases[0]!,
        id: 'X-NO-REVIEWER',
        provenance: 'manual' as const,
        reviewer: undefined,
      },
    ],
  };
  const report = runSuite(suite, sichuanRule);
  assert.ok(report.failures.some((f) => f.field === 'reviewer'));
});
