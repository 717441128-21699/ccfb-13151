import { FLOWER_BASE, TILE_COUNT, type Tile } from './tiles.ts';
import type { RulePack } from './rule.ts';

/** 按规则包配置砌牌墙(数牌字牌各四张 + 花牌) */
export function buildWall(pack: RulePack): Tile[] {
  const wall: Tile[] = [];
  const suitBase: Record<string, number> = { m: 0, p: 9, s: 18 };
  const push4 = (t: Tile): void => {
    for (let i = 0; i < 4; i++) wall.push(t);
  };
  for (const s of pack.tiles.suits) {
    for (let r = 0; r < 9; r++) push4(suitBase[s] + r);
  }
  if (pack.tiles.winds) for (let t = 27; t <= 30; t++) push4(t);
  if (pack.tiles.dragons) for (let t = 31; t <= 33; t++) push4(t);
  for (let f = 0; f < pack.tiles.flowers; f++) wall.push(FLOWER_BASE + f);
  return wall;
}

/** 洗牌(传入种子随机源,便于测试复现) */
export function shuffle(wall: Tile[], rng: () => number): Tile[] {
  const a = [...wall];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 发牌:四家各 13 张,庄家 14 张,剩余为牌墙 */
export function deal(
  pack: RulePack,
  rng: () => number,
): { hands: Tile[][]; wall: Tile[] } {
  const wall = shuffle(buildWall(pack), rng);
  const hands: Tile[][] = [[], [], [], []];
  for (let round = 0; round < 13; round++) {
    for (let p = 0; p < 4; p++) hands[p].push(wall.pop()!);
  }
  hands[0].push(wall.pop()!); // 庄家 14 张
  return { hands, wall };
}

/** 简单的种子随机源(测试/演示用) */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
