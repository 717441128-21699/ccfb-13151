/**
 * 对局边角事件裁决器。
 * 引擎本身不持有牌局状态机，只对「此刻谁声明了什么动作」做纯函数裁决，
 * 方便服务端与浏览器端共用同一套规则、同一批金手用例。
 */

import type { ActionKind, RuleSet } from './schema.js';

export interface ActionClaim {
  player: string;
  action: ActionKind;
  /** 该玩家这一手的起胡校验结果（scoreHand 产物），用于判断是否真能胡 */
  canWin?: boolean;
  /** 抢杠场景：被抢的杠类型 */
  kongKind?: 'exposed' | 'concealed' | 'added';
}

export interface ActionResolution {
  /** 被允许执行的声明（按优先级已排序） */
  accepted: ActionClaim[];
  rejected: Array<{ claim: ActionClaim; reason: string }>;
}

/** 同一张弃牌引发的多家声明，按规则集的动作优先级裁决 */
export function resolveClaims(rule: RuleSet, claims: ActionClaim[]): ActionResolution {
  const rank = new Map(rule.actionPriority.map((a, i) => [a, i]));
  const rejected: ActionResolution['rejected'] = [];

  // 抢杠胡先按事件开关过滤
  const eligible = claims.filter((c) => {
    if (c.action === 'robbingKong') {
      if (!rule.events.robKong) {
        rejected.push({ claim: c, reason: '本玩法不允许抢杠胡' });
        return false;
      }
      if (c.kongKind && !rule.events.robKongTargets.includes(c.kongKind)) {
        rejected.push({ claim: c, reason: `本玩法不允许抢${c.kongKind}杠` });
        return false;
      }
      if (c.canWin === false) {
        rejected.push({ claim: c, reason: '抢杠后牌面不满足胡牌条件' });
        return false;
      }
    }
    if (c.action === 'win' && c.canWin === false) {
      rejected.push({ claim: c, reason: '不满足起胡番数或牌型' });
      return false;
    }
    return true;
  });

  if (eligible.length === 0) return { accepted: [], rejected };

  // 一炮多响：荣胡声明可多家同时成立；其余动作按优先级取最高档
  const winClaims = eligible.filter((c) => c.action === 'win' || c.action === 'robbingKong');
  const otherClaims = eligible.filter((c) => !(c.action === 'win' || c.action === 'robbingKong'));

  const accepted: ActionClaim[] = [];
  if (winClaims.length > 1 && !rule.events.multipleWinnersOnDiscard) {
    // 不允许多响：按座次（声明顺序）取头家，其余拒绝
    accepted.push(winClaims[0]!);
    for (const c of winClaims.slice(1)) {
      rejected.push({ claim: c, reason: '本玩法不允许一炮多响，仅头家荣胡成立' });
    }
  } else {
    accepted.push(...winClaims);
  }

  if (otherClaims.length > 0) {
    const topRank = Math.min(
      ...otherClaims.map((c) => rank.get(c.action) ?? Number.MAX_SAFE_INTEGER),
    );
    for (const c of otherClaims) {
      if ((rank.get(c.action) ?? Number.MAX_SAFE_INTEGER) === topRank) accepted.push(c);
      else rejected.push({ claim: c, reason: `动作优先级低于 ${rule.actionPriority[topRank]}` });
    }
  }
  return { accepted, rejected };
}

/** 海底捞月 / 河底捞鱼 / 杠上开花 的合法性（在胡牌成立后调用） */
export function checkEventBonuses(
  rule: RuleSet,
  event: { bottomDraw: boolean; bottomDiscard: boolean; afterKong: boolean },
): string[] {
  const granted: string[] = [];
  if (event.bottomDraw && rule.events.bottomDrawWin) granted.push('bottomDraw');
  if (event.bottomDiscard && rule.events.bottomDiscardWin) granted.push('bottomDiscard');
  if (event.afterKong && rule.events.afterKongWin) granted.push('afterKong');
  return granted;
}
