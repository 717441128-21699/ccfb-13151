/**
 * 番型判定谓词库。
 *
 * 规则包（JSON）通过 name + params 引用这里的谓词，策划新增常见番种无需改代码；
 * 各地极特殊番种才需要在本库登记新谓词（并补测试），避免规则包退化成代码。
 *
 * 约定：
 *  - 谓词只读取 FanContext（含具体拆分，赖子已展开为确定目标）
 *  - targetTiles 表达“名义牌”，naturalTiles 表达天然构成；门清/天然类番种看后者
 */

import { isHonorTile, isSuitTile, isTerminalOrHonor, isSimple, rankOf, suitOf } from './tiles.ts';
import type { Decomposition, Meld } from './decompose.ts';

export type WinMethod = 'selfDraw' | 'discard' | 'robbingKong' | 'supplementKong' | 'lastTile';

export interface GameContext {
  /** 自摸 / 点炮 / 抢杠胡 / 杠后摸 / 海底捞月 */
  winMethod: WinMethod;
  /** 明杠次数 */
  exposedKongs: number;
  /** 暗杠次数 */
  concealedKongs: number;
  /** 明刻/明顺数量（吃碰露出的面子） */
  exposedMelds: number;
  /** 是否海底牌（牌墙最后一张） */
  isLastTile: boolean;
  /** 定缺花色（四川玩法），'m' | 's' | 'p' | null */
  absentSuit: 'm' | 's' | 'p' | null;
  /** 圈风/门风位（字牌 ID），可空 */
  seatWind?: number;
  roundWind?: number;
}

export interface FanContext {
  /** 天然牌计数（长度 34，含赖子天然形态） */
  counts: ReadonlyArray<number>;
  wildcards: number;
  decomposition: Decomposition;
  game: GameContext;
}

export type PredicateParams = Record<string, string | number | boolean>;
export type FanPredicate = (ctx: FanContext, params: PredicateParams) => boolean;

function allMelds(d: Decomposition): Meld[] {
  if (d.kind === 'sevenPairs') return d.pairs ?? [];
  if (d.kind === 'thirteenOrphans') return [...(d.singles ?? []), ...(d.pair ? [d.pair] : [])];
  return [...d.melds, ...(d.pair ? [d.pair] : [])];
}

/** 出现过的数牌花色集合 */
function suitsUsed(d: Decomposition): Set<string> {
  const s = new Set<string>();
  for (const m of allMelds(d)) {
    for (const t of m.targetTiles) {
      const suit = suitOf(t);
      if (suit) s.add(suit);
    }
  }
  return s;
}

function honorsUsed(d: Decomposition): Set<number> {
  const s = new Set<number>();
  for (const m of allMelds(d)) {
    for (const t of m.targetTiles) if (isHonorTile(t)) s.add(t);
  }
  return s;
}

/** 不含任何字牌 */
const noHonors: FanPredicate = (ctx) => honorsUsed(ctx.decomposition).size === 0;

/** 全由字牌构成（七对/刻子类结构才可能成立） */
const allHonors: FanPredicate = (ctx) => {
  const d = ctx.decomposition;
  for (const m of allMelds(d)) {
    for (const t of m.targetTiles) if (!isHonorTile(t)) return false;
  }
  return true;
};

/** 清一色：只含一种数牌花色、无字牌 */
const allOneSuit: FanPredicate = (ctx) => {
  const d = ctx.decomposition;
  if (honorsUsed(d).size > 0) return false;
  return suitsUsed(d).size === 1;
};

/** 混一色：一种数牌花色 + 字牌 */
const mixedOneSuit: FanPredicate = (ctx) => {
  const d = ctx.decomposition;
  if (honorsUsed(d).size === 0) return false;
  return suitsUsed(d).size <= 1;
};

/** 缺一门：天然牌中完全不出现指定花色（参数 suit） */
const missingSuit: FanPredicate = (ctx, params) => {
  const suit = String(params.suit ?? '');
  for (let id = 0; id < 34; id++) {
    if ((ctx.counts[id] ?? 0) === 0) continue;
    if (suitOf(id) === suit) return false;
  }
  return true;
};

