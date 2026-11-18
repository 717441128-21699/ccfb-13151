/**
 * 测试辅助：记号法快捷构造、随机合法牌生成、断言工具。
 */

import { TILE_KINDS, parseHand } from '../src/core/tiles.ts';
import { fromParsed } from '../src/core/hand.ts';
import type { HandState } from '../src/core/hand.ts';
import type { GameContext } from '../src/core/predicates.ts';

export function h(notation: string): HandState {
  return fromParsed(parseHand(notation));
}

export function defaultGame(overrides: Partial<GameContext> = {}): GameContext {
  return {
    winMethod: 'discard',
    exposedKongs: 0,
    concealedKongs: 0,
    exposedMelds: 0,
    isLastTile: false,
    absentSuit: null,
    ...overrides,
  };
}

/**
 * 随机生成一手牌。
 * structured=true（默认）：按“面子+将”结构组装，再随机替换 0..2 张为赖子，
 * 保证样本中有足量胡牌牌例；structured=false 时纯随机散牌。
 */
export function randomHand(rng: () => number, maxWild = 2, total = 14, structured = true): HandState {
  if (!structured || rng() < 0.3) {
    return randomScattered(rng, total);
  }
  const counts = new Array<number>(TILE_KINDS).fill(0);
  const remaining = new Array<number>(TILE_KINDS).fill(4);
  const place = (id: number, n: number): boolean => {
    if ((remaining[id] ?? 0) < n) return false;
    counts[id] = (counts[id] ?? 0) + n;
    remaining[id] = (remaining[id] ?? 0) - n;
    return true;
  };

  // 4 组面子：随机刻子或顺子
  for (let g = 0; g < 4; g++) {
    let ok = false;
    for (let attempt = 0; attempt < 20 && !ok; attempt++) {
      if (rng() < 0.4) {
        const id = Math.floor(rng() * TILE_KINDS);
        ok = place(id, 3);
      } else {
        const suit = Math.floor(rng() * 3) * 9;
        const start = suit + Math.floor(rng() * 7);
        ok = place(start, 1) && place(start + 1, 1) && place(start + 2, 1);
        if (!ok) {
          // 回滚
          counts[start] = Math.max(0, counts[start]! - 1);
          counts[start + 1] = Math.max(0, counts[start + 1]! - 1);
          counts[start + 2] = Math.max(0, counts[start + 2]! - 1);
          remaining[start] = (remaining[start] ?? 0) + 1;
          remaining[start + 1] = (remaining[start + 1] ?? 0) + 1;
          remaining[start + 2] = (remaining[start + 2] ?? 0) + 1;
        }
      }
    }
    if (!ok) return randomScattered(rng, total);
  }
  // 将
  let pairOk = false;
  for (let attempt = 0; attempt < 20 && !pairOk; attempt++) {
    const id = Math.floor(rng() * TILE_KINDS);
    pairOk = place(id, 2);
  }
  if (!pairOk) return randomScattered(rng, total);

  const placed = counts.reduce((a, b) => a + b, 0);
  if (placed !== total) return randomScattered(rng, total);

  // 随机把 0..maxWild 张天然牌标成赖子（从计数中移出）
  const wildcards = Math.floor(rng() * (maxWild + 1));
  let w = 0;
  for (let id = 0; id < TILE_KINDS && w < wildcards; id++) {
    while ((counts[id] ?? 0) > 0 && w < wildcards) {
      counts[id] = (counts[id] ?? 0) - 1;
      w += 1;
    }
  }
  return { counts, wildcards: w };
}

function randomScattered(rng: () => number, total: number): HandState {
  const counts = new Array<number>(TILE_KINDS).fill(0);
  const remaining = new Array<number>(TILE_KINDS).fill(4);
  let placed = 0;
  while (placed < total) {
    const id = Math.floor(rng() * TILE_KINDS);
    if ((remaining[id] ?? 0) === 0) continue;
    counts[id] = (counts[id] ?? 0) + 1;
    remaining[id] = (remaining[id] ?? 0) - 1;
    placed += 1;
  }
  return { counts, wildcards: 0 };
}

/** 深比较集合内容（顺序无关） */
export function asIdSet(items: number[]): Set<number> {
  return new Set(items);
}
