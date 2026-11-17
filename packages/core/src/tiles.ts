/**
 * 牌的基础模型。
 *
 * 编号约定（与天凤/雀魂通用编码一致，方便以后导入外部牌谱）：
 *   0..8   万子 1m..9m
 *   9..17  条子 1s..9s
 *   18..26 筒子 1p..9p
 *   27..33 东南西北白发中（字牌）
 *
 * 赖子（百搭 / 鬼牌）不占用自然牌编号：手牌用 HandTiles 表达，
 * 自然牌计数 + 赖子张数分开存储，引擎内部全程按张数数组运算，不做对象分配。
 */

export const SUIT_RANKS: ReadonlyArray<string> = ['m', 's', 'p'];
export const WIND_TILES = [27, 28, 29, 30] as const; // 东南西北
export const DRAGON_TILES = [31, 32, 33] as const; // 白发中
export const HONOR_TILES = [...WIND_TILES, ...DRAGON_TILES] as const;
export const ALL_NATURAL_TILES = Array.from({ length: 34 }, (_, i) => i);
export const TERMINAL_TILES = [0, 8, 9, 17, 18, 26] as const; // 19m 19s 19p
export const TERMINAL_OR_HONOR_TILES: ReadonlyArray<number> = [
  ...TERMINAL_TILES,
  ...HONOR_TILES,
];
export const SIMPLE_TILES = ALL_NATURAL_TILES.filter(
  (t) => !TERMINAL_OR_HONOR_TILES.includes(t),
);

export function suitOf(tile: number): 'm' | 's' | 'p' | 'z' {
  if (tile < 9) return 'm';
  if (tile < 18) return 's';
  if (tile < 27) return 'p';
  return 'z';
}

export function rankOf(tile: number): number {
  const s = suitOf(tile);
  if (s === 'm') return tile + 1;
  if (s === 's') return tile - 8;
  if (s === 'p') return tile - 17;
  return tile - 26; // 字牌 1..7
}

export function isHonor(tile: number): boolean {
  return tile >= 27;
}
export function isTerminal(tile: number): boolean {
  return (TERMINAL_TILES as ReadonlyArray<number>).includes(tile);
}
export function isTerminalOrHonor(tile: number): boolean {
  return isHonor(tile) || isTerminal(tile);
}
export function isSimple(tile: number): boolean {
  return !isTerminalOrHonor(tile);
}
export function isDragon(tile: number): boolean {
  return tile >= 31;
}
export function isWind(tile: number): boolean {
  return tile >= 27 && tile <= 30;
}

const TILE_LABELS = [
  '1万','2万','3万','4万','5万','6万','7万','8万','9万',
  '1条','2条','3条','4条','5条','6条','7条','8条','9条',
  '1筒','2筒','3筒','4筒','5筒','6筒','7筒','8筒','9筒',
  '东','南','西','北','白','发','中',
];

export function tileLabel(tile: number): string {
  return TILE_LABELS[tile] ?? `?${tile}`;
}

/** "1m2m3m" / "123m" 简写 / "z1z2" 等写法都支持，赖子用 "X" 或 "*" 表示 */
export function parseTileToken(token: string): number {
  const t = token.trim().toLowerCase();
  if (t === 'x' || t === '*') return -1;
  if (/^\d[msp]$/.test(t)) {
    const rank = Number(t[0]);
    const base = t[1] === 'm' ? 0 : t[1] === 's' ? 9 : 18;
    return base + rank - 1;
  }
  if (/^z\d$/.test(t)) return 27 + Number(t[1]) - 1;
  if (/^\d{1,9}[msp]$/.test(t)) {
    throw new Error(`请逐张书写或使用简写解析器：${token}`);
  }
  throw new Error(`无法识别的牌: ${token}`);
}

/**
 * 解析手牌字符串，例如 "123m456p789s11z XX"（末尾 XX 为两张赖子）。
 * 也接受逐张写法 "1m 2m 3m X"。返回自然牌计数数组与赖子张数。
 */
export function parseHand(input: string): HandTiles {
  const compact = input.replace(/\s+/g, '');
  const counts = new Array<number>(34).fill(0);
  let jokers = 0;
  let i = 0;
  while (i < compact.length) {
    const ch = compact[i]!;
    if (ch === 'x' || ch === '*' || ch === 'X') {
      jokers++;
      i++;
      continue;
    }
    // 简写：一组数字 + 花色
    if (/[0-9]/.test(ch)) {
      let j = i;
      const digits: number[] = [];
      while (j < compact.length && /[0-9]/.test(compact[j]!)) {
        digits.push(Number(compact[j]));
        j++;
      }
      const suit = compact[j];
      if (!suit || !'mspz'.includes(suit)) {
        throw new Error(`手牌字符串在第 ${i + 1} 字缺少花色: ${input}`);
      }
      for (const d of digits) {
        if (suit === 'z') {
          if (d < 1 || d > 7) throw new Error(`字牌编号越界: z${d}`);
          counts[27 + d - 1]!++;
        } else {
          const base = suit === 'm' ? 0 : suit === 's' ? 9 : 18;
          counts[base + d - 1]!++;
        }
      }
      i = j + 1;
      continue;
    }
    throw new Error(`手牌字符串含非法字符: ${ch}`);
  }
  return { counts, jokers };
}

export function handToLabel(hand: HandTiles): string {
  const parts: string[] = [];
  for (let t = 0; t < 34; t++) {
    for (let k = 0; k < hand.counts[t]!; k++) parts.push(tileLabel(t));
  }
  for (let k = 0; k < hand.jokers; k++) parts.push('赖');
  return parts.join(' ');
}

/** 自然牌计数（长度 34，每种最多 4 张）+ 赖子张数 */
export interface HandTiles {
  counts: number[];
  jokers: number;
}

export function totalTiles(hand: HandTiles): number {
  let n = hand.jokers;
  for (const c of hand.counts) n += c;
  return n;
}

export function cloneHand(hand: HandTiles): HandTiles {
  return { counts: hand.counts.slice(), jokers: hand.jokers };
}

export function handFromTiles(tiles: Array<number | 'joker'>): HandTiles {
  const counts = new Array<number>(34).fill(0);
  let jokers = 0;
  for (const t of tiles) {
    if (t === 'joker') jokers++;
    else counts[t]!++;
  }
  return { counts, jokers };
}

/** 校验一张牌的物理张数是否超过 4（含被赖子代替的情形由调用方另行判断） */
export function validateCounts(counts: ReadonlyArray<number>): string | null {
  for (let t = 0; t < 34; t++) {
    if ((counts[t] ?? 0) > 4) return `${tileLabel(t)} 超过 4 张`;
    if ((counts[t] ?? 0) < 0) return `${tileLabel(t)} 张数为负`;
  }
  return null;
}
