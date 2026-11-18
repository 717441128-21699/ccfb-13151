/**
 * 拆分结果中的“待定赖子”展开器。
 *
 * 拆分引擎对“两张赖子互配”的场景不预设目标牌种（同一结构可对应 34 种目标），
 * 由本模块在番型判定前按牌种枚举展开，保持核心引擎紧凑、可缓存。
 */

import { TILE_KINDS } from './tiles.ts';
import type { Decomposition, Meld } from './decompose.ts';

function cloneWithPair(d: Decomposition, pair: Meld): Decomposition {
  return { ...d, pair, wildRemaining: 0, key: `${d.key}->${pair.targetTiles[0]}` };
}

/**
 * 把一个含待定赖子（wildRemaining=2）的拆分展开为全部具体拆分。
 * 无待定赖子时原样返回。
 */
export function expandWildcards(d: Decomposition): Decomposition[] {
  if (d.wildRemaining === 0) return [d];

  if (d.kind === 'standard') {
    const out: Decomposition[] = [];
    for (let id = 0; id < TILE_KINDS; id++) {
      const pair: Meld = {
        type: 'pair',
        targetTiles: [id, id],
        naturalTiles: [],
        wildUsed: 2,
      };
      out.push(cloneWithPair(d, pair));
    }
    return out;
  }

  if (d.kind === 'sevenPairs') {
    const out: Decomposition[] = [];
    for (let id = 0; id < TILE_KINDS; id++) {
      const pair: Meld = { type: 'pair', targetTiles: [id, id], naturalTiles: [], wildUsed: 2 };
      out.push({
        ...d,
        pairs: [...(d.pairs ?? []), pair],
        pair: null,
        wildRemaining: 0,
        key: `${d.key}->${id}`,
      });
    }
    return out;
  }

  if (d.kind === 'thirteenOrphans') {
    const out: Decomposition[] = [];
    // 十三幺的赖子将只能落在 13 种幺九字上
    for (const single of d.singles ?? []) {
      const id = single.targetTiles[0]!;
      const pair: Meld = { type: 'pair', targetTiles: [id, id], naturalTiles: [], wildUsed: 2 };
      out.push(cloneWithPair(d, pair));
    }
    return out;
  }

  return [d];
}

/** 批量展开并去重 */
export function expandAll(decompositions: Decomposition[]): Decomposition[] {
  const seen = new Set<string>();
  const out: Decomposition[] = [];
  for (const d of decompositions) {
    for (const e of expandWildcards(d)) {
      if (seen.has(e.key)) continue;
      seen.add(e.key);
      out.push(e);
    }
  }
  return out;
}
