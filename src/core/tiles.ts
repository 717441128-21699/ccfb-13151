/**
 * 牌张定义与记号法（notation）。
 *
 * 牌 ID 布局（共 34 种实体牌 + 34 种赖子虚拟位）：
 *   0..8   万子 m1..m9
 *   9..17  条子 s1..s9
 *   18..26 筒子 p1..p9
 *   27     东  E
 *   28     南  S
 *   29     西  W
 *   30     北  N
 *   31     中  Z（中）
 *   32     发  F（發）
 *   33     白  B（白板）
 *
 * 记号法：
 *   万/条/筒：数字 + 花色后缀，如 1m 2m 3m；同花色可连写 123m
 *   字牌：   E S W N Z F B
 *   赖子：   任意记号后加 *，如 5m* 表示“这张是赖子，天然形态为五万”
 *   解析时以空白或花色分组，记号与张数一一对应（一张写一个记号）。
 */

export const TILE_KINDS = 34 as const;
export const SUIT_TILES = 27 as const;
export const HONOR_TILES = 7 as const;

export type Suit = 'm' | 's' | 'p';
export type Honor = 'E' | 'S' | 'W' | 'N' | 'Z' | 'F' | 'B';

export const SUITS: readonly Suit[] = ['m', 's', 'p'];
export const HONORS: readonly Honor[] = ['E', 'S', 'W', 'N', 'Z', 'F', 'B'];

const SUIT_INDEX: Record<Suit, number> = { m: 0, s: 9, p: 18 };
const HONOR_INDEX: Record<Honor, number> = {
  E: 27, S: 28, W: 29, N: 30, Z: 31, F: 32, B: 33,
};
const HONOR_REVERSE: Record<number, Honor> = Object.fromEntries(
  HONORS.map((h) => [HONOR_INDEX[h], h]),
);

/** 字牌 ID */
export function honorId(honor: Honor): number {
  return HONOR_INDEX[honor];
}

/** 数牌 ID（rank 从 1 起） */
export function suitId(suit: Suit, rank: number): number {
  if (rank < 1 || rank > 9) throw new Error(`非法点数: ${rank}`);
  return SUIT_INDEX[suit] + rank - 1;
}

export function isSuitTile(id: number): boolean {
  return id >= 0 && id < SUIT_TILES;
}

export function isHonorTile(id: number): boolean {
  return id >= SUIT_TILES && id < TILE_KINDS;
}

export function isTerminal(id: number): boolean {
  if (!isSuitTile(id)) return false;
  const rank = ((id % 9) + 9) % 9 + 1;
  return rank === 1 || rank === 9;
}

export function isTerminalOrHonor(id: number): boolean {
  return isHonorTile(id) || isTerminal(id);
}

export function isSimple(id: number): boolean {
  return isSuitTile(id) && !isTerminal(id);
}

/** 1..9；字牌返回 0 */
export function rankOf(id: number): number {
  if (!isSuitTile(id)) return 0;
  return (id % 9) + 1;
}

export function suitOf(id: number): Suit | null {
  if (id < 9) return 'm';
  if (id < 18) return 's';
  if (id < 27) return 'p';
  return null;
}

/** 单张记号，如 5m / E / 带赖子标记 */
export function tileNotation(id: number, wildcard = false): string {
  const base = isHonorTile(id)
    ? (HONOR_REVERSE[id] ?? '')
    : `${rankOf(id)}${suitOf(id) ?? ''}`;
  return wildcard ? `${base}*` : base;
}

/** 记号 -> 牌 ID（不含赖子标记） */
export function parseSingleTile(token: string): number {
  const clean = token.endsWith('*') ? token.slice(0, -1) : token;
  if (clean.length === 1 && clean in HONOR_INDEX) {
    return HONOR_INDEX[clean as Honor];
  }
  const suit = clean.charAt(clean.length - 1) as Suit;
  if (!(suit in SUIT_INDEX)) throw new Error(`非法记号: ${token}`);
  const rank = Number(clean.slice(0, -1));
  if (!Number.isInteger(rank)) throw new Error(`非法记号: ${token}`);
  return suitId(suit, rank);
}

const TILE_TOKEN_RE = /(\d+[msp]|[ESWNZFB]+)(\*)?/g;

/**
 * 把整串记号切成单个牌记号。
 * 支持三种写法：
 *   "1m 2m 3m E E"      空白分隔
 *   "123m 44s EE"       同花色连写（数字逐位拆开，字牌逐字拆开）
 *   "5m*5m*"            紧凑赖子组连写
 */
function tokenize(input: string): string[] {
  const out: string[] = [];
  for (const rawGroup of input.trim().split(/\s+/)) {
    if (!rawGroup) continue;
    TILE_TOKEN_RE.lastIndex = 0;
    let consumed = 0;
    let match: RegExpExecArray | null;
    while ((match = TILE_TOKEN_RE.exec(rawGroup)) !== null) {
      const whole = match[0]!;
      const body = match[1]!;
      const star = match[2];
      consumed += whole.length;
      const suffix = star ? '*' : '';
      if (/^[ESWNZFB]+$/.test(body)) {
        for (const ch of body) out.push(ch + suffix);
      } else {
        const suit = body.charAt(body.length - 1);
        for (const ch of body.slice(0, -1)) out.push(`${ch}${suit}${suffix}`);
      }
    }
    if (consumed !== rawGroup.length) throw new Error(`非法记号组: ${rawGroup}`);
  }
  return out;
}

export interface ParsedHand {
  /** 各牌种天然张数（赖子按其天然形态计入） */
  counts: ReadonlyArray<number>;
  /** 赖子数量 */
  wildcards: number;
  /** 总张数 */
  total: number;
}

/** 解析一手牌的记号，如 "123m 456p 789s EE 5m*5m*" */
export function parseHand(input: string): ParsedHand {
  const counts = new Array<number>(TILE_KINDS).fill(0);
  let wildcards = 0;
  for (const token of tokenize(input)) {
    const isWild = token.endsWith('*');
    const id = parseSingleTile(token);
    // 赖子与天然牌分开计数；天然形态仅用于记号展示与配牌追踪
    if (!isWild) counts[id] = (counts[id] ?? 0) + 1;
    wildcards += isWild ? 1 : 0;
  }
  return { counts, wildcards, total: counts.reduce((a, b) => a + b, 0) + wildcards };
}

/** 反向输出：counts（仅天然牌）+ 赖子张数 -> 紧凑记号（赖子统一用 wildcardNaturalId 形态标记） */
export function handToNotation(
  counts: ReadonlyArray<number>,
  wildcards: number,
  wildcardNaturalId = 0,
): string {
  const parts: string[] = [];
  for (const suit of SUITS) {
    let digits = '';
    for (let r = 1; r <= 9; r++) {
      const n = counts[SUIT_INDEX[suit] + r - 1] ?? 0;
      digits += String(r).repeat(n);
    }
    if (digits) parts.push(digits + suit);
  }
  for (const h of HONORS) {
    const n = counts[HONOR_INDEX[h]] ?? 0;
    if (n) parts.push(h.repeat(n));
  }
  if (wildcards > 0) {
    parts.push(tileNotation(wildcardNaturalId, true).repeat(wildcards));
  }
  return parts.join(' ');
}
