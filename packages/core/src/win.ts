/**
 * 胡牌判定与听牌枚举。
 * 胡牌牌型开关由规则配置决定（标准型 / 七对 / 十三幺），
 * 本文件只负责「牌面层面能不能胡」，番种计算在 fanEngine.ts。
 */

import {
  cloneHand,
  totalTiles,
  type HandTiles,
} from './tiles.js';
import { enumerateStandard, type Decomposition } from './decompose.js';
import {
  matchSevenPairs,
  matchThirteenOrphans,
  type SpecialDecomposition,
} from './special.js';

export interface WinPatternOptions {
  sevenPairs?: boolean;
  thirteenOrphans?: boolean;
}

export type AnyDecomposition = Decomposition | SpecialDecomposition;

export interface WinCheckResult {
  win: boolean;
  decompositions: AnyDecomposition[];
}

/** 判定一手牌是否胡，并返回全部可行拆法（标准型 + 允许的特殊型） */
export function checkWin(
  hand: HandTiles,
  options: WinPatternOptions = {},
): WinCheckResult {
  const decompositions: AnyDecomposition[] = [];
  // 标准型要求 3n+2 张；七对/十三幺要求 14 张
  const total = totalTiles(hand);
  if (total % 3 !== 2) return { win: false, decompositions };

  for (const d of enumerateStandard(hand)) decompositions.push(d);

  if (options.sevenPairs && total === 14) {
    const sp = matchSevenPairs(hand);
    if (sp) decompositions.push(sp);
  }
  if (options.thirteenOrphans && total === 14) {
    const to = matchThirteenOrphans(hand);
    if (to) decompositions.push(to);
  }
  return { win: decompositions.length > 0, decompositions };
}

export interface WaitTile {
  tile: number;
  /** 摸入该牌后的可行拆法数量 */
  decompositionCount: number;
  /** 该牌是自摸/荣胡均可的普通待牌，还是需要赖子（见调用方规则） */
  viaJoker: boolean;
}

/**
 * 枚举听牌：对 n 张手牌（通常 13 张），逐张试摸 34 种自然牌与赖子，
 * 看摸入后是否可胡。注意：返回的是「牌面听牌」，番种限制（如必须缺门）
 * 由番种引擎在计分阶段过滤。
 */
export function listWaits(
  hand: HandTiles,
  options: WinPatternOptions = {},
): WaitTile[] {
  const waits: WaitTile[] = [];
  for (let t = 0; t < 34; t++) {
    const trial = cloneHand(hand);
    if (trial.counts[t]! >= 4) continue;
    trial.counts[t]!++;
    const r = checkWin(trial, options);
    if (r.win) {
      waits.push({ tile: t, decompositionCount: r.decompositions.length, viaJoker: false });
    }
  }
  // 摸赖子能否胡
  const jokerTrial = cloneHand(hand);
  jokerTrial.jokers++;
  const jr = checkWin(jokerTrial, options);
  if (jr.win) {
    waits.push({ tile: -1, decompositionCount: jr.decompositions.length, viaJoker: true });
  }
  return waits;
}
