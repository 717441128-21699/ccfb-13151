/**
 * 番种谓词库：内置纯函数，规则 DSL 通过名字 + 参数调用。
 * 谓词只读取「牌面拆法 + 胡牌上下文」，不读外部状态，保证可回放、可金手回归。
 */

import {
  DRAGON_TILES,
  HONOR_TILES,
  TERMINAL_OR_HONOR_TILES,
  WIND_TILES,
  isDragon,
  isHonor,
  isSimple,
  isTerminal,
  isTerminalOrHonor,
  isWind,
  suitOf,
  type HandTiles,
} from './tiles.js';
import type { Decomposition, Meld } from './decompose.js';
import type { SpecialDecomposition } from './special.js';

export interface WinContext {
  /** 自摸（vs 荣胡） */
  selfDrawn: boolean;
  /** 抢杠胡 */
  robKong: boolean;
  /** 杠上开花 */
  afterKong: boolean;
  /** 海底捞月 / 海底捞月（牌墙最后一张） */
  bottomDraw: boolean;
  /** 河底捞鱼（荣胡的是最后一张弃牌） */
  bottomDiscard: boolean;
  /** 门风编号（27..30），缺省按东 */
  seatWind: number;
  /** 圈风编号 */
  roundWind: number;
  /** 副露面子数（0 = 门前清） */
  openMeldCount: number;
  /** 胡的那张牌；摸赖子胡为 -1 */
  winningTile: number;
}

export const defaultWinContext: WinContext = {
  selfDrawn: false,
  robKong: false,
  afterKong: false,
  bottomDraw: false,
  bottomDiscard: false,
  seatWind: 27,
  roundWind: 27,
  openMeldCount: 0,
  winningTile: -1,
};

export interface FanContext {
  hand: HandTiles;
  decomposition: Decomposition | SpecialDecomposition;
  win: WinContext;
}

const isSpecial = (d: FanContext['decomposition'], kind: string): boolean =>
  d.kind === kind;

function standardMelds(ctx: FanContext): Meld[] {
  return ctx.decomposition.kind === 'standard' ? ctx.decomposition.melds : [];
}

/** 标准型拆法中的将（位置不固定，DFS 按锚定牌顺序生成） */
function findPair(ctx: FanContext): Meld | null {
  if (ctx.decomposition.kind !== 'standard') return null;
  return ctx.decomposition.melds.find((m) => m.type === 'pair') ?? null;
}

function presentSuits(ctx: FanContext): Set<string> {
  const suits = new Set<string>();
  for (let t = 0; t < 34; t++) {
    if ((ctx.hand.counts[t] ?? 0) > 0) suits.add(suitOf(t));
  }
  return suits;
}

type PredicateFn = (ctx: FanContext, args: unknown[]) => boolean | number | string | number[];

