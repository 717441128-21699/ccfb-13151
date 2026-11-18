/**
 * 胡牌分析与听牌枚举。
 *
 * analyzeHand：14 张 -> 是否胡、全部拆分（含展开后的具体赖子目标）
 * findWaits：  13 张 -> 全部可胡进张及对应拆分
 */

import { TILE_KINDS } from './tiles.ts';
import { addTile } from './hand.ts';
import type { HandState } from './hand.ts';
import { enumerateStandard } from './decompose.ts';
import { enumerateSevenPairs, enumerateThirteenOrphans } from './special-hands.ts';
import { expandAll } from './expand-wild.ts';
import type { Decomposition } from './decompose.ts';

export interface WaitResult {
  tile: number;
  decompositions: Decomposition[];
}

export interface HandAnalysis {
  /** 总张数（13 或 14） */
  total: number;
  /** 14 张时：是否构成任一胡牌结构 */
  isWin: boolean;
  /** 全部具体拆分（赖子已展开为确定目标） */
  decompositions: Decomposition[];
  /** 13 张时：听牌列表 */
  waits: WaitResult[];
}

function enumerateAll(hand: HandState): Decomposition[] {
  return expandAll([
    ...enumerateStandard(hand),
    ...enumerateSevenPairs(hand),
    ...enumerateThirteenOrphans(hand),
  ]);
}

export function analyzeHand(hand: HandState): HandAnalysis {
  const total = hand.counts.reduce((a, b) => a + b, 0) + hand.wildcards;
  const decompositions = total === 14 ? enumerateAll(hand) : [];
  const waits: WaitResult[] = [];

  if (total === 13) {
    for (let id = 0; id < TILE_KINDS; id++) {
      if ((hand.counts[id] ?? 0) >= 4) continue;
      const next = addTile(hand, id);
      const wins = enumerateAll(next);
      if (wins.length > 0) waits.push({ tile: id, decompositions: wins });
    }
  }

  return {
    total,
    isWin: total === 14 && decompositions.length > 0,
    decompositions,
    waits,
  };
}
