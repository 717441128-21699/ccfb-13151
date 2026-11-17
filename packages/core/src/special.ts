/**
 * 非标准型胡牌牌型：七对、十三幺。
 * 同样支持赖子补位，并输出与 Decomposition 同构的结构供番种引擎统一消费。
 */

import {
  TERMINAL_OR_HONOR_TILES,
  type HandTiles,
} from './tiles.js';
import type { Meld } from './decompose.js';

export interface SevenPairsDecomposition {
  kind: 'sevenPairs';
  pairs: Meld[]; // 长度恒为 7
  jokerUsed: number;
  signature: string;
}

export interface ThirteenOrphansDecomposition {
  kind: 'thirteenOrphans';
  /** 13 种幺九字牌，重复的那一种写两张 */
  tiles: number[];
  jokerSlots: number[];
  jokerUsed: number;
  /** 被重复（成对）的牌；赖子充当重复时为 null */
  duplicatedTile: number | null;
  signature: string;
}

export type SpecialDecomposition =
  | SevenPairsDecomposition
  | ThirteenOrphansDecomposition;

/** 七对：7 个对子。赖子可与单张配对，也可两张赖子自成对 */
export function matchSevenPairs(hand: HandTiles): SevenPairsDecomposition | null {
  if (hand.counts.some((c) => c > 4)) return null;
  let naturalPairs = 0;
  let singles = 0;
  const pairMelds: Meld[] = [];
  for (let t = 0; t < 34; t++) {
    const c = hand.counts[t] ?? 0;
    const pairs = Math.floor(c / 2);
    for (let k = 0; k < pairs; k++) {
      pairMelds.push({ type: 'pair', tiles: [t, t], jokerSlots: [] });
    }
    if (c % 2 === 1) singles++;
    naturalPairs += pairs;
  }
  const j = hand.jokers;
  // 单张各需 1 张赖子配对；余下赖子必须两两成对
  if (j < singles || (j - singles) % 2 !== 0) return null;
  const jokerJokerPairs = (j - singles) / 2;
  if (naturalPairs + singles + jokerJokerPairs !== 7) return null;

  let tileCursor = 0;
  const findSingle = (): number => {
    while (tileCursor < 34 && hand.counts[tileCursor]! % 2 === 0) tileCursor++;
    return tileCursor++;
  };
  for (let k = 0; k < singles; k++) {
    const t = findSingle();
    pairMelds.push({ type: 'pair', tiles: [t, t], jokerSlots: [1] });
  }
  for (let k = 0; k < jokerJokerPairs; k++) {
    // 两张赖子组成的对子没有自然牌面，用 -1 标记
    pairMelds.push({ type: 'pair', tiles: [-1, -1], jokerSlots: [0, 1] });
  }
  const signature = pairMelds
    .map((m) => `p:${m.tiles.join('.')}`)
    .sort()
    .join('|');
  return {
    kind: 'sevenPairs',
    pairs: pairMelds,
    jokerUsed: j,
    signature,
  };
}

/** 十三幺：13 种幺九字牌各至少 1 张，其中 1 种成对；赖子可补缺或充当重复 */
export function matchThirteenOrphans(hand: HandTiles): ThirteenOrphansDecomposition | null {
  for (let t = 0; t < 34; t++) {
    const c = hand.counts[t] ?? 0;
    if (c > 0 && !TERMINAL_OR_HONOR_TILES.includes(t)) return null; // 出现中张
  }
  let missing = 0;
  let duplicatedTile: number | null = null;
  const tiles: number[] = [];
  for (const t of TERMINAL_OR_HONOR_TILES) {
    const c = hand.counts[t] ?? 0;
    if (c === 0) {
      missing++;
    } else {
      if (c > 2) return null; // 某一种出现 3 张以上，不可能是十三幺
      if (c === 2) {
        if (duplicatedTile !== null) return null; // 重复来源只能有一个
        duplicatedTile = t;
      }
      for (let k = 0; k < c; k++) tiles.push(t);
    }
  }
  const j = hand.jokers;
  const naturalCount = 13 - missing + (duplicatedTile === null ? 0 : 1);
  if (naturalCount + j !== 14) return null;
  if (j < missing) return null;
  const leftoverJokers = j - missing; // 补缺之后剩余的赖子，只能是 0 或 1
  if (leftoverJokers !== 0 && leftoverJokers !== 1) return null;
  if (duplicatedTile !== null && leftoverJokers !== 0) return null;
  if (duplicatedTile === null && leftoverJokers !== 1) return null;

  const jokerSlots: number[] = []
  const filled: number[] = tiles.slice();
  // 补缺
  for (const t of TERMINAL_OR_HONOR_TILES) {
    if ((hand.counts[t] ?? 0) === 0) {
      jokerSlots.push(filled.length);
      filled.push(t);
    }
  }
  // 余下的 1 张赖子充当重复（成对）
  if (leftoverJokers === 1) {
    const dupTarget = filled[0]!;
    jokerSlots.push(filled.length);
    filled.push(dupTarget);
  }
  const signature = `orphan:${filled.slice().sort((a, b) => a - b).join('.')}`;
  return {
    kind: 'thirteenOrphans',
    tiles: filled,
    jokerSlots,
    jokerUsed: j,
    duplicatedTile,
    signature,
  };
}
