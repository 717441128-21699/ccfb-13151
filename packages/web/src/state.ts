/**
 * Web 端共享状态：当前编辑中的规则集、当前摆上桌的手牌。
 * 状态变化通过订阅者通知各面板刷新。
 */
import { sichuanRule, guangdongRule, type RuleSet } from '@mahjong/rules';
import { tileLabel } from '@mahjong/core';

export const RULE_TEMPLATES: Record<string, RuleSet> = {
  [sichuanRule.id]: sichuanRule,
  [guangdongRule.id]: guangdongRule,
};

export interface HandState {
  counts: number[];
  jokers: number;
}

export interface AppState {
  rule: RuleSet;
  hand: HandState;
  context: {
    selfDrawn: boolean;
    robKong: boolean;
    afterKong: boolean;
    bottomDraw: boolean;
    bottomDiscard: boolean;
  };
}

export const state: AppState = {
  rule: structuredClone(sichuanRule),
  hand: { counts: new Array<number>(34).fill(0), jokers: 0 },
  context: {
    selfDrawn: false,
    robKong: false,
    afterKong: false,
    bottomDraw: false,
    bottomDiscard: false,
  },
};

const listeners = new Set<() => void>();
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function notify(): void {
  for (const fn of listeners) fn();
}

export function handToString(s: HandState): string {
  const groups: Array<{ suit: 'm' | 's' | 'p' | 'z'; ranks: number[] }> = [
    { suit: 'm', ranks: [] },
    { suit: 's', ranks: [] },
    { suit: 'p', ranks: [] },
    { suit: 'z', ranks: [] },
  ];
  for (let t = 0; t < 34; t++) {
    for (let k = 0; k < s.counts[t]!; k++) {
      const idx = t < 9 ? 0 : t < 18 ? 1 : t < 27 ? 2 : 3;
      groups[idx]!.ranks.push(t < 9 ? t + 1 : t < 18 ? t - 8 : t < 27 ? t - 17 : t - 26);
    }
  }
  const natural = groups
    .filter((g) => g.ranks.length > 0)
    .map((g) => g.ranks.join('') + g.suit)
    .join('');
  return natural + 'X'.repeat(s.jokers);
}

export function handTotal(s: HandState): number {
  return s.jokers + s.counts.reduce((a, b) => a + b, 0);
}

export function resetHand(): void {
  state.hand.counts.fill(0);
  state.hand.jokers = 0;
  notify();
}

export function addTile(t: number | 'joker'): void {
  if (t === 'joker') {
    if (state.hand.jokers < 4) state.hand.jokers++;
  } else if (state.hand.counts[t]! < 4) {
    state.hand.counts[t]!++;
  }
  notify();
}

export function removeTile(t: number | 'joker'): void {
  if (t === 'joker') state.hand.jokers = Math.max(0, state.hand.jokers - 1);
  else state.hand.counts[t] = Math.max(0, state.hand.counts[t]! - 1);
  notify();
}

export { tileLabel };
