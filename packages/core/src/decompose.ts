/**
 * 拆牌引擎：把一手牌穷举为「4 面子 + 1 将」的全部合法拆法，赖子可充当任意牌。
 *
 * 性能设计（目标：14 张含 2 赖子，2ms 内穷举完毕）：
 *  1. 热路径只操作 Uint8Array 计数与标量，不做任何对象/数组分配；
 *  2. 锚定 DFS：每一步只处理「当前编号最小的剩余自然牌」，
 *     它必然属于下一个面子/将，候选动作有限（将/刻/顺，顺起点最多 3 个），
 *     天然避免面子排列带来的重复搜索；
 *  3. 赖子只在「非锚定槽位」二选一（替不替），锚定槽位强制吃自然牌，
 *     可证明不丢解（任何解里含该最小牌的面子都可被提到最前）；
 *  4. 叶子节点按成型牌面签名去重——同一组可见面子的不同赖子落槽只算一种拆法；
 *  5. 七对 / 十三幺等特殊牌型不走本引擎，见 special.ts。
 */

import type { HandTiles } from './tiles.js';

export interface Meld {
  type: 'triplet' | 'sequence' | 'pair';
  /** 成型后的牌（刻/顺 3 张，将 2 张），值为自然牌编号；赖子充当的牌也写成其扮演的编号 */
  tiles: number[];
  /** tiles 中由赖子充当的位置 */
  jokerSlots: number[];
}

export interface Decomposition {
  kind: 'standard';
  melds: Meld[]; // 长度恒为 5：4 面子 + 1 将
  jokerUsed: number;
  /** 成型牌面签名，用于去重与番种引擎缓存 */
  signature: string;
}

interface SearchState {
  work: Uint8Array;
  jokersLeft: number;
  pairFormed: boolean;
  melds: Meld[];
  results: Decomposition[];
  seen: Set<string>;
}

function suitBase(tile: number): number {
  return tile < 9 ? 0 : tile < 18 ? 9 : 18;
}

function record(state: SearchState): void {
  if (state.jokersLeft !== 0) return;
  // 规范化签名：面子按成型牌面排序，将排最后
  const sig = state.melds
    .map((m) => `${m.type[0]}:${m.tiles.join('.')}`)
    .sort()
    .join('|');
  if (state.seen.has(sig)) return;
  state.seen.add(sig);
  state.results.push({
    kind: 'standard',
    melds: state.melds.map((m) => ({
      type: m.type,
      tiles: m.tiles.slice(),
      jokerSlots: m.jokerSlots.slice(),
    })),
    jokerUsed: state.melds.reduce(
      (n, m) => n + m.jokerSlots.length,
      0,
    ),
    signature: sig,
  });
}

