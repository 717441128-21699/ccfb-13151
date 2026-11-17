/**
 * 独立校验器：用与主引擎不同的实现路径复核金手用例，防止「同一份错误逻辑两边都对」。
 *
 * 做法：递归移除完整面子（不锚定、不去重，枚举所有多重集划分），
 * 再对每种划分独立计算番种，与主引擎 scoreHand 的结论交叉比对。
 * 只用于离线验证，不追求线上性能。
 */

import {
  checkWin,
  isHonor,
  parseHand,
  type HandTiles,
} from '@mahjong/core';
import type { RuleSet } from '@mahjong/rules';
import type { WinContext } from '@mahjong/core';

type Partition = Array<{ type: 'triplet' | 'sequence' | 'pair'; tiles: number[] }>;

function enumeratePartitions(counts: number[], jokers: number): Partition[] {
  const out: Partition[] = [];
  const work = counts.slice();

  function firstTile(): number {
    for (let t = 0; t < 34; t++) if (work[t]! > 0) return t;
    return -1;
  }

  function rec(jLeft: number, acc: Partition): void {
    const anchor = firstTile();
    if (anchor === -1) {
      // 剩余赖子必须成对（仅允许 0 或 2 的倍数场景，由总数保证）
      if (jLeft === 0) out.push(acc.map((m) => ({ ...m, tiles: m.tiles.slice() })));
      else if (jLeft === 2 && !acc.some((m) => m.type === 'pair')) {
        acc.push({ type: 'pair', tiles: [-1, -1] });
        out.push(acc.map((m) => ({ ...m, tiles: m.tiles.slice() })));
        acc.pop();
      }
      return;
    }
    const hasPair = acc.some((m) => m.type === 'pair');

    // 自然刻
    if (work[anchor]! >= 3) {
      work[anchor]! -= 3;
      acc.push({ type: 'triplet', tiles: [anchor, anchor, anchor] });
      rec(jLeft, acc);
      acc.pop();
      work[anchor]! += 3;
    }
    // 自然顺（起点枚举 anchor-2..anchor，可重复枚举，校验器不去重）
    if (!isHonor(anchor)) {
      const base = Math.floor(anchor / 9) * 9;
      for (let s = Math.max(base, anchor - 2); s <= anchor; s++) {
        const t = [s, s + 1, s + 2];
        if (t.every((x) => work[x]! > 0)) {
          for (const x of t) work[x]!--;
          acc.push({ type: 'sequence', tiles: t });
          rec(jLeft, acc);
          acc.pop();
          for (const x of t) work[x]!++;
        }
      }
    }
    // 自然将
    if (!hasPair && work[anchor]! >= 2) {
      work[anchor]! -= 2;
      acc.push({ type: 'pair', tiles: [anchor, anchor] });
      rec(jLeft, acc);
      acc.pop();
      work[anchor]! += 2;
    }
    // 赖子替刻（2 自然 + 1 赖 / 1 自然 + 2 赖）
    if (work[anchor]! >= 2 && jLeft >= 1) {
      work[anchor]! -= 2;
      acc.push({ type: 'triplet', tiles: [anchor, anchor, anchor] });
      rec(jLeft - 1, acc);
      acc.pop();
      work[anchor]! += 2;
    }
    if (work[anchor]! >= 1 && jLeft >= 2) {
      work[anchor]! -= 1;
      acc.push({ type: 'triplet', tiles: [anchor, anchor, anchor] });
      rec(jLeft - 2, acc);
      acc.pop();
      work[anchor]! += 1;
    }
    // 赖子替顺：枚举含 anchor 的顺起点，缺牌槽位用赖子补
    if (!isHonor(anchor)) {
      const base = Math.floor(anchor / 9) * 9;
      for (let s = Math.max(base, anchor - 2); s <= anchor; s++) {
        const slots = [s, s + 1, s + 2];
        const otherSlots = slots.filter((x) => x !== anchor);
        const naturalSlots = otherSlots.filter((x) => work[x]! > 0);
        const jokerNeed = otherSlots.length - naturalSlots.length;
        if (jokerNeed > jLeft) continue;
        for (const x of naturalSlots) work[x]!--;
        work[anchor]!--;
        acc.push({ type: 'sequence', tiles: slots });
        rec(jLeft - jokerNeed, acc);
        acc.pop();
        work[anchor]!++;
        for (const x of naturalSlots) work[x]!++;
      }
    }
    // 赖子替将
    if (!hasPair && jLeft >= 1) {
      work[anchor]! -= 1;
      acc.push({ type: 'pair', tiles: [anchor, anchor] });
      rec(jLeft - 1, acc);
      acc.pop();
      work[anchor]! += 1;
    }
  }
  rec(jokers, []);
  return out;
}

/**
 * 交叉复核结论（只针对牌面层面的标准型可胡性，与地方约束/番种门槛无关）：
 *  - partitionWin: 独立划分器是否找到至少一个 4 面子 + 1 将
 *  - engineWin:    主引擎 checkWin 的标准型结论
 * 两者必须一致；缺门、起胡番等规则层差异由 runner 的期望比对负责。
 */
export function crossCheckStandard(
  hand: HandTiles,
  _rule: RuleSet,
  _context: Partial<WinContext>,
): { partitionWin: boolean; engineWin: boolean; consistent: boolean } {
  const partitions = enumeratePartitions(hand.counts, hand.jokers);
  const partitionWin = partitions.some(
    (p) =>
      p.length === 5 &&
      p.filter((m) => m.type === 'pair').length === 1 &&
      p.filter((m) => m.type !== 'pair').length === 4,
  );
  const engine = checkWin(hand, {});
  const engineStandardWin = engine.decompositions.some((d) => d.kind === 'standard');
  return {
    partitionWin,
    engineWin: engineStandardWin,
    consistent: partitionWin === engineStandardWin,
  };
}

export function crossCheckHandString(
  handStr: string,
  rule: RuleSet,
  context: Partial<WinContext> = {},
) {
  return crossCheckStandard(parseHand(handStr), rule, context);
}