/** 平胡：四组顺子 + 数牌将，且无刻无字 */
const allSequences: FanPredicate = (ctx) => {
  const d = ctx.decomposition;
  if (d.kind !== 'standard') return false;
  if (d.melds.length !== 4 || d.melds.some((m) => m.type !== 'sequence')) return false;
  const pairId = d.pair?.targetTiles[0];
  return pairId !== undefined && isSuitTile(pairId);
};

/** 碰碰胡：四组刻子（含杠的语义由上层杠处理，这里看结构） */
const allTriplets: FanPredicate = (ctx) => {
  const d = ctx.decomposition;
  if (d.kind !== 'standard') return false;
  return d.melds.every((m) => m.type === 'triplet');
};

const hasSequence: FanPredicate = (ctx) =>
  ctx.decomposition.kind === 'standard' && ctx.decomposition.melds.some((m) => m.type === 'sequence');

const noSequences: FanPredicate = (ctx) =>
  ctx.decomposition.kind !== 'standard' ||
  ctx.decomposition.melds.every((m) => m.type !== 'sequence');

const sevenPairs: FanPredicate = (ctx) => ctx.decomposition.kind === 'sevenPairs';

const thirteenOrphans: FanPredicate = (ctx) => ctx.decomposition.kind === 'thirteenOrphans';

/** 豪华七对：七对结构中含四张同种（两个同目标对子） */
const deluxeSevenPairs: FanPredicate = (ctx) => {
  const d = ctx.decomposition;
  if (d.kind !== 'sevenPairs' || !d.pairs) return false;
  const seen = new Map<number, number>();
  for (const p of d.pairs) seen.set(p.targetTiles[0]!, (seen.get(p.targetTiles[0]!) ?? 0) + 1);
  return [...seen.values()].some((n) => n >= 2);
};

/** 全带幺：每组面子与将都至少含一张幺九或字牌（仅标准结构适用） */
const allWithTerminals: FanPredicate = (ctx) => {
  const d = ctx.decomposition;
  if (d.kind !== 'standard') return false;
  for (const m of allMelds(d)) {
    if (!m.targetTiles.some((t) => isTerminalOrHonor(t))) return false;
  }
  return true;
};

/** 幺九刻：存在幺九或字牌刻子（参数 min 控制个数，默认 1） */
const terminalTriplet: FanPredicate = (ctx, params) => {
  const min = Number(params.min ?? 1);
  if (ctx.decomposition.kind !== 'standard') return false;
  const n = ctx.decomposition.melds.filter(
    (m) => m.type === 'triplet' && m.targetTiles.some((t) => isTerminalOrHonor(t)),
  ).length;
  return n >= min;
};

/** 风牌刻：参数 wind 可指定 seat/round；默认任意风刻 */
const windTriplet: FanPredicate = (ctx, params) => {
  if (ctx.decomposition.kind !== 'standard') return false;
  const which = String(params.which ?? 'any');
  const wanted = new Set<number>();
  if (which === 'seat' && ctx.game.seatWind !== undefined) wanted.add(ctx.game.seatWind);
  else if (which === 'round' && ctx.game.roundWind !== undefined) wanted.add(ctx.game.roundWind);
  else for (let id = 27; id <= 30; id++) wanted.add(id);
  return ctx.decomposition.melds.some(
    (m) => m.type === 'triplet' && wanted.has(m.targetTiles[0]!),
  );
};

/** 箭牌刻（中发白任一） */
const dragonTriplet: FanPredicate = (ctx) => {
  if (ctx.decomposition.kind !== 'standard') return false;
  return ctx.decomposition.melds.some(
    (m) => m.type === 'triplet' && m.targetTiles.some((t) => t >= 31 && t <= 33),
  );
};

/** 断幺九：全部由 2..8 数牌构成，无字无幺九 */
const allSimples: FanPredicate = (ctx) => {
  for (const m of allMelds(ctx.decomposition)) {
    for (const t of m.targetTiles) if (!isSimple(t)) return false;
  }
  return true;
};

