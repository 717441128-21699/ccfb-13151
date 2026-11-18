/**
 * 标准牌型（n 副面子 + 1 将）拆分穷举引擎（性能优化版）。
 *
 * 设计要点：
 * 1. 永远从“当前编号最小的非零牌种”开始分支，消除排列重复；
 * 2. 每个节点只枚举包含该牌的组（将/刻子/顺子），分支数有常数上界；
 * 3. 赖子在组内按需填充（半赖将、一赖/两赖刻顺、纯赖组在叶节点处理）；
 * 4. 死状态备忘录跨调用共享（BigInt 紧凑签名）：到达过且无解的状态
 *    全局剪枝——无解散牌的最坏情况因此被压到微秒级；
 * 5. 正解按规范 key 去重，同一目标拆分只保留一份。
 *
 * 目标场景：14 张、至多 2 张赖子，单次穷举微秒级，最坏 < 2ms。
 */

import { TILE_KINDS, isSuitTile } from './tiles.ts';
import type { HandState } from './hand.ts';

export type MeldType = 'pair' | 'triplet' | 'sequence' | 'single';
export type DecompKind = 'standard' | 'sevenPairs' | 'thirteenOrphans';

export interface Meld {
  type: MeldType;
  targetTiles: number[];
  naturalTiles: number[];
  wildUsed: number;
}

export interface Decomposition {
  kind: DecompKind;
  melds: Meld[];
  pair: Meld | null;
  pairs?: Meld[];
  singles?: Meld[];
  wildRemaining: number;
  key: string;
}

function meldKey(m: Meld): string {
  return `${m.type[0]}${m.targetTiles.join('.')}`;
}

function standardKey(melds: Meld[], pair: Meld | null, wildRemaining: number): string {
  const m = melds.map(meldKey).sort().join('|');
  const p = pair ? `P${pair.targetTiles.join('.')}` : `W${wildRemaining}`;
  return `${m}#${p}`;
}

function makeMeld(
  type: MeldType,
  targetTiles: number[],
  naturalTiles: number[],
  wildUsed: number,
): Meld {
  return { type, targetTiles: [...targetTiles], naturalTiles: [...naturalTiles], wildUsed };
}

/* ----------- 跨调用死状态备忘录（只记“无解”，两级数字键） ----------- */

const DEAD_LIMIT = 60_000;
/** 外层键：前 17 个牌种计数的 base-8 编码；内层 Set 键：后 17 个 + 赖子/将 */
const deadStates = new Map<number, Set<number>>();
let deadCount = 0;

/**
 * 数字状态键：34 个计数按 base-8 打包成两个安全整数（计数上界 4 < 8，无碰撞）；
 * 赖子数（0..4）与将标记压入第二整数尾部。
 * 全程乘加，不用位运算符——JS 位运算会截断到 32 位，而打包结果需要 51 位。
 */
function stateKeys(counts: number[], w: number, pairUsed: boolean): [number, number] {
  let a = 0;
  for (let id = 0; id < 17; id++) a = a * 8 + (counts[id] ?? 0);
  let b = 0;
  for (let id = 17; id < TILE_KINDS; id++) b = b * 8 + (counts[id] ?? 0);
  return [a, b * 16 + w + (pairUsed ? 8 : 0)];
}

function isDead(a: number, b: number): boolean {
  return deadStates.get(a)?.has(b) === true;
}

function markDead(a: number, b: number): void {
  let inner = deadStates.get(a);
  if (!inner) {
    inner = new Set();
    deadStates.set(a, inner);
  }
  if (!inner.has(b)) {
    inner.add(b);
    deadCount += 1;
    if (deadCount >= DEAD_LIMIT) {
      deadStates.clear();
      deadCount = 0;
    }
  }
}

export interface EnumerateOptions {
  anyOnly?: boolean;
}

/**
 * 保守可行性预检：只在能“证明无解”时返回 false，绝不误杀可解牌。
 * 拦截两类廉价可判的死局，避免进入完整 DFS：
 *  1. 总张数不满足 3n+2；
 *  2. 孤立的单张数牌（同花色无相邻牌、自身仅一张）数量超过赖子数——
 *     每张孤立牌至少需要一张赖子才能成组，赖子不够则无解。
 */
function quickReject(counts: number[], w: number): boolean {
  const total = counts.reduce((a, b) => a + b, 0) + w;
  if (total % 3 !== 2) return true;
  let isolated = 0;
  for (let id = 0; id < 27; id++) {
    if (counts[id] !== 1) continue;
    const base = id - (id % 9);
    const rank = id % 9;
    const prev = rank > 0 ? (counts[base + rank - 1] ?? 0) : 0;
    const next = rank < 8 ? (counts[base + rank + 1] ?? 0) : 0;
    if (prev === 0 && next === 0) isolated += 1;
  }
  return isolated > w;
}

