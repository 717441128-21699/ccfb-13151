import { TILE_COUNT, YAO13, type Tile } from './tiles.ts';

export interface QiduiPair {
  tile: Tile;
  /** 该对子中赖子充当的张数:0=真对子,1=一真一赖,2=双赖成对 */
  laizi: number;
}

export interface QiduiDecomp {
  pairs: QiduiPair[];
  laiziAsSelf: number;
}

export interface ShisanyaoDecomp {
  pairTile: Tile;
  laiziAsSelf: number;
}

function selfAssignVecs(types: Tile[], total: number): Uint8Array[] {
  if (types.length === 0) return total === 0 ? [new Uint8Array(TILE_COUNT)] : [];
  const out: Uint8Array[] = [];
  const cur = new Uint8Array(TILE_COUNT);
  const rec = (idx: number, left: number): void => {
    if (idx === types.length - 1) {
      cur[types[idx]] = left;
      out.push(cur.slice());
      cur[types[idx]] = 0;
      return;
    }
    for (let k = 0; k <= left; k++) {
      cur[types[idx]] = k;
      rec(idx + 1, left - k);
    }
    cur[types[idx]] = 0;
  };
  for (let s = 0; s <= total; s++) rec(0, s);
  return out;
}

/**
 * 七对穷举:14 张 = 7 对。奇数张的牌各需 1 赖子配成对,剩余赖子两两自结成对
 * (自结对可以是任意牌型,影响清一色/字一色等判定,全部枚举)。
 */
export function enumerateQidui(
  counts: Uint8Array,
  laizi: number,
  laiziTypes: Tile[] = [],
  allowAsSelf = true,
): QiduiDecomp[] {
  const assigns =
    laiziTypes.length === 0 || !allowAsSelf
      ? [new Uint8Array(TILE_COUNT)]
      : selfAssignVecs(laiziTypes, laizi);
  const out: QiduiDecomp[] = [];
  const seen = new Set<string>();

  for (const self of assigns) {
    let selfSum = 0;
    for (const v of self) selfSum += v;
    if (selfSum > laizi) continue;
    const L = laizi - selfSum;
    const c = new Uint8Array(TILE_COUNT);
    for (let i = 0; i < TILE_COUNT; i++) c[i] = counts[i] + self[i];

    const base: QiduiPair[] = [];
    let oddNeed = 0;
    for (let t = 0; t < TILE_COUNT; t++) {
      const pairs = (c[t] / 2) | 0;
      for (let p = 0; p < pairs; p++) base.push({ tile: t, laizi: 0 });
      if (c[t] % 2 === 1) {
        oddNeed++;
        base.push({ tile: t, laizi: 1 });
      }
    }
    if (oddNeed > L) continue;
    const rest = L - oddNeed;
    if (rest % 2 !== 0) continue;
    const laiziPairs = rest / 2;
    // 剩余赖子两两成对,每对可为任意牌型(非降序列举避免排列重复)
    const extra: QiduiPair[] = [];
    const recPairs = (start: number, left: number): void => {
      if (left === 0) {
        const pairs = [...base, ...extra];
        const key = pairs.map((p) => p.tile).sort((a, b) => a - b).join(',') + `|h${selfSum}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ pairs: pairs.map((p) => ({ ...p })), laiziAsSelf: selfSum });
        }
        return;
      }
      for (let t = start; t < TILE_COUNT; t++) {
        extra.push({ tile: t, laizi: 2 });
        recPairs(t, left - 1);
        extra.pop();
      }
    };
    recPairs(0, laiziPairs);
  }
  return out;
}

/**
 * 十三幺穷举:13 种幺九牌各一张 + 其中一种成对。
 * 枚举对子落在哪种幺九牌上,缺张由赖子补齐。
 */
export function enumerateShisanyao(
  counts: Uint8Array,
  laizi: number,
  laiziTypes: Tile[] = [],
  allowAsSelf = true,
): ShisanyaoDecomp[] {
  const assigns =
    laiziTypes.length === 0 || !allowAsSelf
      ? [new Uint8Array(TILE_COUNT)]
      : selfAssignVecs(laiziTypes, laizi);
  const out: ShisanyaoDecomp[] = [];
  const seen = new Set<string>();

  for (const self of assigns) {
    let selfSum = 0;
    for (const v of self) selfSum += v;
    if (selfSum > laizi) continue;
    const L = laizi - selfSum;
    const c = new Uint8Array(TILE_COUNT);
    for (let i = 0; i < TILE_COUNT; i++) c[i] = counts[i] + self[i];

    let nonYao = 0;
    for (let t = 0; t < TILE_COUNT; t++) if (!YAO13.includes(t)) nonYao += c[t];
    if (nonYao > 0) continue;

    for (const pairTile of YAO13) {
      let need = 0;
      for (const u of YAO13) {
        const req = u === pairTile ? 2 : 1;
        if (c[u] < req) need += req - c[u];
      }
      if (need !== L) continue;
      const key = `${pairTile}|h${selfSum}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ pairTile, laiziAsSelf: selfSum });
      }
    }
  }
  return out;
}
