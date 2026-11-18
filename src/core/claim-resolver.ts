/**
 * 动作解析器：一次牌事件（弃牌/补杠/海底）发生后，按规则包的优先级
 * 解析多家可响应动作，覆盖一炮多响、抢杠胡、海底捞月等边角情况。
 *
 * 平台侧只负责“谁能做什么动作”的判定与排序；具体动作合法性
 * （能不能吃这张、能不能明杠）由调用方传入候选，引擎不重复算牌。
 */

import type { ClaimAction, RulePack } from '../rules/types.ts';

export type TableEvent =
  | { type: 'discard'; tile: number; isLastTile: boolean }
  | { type: 'addKong'; tile: number; isLastTile: boolean }
  | { type: 'selfDraw'; tile: number; isLastTile: boolean };

export interface SeatClaim {
  seat: number;
  action: ClaimAction;
  /** 该动作是否构成胡牌（用于多响判定） */
  wins: boolean;
}

export interface ResolvedClaims {
  /** 最终可执行的动作（已按优先级/规则裁剪） */
  accepted: SeatClaim[];
  rejected: Array<SeatClaim & { reason: string }>;
}

function rankOf(pack: RulePack, action: ClaimAction): number {
  const i = pack.claim.order.indexOf(action);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}

export function resolveClaims(
  pack: RulePack,
  event: TableEvent,
  candidates: SeatClaim[],
): ResolvedClaims {
  const rejected: Array<SeatClaim & { reason: string }> = [];
  let working = candidates;

  // 1) 抢杠胡开关：补杠事件只允许胡牌类响应，且规则包必须放行
  if (event.type === 'addKong') {
    working = working.filter((c) => {
      if (c.action === 'win') {
        if (!pack.claim.robbingKong) {
          rejected.push({ ...c, reason: '本玩法禁止抢杠胡' });
          return false;
        }
        return true;
      }
      rejected.push({ ...c, reason: '补杠事件中仅抢杠胡可响应' });
      return false;
    });
  }

  // 2) 海底捞月：最后一张牌的胡牌响应打上标记由番型层加番（这里只校验开关）
  if (event.isLastTile && !pack.claim.lastTileBonus) {
    // 不加番但动作本身仍成立；是否允许海底胡由各地规则决定，这里保守放行
  }

  // 3) 一炮多响
  const winClaims = working.filter((c) => c.action === 'win' && c.wins);
  const nonWin = working.filter((c) => !(c.action === 'win' && c.wins));

  let acceptedWins: SeatClaim[];
  if (winClaims.length > 1 && !pack.claim.multiWin) {
    const sorted = [...winClaims].sort((a, b) => a.seat - b.seat);
    acceptedWins = [sorted[0]!];
    for (const c of sorted.slice(1)) rejected.push({ ...c, reason: '本玩法不允许一炮多响，按座位号取首家' });
  } else {
    acceptedWins = winClaims;
  }

  // 4) 胡牌优先于一切；存在胡牌响应时，非胡动作全部压下
  let acceptedNonWin: SeatClaim[] = [];
  if (acceptedWins.length === 0) {
    const sorted = [...nonWin].sort((a, b) => rankOf(pack, a.action) - rankOf(pack, b.action));
    const topRank = sorted.length > 0 ? rankOf(pack, sorted[0]!.action) : Number.POSITIVE_INFINITY;
    for (const c of sorted) {
      if (rankOf(pack, c.action) === topRank) acceptedNonWin.push(c);
      else rejected.push({ ...c, reason: `动作 ${c.action} 优先级低于当前最高优先级` });
    }
  } else {
    for (const c of nonWin) rejected.push({ ...c, reason: '胡牌响应优先，吃碰杠动作搁置' });
  }

  const accepted = [...acceptedWins, ...acceptedNonWin].sort(
    (a, b) => rankOf(pack, a.action) - rankOf(pack, b.action) || a.seat - b.seat,
  );
  return { accepted, rejected };
}
