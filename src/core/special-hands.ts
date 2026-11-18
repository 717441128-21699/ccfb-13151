/**
 * 非常规胡牌牌型枚举：七对、十三幺。
 * 这两类不满足“n 面子 + 1 将”结构，单独建模。
 *
 * 赖子语义（与各地规则包配合，这里枚举所有数学可能）：
 *  - 七对：赖子可与单张天然牌配对，或两张互配（目标由展开器枚举）
 *  - 十三幺：赖子补缺种，另有富余时与已有的幺九字配对
 */

import { TILE_KINDS, isTerminalOrHonor } from './tiles.ts';
import type { HandState } from './hand.ts';
import type { Decomposition, Meld } from './decompose.ts';

const ORPHAN_SET: number[] = (() => {
  const ids: number[] = [];
  for (let id = 0; id < TILE_KINDS; id++) {
    if (isTerminalOrHonor(id)) ids.push(id);
  }
  return ids; // 13 种：1/9 万条筒 + 7 字
})();

export function isOrphanTile(id: number): boolean {
  return isTerminalOrHonor(id);
}

function pairMeld(id: number, naturalCount: number, wildUsed: number): Meld {
  return {
    type: 'pair',
    targetTiles: [id, id],
    naturalTiles: naturalCount === 2 ? [id, id] : [id],
    wildUsed,
  };
}

/**
 * 七对枚举。
 * 天然计数为 4 的牌种生成两个对子（经典七对允许，“豪华七对”番种再额外识别）。
 * 赖子：W 张必须恰好补上 m 个缺对（单张天然牌），或 W=m+1（两赖互配一对）。
 */
export function enumerateSevenPairs(hand: HandState): Decomposition[] {
  const { counts, wildcards: W } = hand;
  const pairs: Meld[] = [];
  const singles: number[] = [];
  let quads = 0;

  for (let id = 0; id < TILE_KINDS; id++) {
    const c = counts[id] ?? 0;
    if (c === 4) {
      pairs.push(pairMeld(id, 2, 0), pairMeld(id, 2, 0));
      quads += 1;
    } else if (c === 2) {
      pairs.push(pairMeld(id, 2, 0));
    } else if (c === 3) {
      return []; // 三张同种无法纳入七对
    } else if (c === 1) {
      singles.push(id);
    }
  }

  const m = singles.length;
  // 赖子要么逐一补单张（W=m），要么补完单张后两张互配（W=m+2）
  if (W !== m && W !== m + 2) return [];
  const wildPair = W === m + 2;
  if (pairs.length + m + (wildPair ? 1 : 0) !== 7) return [];

  const resultPairs = [...pairs];
  for (const id of singles) resultPairs.push(pairMeld(id, 1, 1));

  const wildRemaining = wildPair ? 2 : 0;
  const key = `7:${resultPairs.map((p) => p.targetTiles[0]).join('.')}:w${wildRemaining}`;
  return [{
    kind: 'sevenPairs',
    melds: [],
    pair: null,
    pairs: resultPairs,
    wildRemaining,
    key,
  }];
}

/**
 * 十三幺枚举。
 * 13 种幺九字牌，每种天然计数只允许 0/1/2；超过 2 不成立。
 * 缺种必须全部能由赖子补齐；富余赖子为 0（单听）或 1（对子由一赖配天然），
 * 富余为 2 时两赖互配，目标幺九字由展开器枚举。
 */
export function enumerateThirteenOrphans(hand: HandState): Decomposition[] {
  const { counts, wildcards: W } = hand;

  for (let id = 0; id < TILE_KINDS; id++) {
    const c = counts[id] ?? 0;
    if (c === 0) continue;
    if (!isTerminalOrHonor(id) || c > 2) return [];
  }

  const present = ORPHAN_SET.filter((id) => (counts[id] ?? 0) > 0);
  const missing = ORPHAN_SET.filter((id) => (counts[id] ?? 0) === 0);
  const doubled = ORPHAN_SET.filter((id) => (counts[id] ?? 0) === 2);

  const wildForMissing = missing.length;
  const extra = W - wildForMissing;
  if (extra < 0 || extra > 2) return [];

  const singles: Meld[] = present
    .filter((id) => counts[id] === 1)
    .map((id) => ({ type: 'single' as const, targetTiles: [id], naturalTiles: [id], wildUsed: 0 }));

  const results: Decomposition[] = [];

  const build = (pairMeldObj: Meld | null, rem: number): Decomposition => ({
    kind: 'thirteenOrphans',
    melds: [],
    pair: pairMeldObj,
    singles,
    wildRemaining: rem,
    key: `13:${pairMeldObj ? pairMeldObj.targetTiles[0] : `w${rem}`}`,
  });

  if (extra === 0) {
    // 无富余赖：必须恰好一个天然对子
    if (doubled.length !== 1) return [];
    results.push(build(pairMeld(doubled[0]!, 2, 0), 0));
  } else if (extra === 1) {
    if (doubled.length === 1) {
      // 天然对子已存在，富余的一张赖补作缺种单牌（语义已在 wildForMissing 外消耗）
      results.push(build(pairMeld(doubled[0]!, 2, 0), 0));
    } else if (doubled.length === 0) {
      // 无天然对子：一赖与任一在场幺九字配对，枚举全部候选
      if (present.length === 0) return [];
      for (const id of present) results.push(build(pairMeld(id, 1, 1), 0));
    } else {
      return [];
    }
  } else {
    // extra === 2：两赖互配，目标牌种交给展开器；天然侧不能已有对子
    if (doubled.length !== 0) return [];
    results.push(build(null, 2));
  }
  return results;
}