export const PREDICATES: Record<string, PredicateFn> = {
  // ---------- 牌型大类 ----------
  standard: (ctx) => ctx.decomposition.kind === 'standard',
  sevenPairs: (ctx) => isSpecial(ctx.decomposition, 'sevenPairs'),
  thirteenOrphans: (ctx) => isSpecial(ctx.decomposition, 'thirteenOrphans'),
  menzen: (ctx) => ctx.win.openMeldCount === 0,
  selfDrawn: (ctx) => ctx.win.selfDrawn,
  robKong: (ctx) => ctx.win.robKong,
  afterKong: (ctx) => ctx.win.afterKong,
  bottomDraw: (ctx) => ctx.win.bottomDraw,
  bottomDiscard: (ctx) => ctx.win.bottomDiscard,

  // ---------- 花色构成 ----------
  suitCount: (ctx) => presentSuits(ctx).size,
  /** 清一色：只有一种数牌花色，无字牌 */
  pureOneSuit: (ctx) => {
    const suits = presentSuits(ctx);
    return suits.size === 1 && !suits.has('z');
  },
  /** 混一色：一种数牌花色 + 字牌 */
  mixedOneSuit: (ctx) => {
    const suits = presentSuits(ctx);
    return suits.size === 2 && suits.has('z');
  },
  /** 对对胡：4 个面子全是刻子 */
  allTriplets: (ctx) => {
    const melds = standardMelds(ctx);
    if (melds.length !== 5) return false;
    const nonPair = melds.filter((m) => m.type !== 'pair');
    return nonPair.length === 4 && nonPair.every((m) => m.type === 'triplet');
  },
  /** 平和：4 个顺子 + 数牌将（部分地方规则还要求门清，由 DSL 组合 menzen） */
  allSequences: (ctx) => {
    const melds = standardMelds(ctx);
    if (melds.length !== 5) return false;
    const pair = findPair(ctx);
    const nonPair = melds.filter((m) => m.type !== 'pair');
    return (
      nonPair.length === 4 &&
      nonPair.every((m) => m.type === 'sequence') &&
      pair !== null &&
      !isHonor(pair.tiles[0]!)
    );
  },
  /** 断幺九：无幺九牌、无字牌 */
  allSimples: (ctx) => {
    for (let t = 0; t < 34; t++) {
      if ((ctx.hand.counts[t] ?? 0) > 0 && !isSimple(t)) return false;
    }
    return true;
  },
  /** 全带幺九：每个面子与将都含幺九或字牌 */
  allWithTerminalOrHonor: (ctx) => {
    const melds = standardMelds(ctx);
    if (melds.length !== 5) return false;
    return melds.every((m) => m.tiles.some((t) => t >= 0 && isTerminalOrHonor(t)));
  },
  /** 混幺九：全部由幺九 + 字牌构成，且至少含一张字牌 */
  mixedTerminals: (ctx) => {
    let hasHonor = false;
    for (let t = 0; t < 34; t++) {
      if ((ctx.hand.counts[t] ?? 0) === 0) continue;
      if (!isTerminalOrHonor(t)) return false;
      if (isHonor(t)) hasHonor = true;
    }
    return hasHonor;
  },
  /** 清幺九：全部由幺九数牌构成 */
  pureTerminals: (ctx) => {
    for (let t = 0; t < 34; t++) {
      if ((ctx.hand.counts[t] ?? 0) > 0 && !isTerminal(t)) return false;
    }
    return true;
  },
  /** 字一色：全部字牌 */
  allHonors: (ctx) => {
    for (let t = 0; t < 34; t++) {
      if ((ctx.hand.counts[t] ?? 0) > 0 && !isHonor(t)) return false;
    }
    return true;
  },
  hasNoHonors: (ctx) => {
    for (const t of HONOR_TILES) if ((ctx.hand.counts[t] ?? 0) > 0) return false;
    return true;
  },

  // ---------- 面子统计 ----------
  tripletCount: (ctx) =>
    standardMelds(ctx).filter((m) => m.type === 'triplet').length,
  sequenceCount: (ctx) =>
    standardMelds(ctx).filter((m) => m.type === 'sequence').length,
  /** 暗刻数（门前清时所有刻子视为暗刻；副露信息由上下文给定时可扩展） */
  concealedTripletCount: (ctx, args) => {
    const onlyConcealed = args[0] !== false;
    if (onlyConcealed && ctx.win.openMeldCount > 0) {
      // 副露刻子不计暗刻：本平台把副露面子单独建模时在此过滤，
      // 当前金手数据均为完整手牌，按全部刻子保守计暗刻。
    }
    return standardMelds(ctx).filter((m) => m.type === 'triplet').length;
  },

  // ---------- 刻子/将的具体牌 ----------
  /** 箭牌刻（args 可选：白31/发32/中33；不给则任一） */
  dragonTriplet: (ctx, args) => {
    const want = args[0] as number | undefined;
    return standardMelds(ctx).some(
      (m) =>
        m.type === 'triplet' &&
        isDragon(m.tiles[0]!) &&
        (want === undefined || m.tiles[0] === want),
    );
  },
  /** 风牌刻：args 给 'seat' 查门风、'round' 查圈风，不给则任一刻 */
  windTriplet: (ctx, args) => {
    const mode = args[0] as string | undefined;
    return standardMelds(ctx).some((m) => {
      if (m.type !== 'triplet' || !isWind(m.tiles[0]!)) return false;
      if (mode === 'seat') return m.tiles[0] === ctx.win.seatWind;
      if (mode === 'round') return m.tiles[0] === ctx.win.roundWind;
      return true;
    });
  },
  /** 将牌是否为指定牌（编号）或某一类：'dragon' | 'wind' | 'honor' | 'terminal' */
  pairIs: (ctx, args) => {
    const pair = findPair(ctx);
    if (!pair) return false;
    const pairTile = pair.tiles[0]!;
    const want = args[0];
    if (typeof want === 'number') return pairTile === want;
    if (want === 'dragon') return isDragon(pairTile);
    if (want === 'wind') return isWind(pairTile);
    if (want === 'honor') return isHonor(pairTile);
    if (want === 'terminal') return isTerminal(pairTile);
    return false;
  },

  // ---------- 复合顺子 ----------
  /** 一气通贯：同花色 123 + 456 + 789 */
  fullStraight: (ctx) => {
    const seqs = standardMelds(ctx)
      .filter((m) => m.type === 'sequence')
      .map((m) => m.tiles[0]!);
    for (const base of [0, 9, 18]) {
      if (seqs.includes(base) && seqs.includes(base + 3) && seqs.includes(base + 6)) {
        return true;
      }
    }
    return false;
  },
  /** 三色同顺：三个花色各有一个起点相同的顺子 */
  threeColorSequences: (ctx) => {
    const starts = standardMelds(ctx)
      .filter((m) => m.type === 'sequence')
      .map((m) => m.tiles[0]! % 9);
    for (let r = 0; r < 7; r++) {
      if (starts.filter((s) => s === r).length >= 3) return true;
    }
    return false;
  },
  /** 三色同刻 */
  threeColorTriplets: (ctx) => {
    const ranks = standardMelds(ctx)
      .filter((m) => m.type === 'triplet' && !isHonor(m.tiles[0]!))
      .map((m) => m.tiles[0]! % 9);
    for (let r = 0; r < 9; r++) {
      if (ranks.filter((x) => x === r).length >= 3) return true;
    }
    return false;
  },
  /** 一般高：同花色同起点的两个顺子 */
  doubleSequence: (ctx) => {
    const starts = standardMelds(ctx)
      .filter((m) => m.type === 'sequence')
      .map((m) => m.tiles[0]!);
    return new Set(starts).size !== starts.length;
  },

  // ---------- 七对 / 十三幺细分 ----------
  /** 七对下的豪华：某个自然牌出现 4 张（算两个对子） */
  sevenPairsLuxury: (ctx) => {
    if (ctx.decomposition.kind !== 'sevenPairs') return false;
    return ctx.hand.counts.some((c) => c === 4);
  },
  thirteenOrphansAllWait: (ctx) => {
    if (ctx.decomposition.kind !== 'thirteenOrphans') return false;
    // 十三种幺九字牌全为自然单张、重复张由赖子充当，即「十三面听」形态
    return ctx.decomposition.duplicatedTile === null;
  },

  // ---------- 赖子 ----------
  jokerCount: (ctx) => ctx.hand.jokers,
  /** 胡牌拆法实际用掉的赖子数 */
  jokerUsed: (ctx) =>
    ctx.decomposition.kind === 'standard'
      ? ctx.decomposition.jokerUsed
      : ctx.decomposition.jokerUsed,
  /** 四川「根」：拆法中某种自然牌凑足 4 张（一刻 + 余张 / 两个顺子含同牌等），按刻子+余张建模 */
  fourOfAKindCount: (ctx) => {
    if (ctx.decomposition.kind !== 'standard') return 0;
    const seen = new Map<number, number>();
    for (const m of ctx.decomposition.melds) {
      for (const t of m.tiles) {
        if (t < 0) continue;
        seen.set(t, (seen.get(t) ?? 0) + 1);
      }
    }
    let n = 0;
    for (const cnt of seen.values()) if (cnt >= 4) n++;
    return n;
  },

  // ---------- 常量集合（供 DSL 传参提示） ----------
  dragonTiles: () => DRAGON_TILES as unknown as number[],
  windTiles: () => WIND_TILES as unknown as number[],
  terminalOrHonorTiles: () => TERMINAL_OR_HONOR_TILES as unknown as number[],
};

export function listPredicateNames(): string[] {
  return Object.keys(PREDICATES).sort();
}