function dfs(state: SearchState): void {
  const { work } = state;
  // 找最小的剩余自然牌
  let anchor = -1;
  for (let t = 0; t < 34; t++) {
    if (work[t]! > 0) {
      anchor = t;
      break;
    }
  }
  if (anchor === -1) {
    record(state);
    return;
  }

  // ---- 候选 1：将（整手牌至多一个）----
  if (!state.pairFormed) {
    // 1a. 两张自然牌
    if (work[anchor]! >= 2) {
      work[anchor]! -= 2;
      state.pairFormed = true;
      state.melds.push({ type: 'pair', tiles: [anchor, anchor], jokerSlots: [] });
      dfs(state);
      state.melds.pop();
      state.pairFormed = false;
      work[anchor]! += 2;
    }
    // 1b. 一自然 + 一赖子
    if (state.jokersLeft >= 1) {
      work[anchor]! -= 1;
      state.jokersLeft -= 1;
      state.pairFormed = true;
      state.melds.push({ type: 'pair', tiles: [anchor, anchor], jokerSlots: [1] });
      dfs(state);
      state.melds.pop();
      state.pairFormed = false;
      state.jokersLeft += 1;
      work[anchor]! += 1;
    }
  }

  // 1c. 两张赖子自成将（不依赖锚定牌，单独处理，整局至多一次）
  if (!state.pairFormed && state.jokersLeft >= 2) {
    state.jokersLeft -= 2;
    state.pairFormed = true;
    state.melds.push({ type: 'pair', tiles: [-1, -1], jokerSlots: [0, 1] });
    dfs(state);
    state.melds.pop();
    state.pairFormed = false;
    state.jokersLeft += 2;
  }

  // ---- 候选 2：刻子 ----
  // 2a. 三张自然
  if (work[anchor]! >= 3) {
    work[anchor]! -= 3;
    state.melds.push({ type: 'triplet', tiles: [anchor, anchor, anchor], jokerSlots: [] });
    dfs(state);
    state.melds.pop();
    work[anchor]! += 3;
  }
  // 2b. 两自然 + 一赖子
  if (work[anchor]! >= 2 && state.jokersLeft >= 1) {
    work[anchor]! -= 2;
    state.jokersLeft -= 1;
    state.melds.push({ type: 'triplet', tiles: [anchor, anchor, anchor], jokerSlots: [2] });
    dfs(state);
    state.melds.pop();
    state.jokersLeft += 1;
    work[anchor]! += 2;
  }
  // 2c. 一自然 + 两赖子
  if (work[anchor]! >= 1 && state.jokersLeft >= 2) {
    work[anchor]! -= 1;
    state.jokersLeft -= 2;
    state.melds.push({
      type: 'triplet',
      tiles: [anchor, anchor, anchor],
      jokerSlots: [1, 2],
    });
    dfs(state);
    state.melds.pop();
    state.jokersLeft += 2;
    work[anchor]! += 1;
  }

  // ---- 候选 3：顺子（仅数牌；起点 s 满足 s ≤ anchor ≤ s+2）----
  if (anchor < 27) {
    const base = suitBase(anchor);
    const sMin = Math.max(base, anchor - 2);
    const sMax = Math.min(anchor, base + 6); // s+2 ≤ base+8
    for (let s = sMin; s <= sMax; s++) {
      const anchorIdx = anchor - s; // 锚定槽位，强制自然牌
      // 其他两个槽位：各有「用自然 / 用赖子（若赖子充足）」两种选择
      const others = [0, 1, 2].filter((i) => i !== anchorIdx);
      for (let mask = 0; mask < 4; mask++) {
        const useJoker = [
          (mask & 1) === 1,
          (mask & 2) === 2,
        ];
        let jokersNeed = 0;
        let ok = true;
        for (let k = 0; k < others.length; k++) {
          const slot = others[k]!;
          const tile = s + slot;
          if (useJoker[k]) {
            jokersNeed++;
          } else if (work[tile]! === 0) {
            ok = false; // 没有自然牌又不允许赖子顶替
            break;
          }
        }
        if (!ok || jokersNeed > state.jokersLeft) continue;
        // 提交
        const tiles = [s, s + 1, s + 2];
        const jokerSlots: number[] = [];
        for (let k = 0; k < others.length; k++) {
          const slot = others[k]!;
          const tile = s + slot;
          if (useJoker[k]) {
            jokerSlots.push(slot);
          } else {
            work[tile]! -= 1;
          }
        }
        work[anchor]! -= 1; // 锚定槽位自然牌
        state.jokersLeft -= jokersNeed;
        state.melds.push({ type: 'sequence', tiles, jokerSlots });
        dfs(state);
        state.melds.pop();
        state.jokersLeft += jokersNeed;
        work[anchor]! += 1;
        for (let k = 0; k < others.length; k++) {
          const slot = others[k]!;
          if (!useJoker[k]) work[s + slot]! += 1;
        }
      }
    }
  }
}

/** 穷举标准型（4 面子 + 1 将）全部拆法 */
export function enumerateStandard(hand: HandTiles): Decomposition[] {
  const work = new Uint8Array(34);
  for (let t = 0; t < 34; t++) work[t] = hand.counts[t] ?? 0;
  const state: SearchState = {
    work,
    jokersLeft: hand.jokers,
    pairFormed: false,
    melds: [],
    results: [],
    seen: new Set(),
  };
  dfs(state);
  return state.results;
}

/** 拆法总数（轻量场景使用，仍然完整穷举后计数） */
export function countDecompositions(hand: HandTiles): number {
  return enumerateStandard(hand).length;
}
