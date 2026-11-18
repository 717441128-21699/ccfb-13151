import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveClaims } from '../src/core/claim-resolver.ts';
import { sichuanPack, guobiaoPack, laiziPack } from '../src/core/index.ts';
import type { SeatClaim, TableEvent } from '../src/core/claim-resolver.ts';

const discard: TableEvent = { type: 'discard', tile: 5, isLastTile: false };
const addKong: TableEvent = { type: 'addKong', tile: 5, isLastTile: false };

test('胡牌优先于吃碰，多家胡按一炮多响放行（四川）', () => {
  const candidates: SeatClaim[] = [
    { seat: 0, action: 'chow', wins: false },
    { seat: 1, action: 'win', wins: true },
    { seat: 2, action: 'win', wins: true },
    { seat: 3, action: 'pung', wins: false },
  ];
  const r = resolveClaims(sichuanPack, discard, candidates);
  assert.equal(r.accepted.length, 2);
  assert.ok(r.accepted.every((c) => c.action === 'win'));
  assert.ok(r.rejected.some((c) => c.action === 'pung'));
});

test('国标不允许多响：座位号最小者得，其余被拒并注明原因', () => {
  const candidates: SeatClaim[] = [
    { seat: 2, action: 'win', wins: true },
    { seat: 0, action: 'win', wins: true },
  ];
  const r = resolveClaims(guobiaoPack, discard, candidates);
  assert.equal(r.accepted.length, 1);
  assert.equal(r.accepted[0]!.seat, 0);
  assert.ok(r.rejected[0]!.reason.includes('一炮多响'));
});

test('无胡牌时按优先级取最高动作：碰 > 吃', () => {
  const candidates: SeatClaim[] = [
    { seat: 0, action: 'chow', wins: false },
    { seat: 1, action: 'pung', wins: false },
  ];
  const r = resolveClaims(sichuanPack, discard, candidates);
  assert.equal(r.accepted.length, 1);
  assert.equal(r.accepted[0]!.action, 'pung');
});

test('抢杠胡：四川放行，赖子包关闭', () => {
  const candidates: SeatClaim[] = [{ seat: 1, action: 'win', wins: true }];
  assert.equal(resolveClaims(sichuanPack, addKong, candidates).accepted.length, 1);
  const blocked = resolveClaims(laiziPack, addKong, candidates);
  assert.equal(blocked.accepted.length, 0);
  assert.ok(blocked.rejected[0]!.reason.includes('抢杠'));
});

test('补杠事件中的非胡动作一律拒绝', () => {
  const candidates: SeatClaim[] = [{ seat: 1, action: 'pung', wins: false }];
  const r = resolveClaims(sichuanPack, addKong, candidates);
  assert.equal(r.accepted.length, 0);
});