/** 门前清：没有任何吃碰明杠（暗杠不破门清） */
const concealed: FanPredicate = (ctx) => ctx.game.exposedMelds === 0 && ctx.game.exposedKongs === 0;

/** 全无赖子（天然胡） */
const noWildcard: FanPredicate = (ctx) => ctx.wildcards === 0;

/** 用到至少 n 张赖子（参数 min，默认 1） */
const usesWildcard: FanPredicate = (ctx, params) => {
  const min = Number(params.min ?? 1);
  return ctx.wildcards >= min;
};

const selfDraw: FanPredicate = (ctx) =>
  ctx.game.winMethod === 'selfDraw' || ctx.game.winMethod === 'supplementKong';

const robKong: FanPredicate = (ctx) => ctx.game.winMethod === 'robbingKong';

const lastTile: FanPredicate = (ctx) =>
  ctx.game.isLastTile || ctx.game.winMethod === 'lastTile';

const kongBonus: FanPredicate = (ctx) =>
  ctx.game.exposedKongs + ctx.game.concealedKongs > 0;

const concealedKong: FanPredicate = (ctx) => ctx.game.concealedKongs > 0;

/** 杠上开花：杠后补牌自摸 */
const supplementAfterKong: FanPredicate = (ctx) => ctx.game.winMethod === 'supplementKong';

/** 三色同刻：万条筒各一组同点数刻子（参数 rank 可选，缺省任意点数） */
const tripleTriplets: FanPredicate = (ctx, params) => {
  if (ctx.decomposition.kind !== 'standard') return false;
  const rankWanted = params.rank === undefined ? null : Number(params.rank);
  const bySuit = new Map<string, Set<number>>();
  for (const m of ctx.decomposition.melds) {
    if (m.type !== 'triplet') continue;
    const t = m.targetTiles[0]!;
    const suit = suitOf(t);
    if (!suit) continue;
    if (!bySuit.has(suit)) bySuit.set(suit, new Set());
    bySuit.get(suit)!.add(rankOf(t));
  }
  if (bySuit.size < 3) return false;
  const [a, b, c] = [...bySuit.values()];
  for (const r of a!) {
    if (rankWanted !== null && r !== rankWanted) continue;
    if (b!.has(r) && c!.has(r)) return true;
  }
  return false;
};

/** 三色同顺：万条筒各一组同点数顺子 */
const tripleSequences: FanPredicate = (ctx) => {
  if (ctx.decomposition.kind !== 'standard') return false;
  const bySuit = new Map<string, Set<number>>();
  for (const m of ctx.decomposition.melds) {
    if (m.type !== 'sequence') continue;
    const t = m.targetTiles[0]!;
    const suit = suitOf(t);
    if (!suit) continue;
    if (!bySuit.has(suit)) bySuit.set(suit, new Set());
    bySuit.get(suit)!.add(rankOf(t));
  }
  if (bySuit.size < 3) return false;
  const [a, b, c] = [...bySuit.values()];
  for (const r of a!) {
    if (b!.has(r) && c!.has(r)) return true;
  }
  return false;
};

export const PREDICATES: Record<string, FanPredicate> = {
  allOneSuit,
  mixedOneSuit,
  noHonors,
  allHonors,
  missingSuit,
  allSequences,
  allTriplets,
  hasSequence,
  noSequences,
  sevenPairs,
  deluxeSevenPairs,
  thirteenOrphans,
  allWithTerminals,
  terminalTriplet,
  windTriplet,
  dragonTriplet,
  allSimples,
  concealed,
  noWildcard,
  usesWildcard,
  selfDraw,
  robKong,
  lastTile,
  kongBonus,
  concealedKong,
  supplementAfterKong,
  tripleTriplets,
  tripleSequences,
};

export function getPredicate(name: string): FanPredicate {
  const fn = PREDICATES[name];
  if (!fn) throw new Error(`未注册的番型谓词: ${name}`);
  return fn;
}

/** 供测试与文档使用 */
export const predicateHelpers = { allMelds, suitsUsed, honorsUsed };