export function enumerateStandard(
  hand: HandState,
  options: EnumerateOptions = {},
): Decomposition[] {
  const counts = [...hand.counts];
  if (quickReject(counts, hand.wildcards)) return [];
  const solutions: Decomposition[] = [];
  const seen = new Set<string>();
  const anyOnly = options.anyOnly === true;
  let stopped = false;

  // 单一可变面子栈：分支入栈、回溯出栈，热路径零数组分配
  const stack: Meld[] = [];
  let pairSlot: Meld | null = null;

  const dfs = (w: number, pairUsed: boolean): boolean => {
    if (stopped) return false;

    let id = -1;
    for (let t = 0; t < TILE_KINDS; t++) {
      if ((counts[t] ?? 0) > 0) { id = t; break; }
    }

    // 叶节点：天然牌耗尽，处理纯赖子组
    if (id === -1) {
      if (pairUsed) {
        if (w === 0) return pushSolution(pairSlot, 0);
        if (w === 3) return pushSolution(pairSlot, 3);
        return false;
      }
      if (w === 2) return pushSolution(null, 2);
      return false;
    }

    const [ka, kb] = stateKeys(counts, w, pairUsed);
    if (isDead(ka, kb)) return false;
    let found = false;
    const c = counts[id] ?? 0;

    // —— 将 ——
    if (!pairUsed) {
      if (c >= 2) {
        counts[id] = c - 2;
        pairSlot = makeMeld('pair', [id, id], [id, id], 0);
        found = dfs(w, true) || found;
        pairSlot = null;
        counts[id] = c;
        if (stopped) return found;
      }
      if (c >= 1 && w >= 1) {
        counts[id] = c - 1;
        pairSlot = makeMeld('pair', [id, id], [id], 1);
        found = dfs(w - 1, true) || found;
        pairSlot = null;
        counts[id] = c;
        if (stopped) return found;
      }
    }

    // —— 刻子 ——
    for (let k = Math.min(c, 3); k >= 1; k--) {
      const wildNeed = 3 - k;
      if (wildNeed > w) continue;
      const natural: number[] = [];
      for (let i = 0; i < k; i++) natural.push(id);
      counts[id] = c - k;
      stack.push(makeMeld('triplet', [id, id, id], natural, wildNeed));
      found = dfs(w - wildNeed, pairUsed) || found;
      stack.pop();
      counts[id] = c;
      if (stopped) return found;
    }

    // —— 顺子 ——
    if (isSuitTile(id)) {
      const suitBase = id - (id % 9);
      const rank = id % 9;
      const minStart = Math.max(0, rank - 2);
      const maxStart = Math.min(6, rank);
      for (let start = minStart; start <= maxStart; start++) {
        const t0 = suitBase + start;
        const t1 = t0 + 1;
        const t2 = t0 + 2;
        const c0 = counts[t0] ?? 0;
        const c1 = counts[t1] ?? 0;
        const c2 = counts[t2] ?? 0;
        const wildNeed = (c0 === 0 ? 1 : 0) + (c1 === 0 ? 1 : 0) + (c2 === 0 ? 1 : 0);
        if (wildNeed > w) continue;
        const natural: number[] = [];
        if (c0 > 0) natural.push(t0);
        if (c1 > 0) natural.push(t1);
        if (c2 > 0) natural.push(t2);
        counts[t0] = c0 - (c0 > 0 ? 1 : 0);
        counts[t1] = c1 - (c1 > 0 ? 1 : 0);
        counts[t2] = c2 - (c2 > 0 ? 1 : 0);
        stack.push(makeMeld('sequence', [t0, t1, t2], natural, wildNeed));
        found = dfs(w - wildNeed, pairUsed) || found;
        stack.pop();
        counts[t0] = c0;
        counts[t1] = c1;
        counts[t2] = c2;
        if (stopped) return found;
      }
    }

    if (!found) markDead(ka, kb);
    return found;
  };

  const pushSolution = (pair: Meld | null, wildRemaining: number): boolean => {
    if (stack.length !== 4) return false;
    const key = standardKey(stack, pair, wildRemaining);
    if (seen.has(key)) return true; // 结构成立（虽重复），不能标死
    seen.add(key);
    solutions.push({
      kind: 'standard',
      melds: stack.map((m) => ({ ...m, targetTiles: [...m.targetTiles], naturalTiles: [...m.naturalTiles] })),
      pair,
      wildRemaining,
      key,
    });
    if (anyOnly) stopped = true;
    return true;
  };

  dfs(hand.wildcards, false);
  return solutions;
}

export function hasStandardWin(hand: HandState): boolean {
  return enumerateStandard(hand, { anyOnly: true }).length > 0;
}

/** 仅供基准测试与诊断：清空跨调用死状态备忘录 */
export function clearDecomposeCache(): void {
  deadStates.clear();
  deadCount = 0;
}
