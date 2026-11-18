/**
 * 手牌状态：14 张（或 13 张听牌）牌张计数 + 赖子数。
 * 引擎内部统一用 counts 数组（天然形态计数）+ wildcards 表达，
 * 赖子“变成什么”由拆分算法决定，而不是在输入层定死。
 */

import { TILE_KINDS, parseHand, handToNotation } from './tiles.ts';
import type { ParsedHand } from './tiles.ts';

export interface HandState {
  /** 长度 34，各牌种天然张数（含赖子的天然形态） */
  counts: number[];
  /** 赖子数量（这些牌已包含在 counts 的天然形态位上） */
  wildcards: number;
}

export function fromParsed(parsed: ParsedHand): HandState {
  return { counts: [...parsed.counts], wildcards: parsed.wildcards };
}

export function fromNotation(input: string): HandState {
  return fromParsed(parseHand(input));
}

export function totalTiles(hand: HandState): number {
  return hand.counts.reduce((a, b) => a + b, 0) + hand.wildcards;
}

export function cloneHand(hand: HandState): HandState {
  return { counts: [...hand.counts], wildcards: hand.wildcards };
}

export function toNotation(hand: HandState, wildcardNaturalId = 0): string {
  return handToNotation(hand.counts, hand.wildcards, wildcardNaturalId);
}

/** 加一张实体牌（听牌枚举时使用） */
export function addTile(hand: HandState, id: number): HandState {
  const counts = [...hand.counts];
  counts[id] = (counts[id] ?? 0) + 1;
  return { counts, wildcards: hand.wildcards };
}

/** 加一张赖子（不计入天然 counts） */
export function addWildcard(hand: HandState, naturalId: number): HandState {
  void naturalId;
  return { counts: [...hand.counts], wildcards: hand.wildcards + 1 };
}

/** 校验：张数合法、单牌种不超过 4 张（含赖子天然形态） */
export function validateHand(hand: HandState): void {
  const total = totalTiles(hand);
  if (total !== 13 && total !== 14) {
    throw new Error(`手牌张数应为 13 或 14，实际 ${total}`);
  }
  if (hand.wildcards < 0 || hand.wildcards > total) {
    throw new Error(`赖子数非法: ${hand.wildcards}`);
  }
  for (let id = 0; id < TILE_KINDS; id++) {
    const n = hand.counts[id] ?? 0;
    if (n < 0 || n > 4) {
      throw new Error(`牌 ${id} 张数非法: ${n}`);
    }
  }
}
