import type { RulePack } from './rule.ts';

export type ClaimType = 'hu' | 'gang' | 'peng' | 'chi';

export interface Claim {
  player: number; // 座位号 0..3
  type: ClaimType;
}

/**
 * 多家同时对一张打出的牌宣示时,按规则包优先级裁决。
 * 返回胜出的宣示(可能多家胡,见 resolveDiscardWinners)。
 */
export function resolveClaims(pack: RulePack, claims: Claim[]): Claim[] {
  if (claims.length === 0) return [];
  const prio = (c: Claim): number => pack.priorities[c.type];
  const best = Math.max(...claims.map(prio));
  return claims.filter((c) => prio(c) === best);
}

/**
 * 一张炮牌多家可胡时的处理:
 * - 一炮多响:全部胡(按离炮手最近的先结算)
 * - 否则截胡:炮手下家起逆时针最近的一家
 */
export function resolveDiscardWinners(
  pack: RulePack,
  discarder: number,
  huClaimants: number[],
  playerCount = 4,
): number[] {
  if (huClaimants.length <= 1) return huClaimants;
  const byDistance = [...huClaimants].sort(
    (a, b) => ((a - discarder + playerCount) % playerCount) - ((b - discarder + playerCount) % playerCount),
  );
  return pack.edge.yiPaoDuoXiang ? byDistance : [byDistance[0]];
}

/** 某种杠能否被抢杠胡 */
export function canRobKong(pack: RulePack, kongKind: 'added' | 'concealed' | 'discard'): boolean {
  const r = pack.edge.qiangGangHu;
  if (r === 'none') return false;
  if (r === 'addedKong') return kongKind === 'added'; // 多数地方只抢补杠/加杠
  return true;
}

/** 牌墙最后一张自摸是否计海底捞月 */
export function allowsHaidilao(pack: RulePack): boolean {
  return pack.edge.haidilao;
}

/** 最后一张打出的牌被胡是否计河底捞鱼 */
export function allowsHediyu(pack: RulePack): boolean {
  return pack.edge.hediyu;
}
