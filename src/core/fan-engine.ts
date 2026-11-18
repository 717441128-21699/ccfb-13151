/**
 * 算番引擎：在规则包约束下，对每个具体拆分计算番种集合与番值，
 * 处理包含（高番覆盖低番）、互斥分组、叠加/乘法计分与封顶，
 * 并给出“怎么拆番最大”的最优拆分。
 */

import { getPredicate } from './predicates.ts';
import type { FanContext, GameContext, PredicateParams } from './predicates.ts';
import type { HandState } from './hand.ts';
import type { Decomposition } from './decompose.ts';

export type ScoringMode = 'additive' | 'multiplicative';

export interface FanDef {
  /** 番种唯一 ID，如 qingyise */
  id: string;
  /** 展示名 */
  name: string;
  /** 谓词名（predicates.ts 注册表） */
  predicate: string;
  params?: PredicateParams;
  /** additive：番数；multiplicative：倍数（2 表示翻一番） */
  value: number;
  /** 命中本番时，覆盖（取消）的低番 ID 列表 */
  includes?: string[];
  /** 互斥组 ID：同组只保留首个命中的番种（按 fans 数组顺序定优先级） */
  mutexGroup?: string;
  /** 仅门清有效等门槛由谓词表达；这里可声明不可与赖子共存 */
  requireNoWildcard?: boolean;
  description?: string;
}

export interface ScoringConfig {
  mode: ScoringMode;
  /** 封顶番数（additive）；null 表示不封 */
  cap: number | null;
  /** 起胡番数（低于则不能胡，国标玩法常用 8） */
  minFan: number;
  /** 底分（multiplicative 模式的基数） */
  baseScore?: number;
}

export interface AppliedFan {
  id: string;
  name: string;
  value: number;
}

export interface ExcludedFan {
  id: string;
  name: string;
  reason: 'included' | 'mutex' | 'wildcard-blocked';
  blockedBy: string;
}

export interface DecompositionScore {
  decomposition: Decomposition;
  applied: AppliedFan[];
  excluded: ExcludedFan[];
  /** additive：番数合计（封顶后）；multiplicative：总倍数 */
  total: number;
  /** 封顶前的原始值 */
  rawTotal: number;
  capped: boolean;
  meetsMinFan: boolean;
  /** multiplicative 模式的最终分 = baseScore * 总倍数 */
  score: number;
}

export interface BestResult {
  best: DecompositionScore | null;
  all: DecompositionScore[];
  /** 是否存在满足起胡番的拆分 */
  canWin: boolean;
}

function evaluateOne(
  d: Decomposition,
  hand: HandState,
  game: GameContext,
  fans: FanDef[],
  scoring: ScoringConfig,
): DecompositionScore {
  const ctx: FanContext = {
    counts: hand.counts,
    wildcards: hand.wildcards,
    decomposition: d,
    game,
  };

  const hitIds = new Set<string>();
  const hitDefs: FanDef[] = [];
  const excluded: ExcludedFan[] = [];

  for (const fan of fans) {
    if (fan.requireNoWildcard && hand.wildcards > 0) {
      excluded.push({ id: fan.id, name: fan.name, reason: 'wildcard-blocked', blockedBy: 'wildcard' });
      continue;
    }
    let ok = false;
    try {
      ok = getPredicate(fan.predicate)(ctx, fan.params ?? {});
    } catch (err) {
      throw new Error(`番种 ${fan.id} 判定失败: ${(err as Error).message}`);
    }
    if (ok) {
      hitIds.add(fan.id);
      hitDefs.push(fan);
    }
  }

  // 包含处理：被高番 includes 点名的命中番种取消
  const coveredBy = new Map<string, string>();
  for (const fan of hitDefs) {
    for (const lowId of fan.includes ?? []) {
      if (hitIds.has(lowId) && lowId !== fan.id) coveredBy.set(lowId, fan.id);
    }
  }

  // 互斥处理：同组按 fans 声明顺序，先命中者胜出
  const groupWinner = new Map<string, string>();
  for (const fan of hitDefs) {
    if (!fan.mutexGroup) continue;
    const g = fan.mutexGroup;
    if (coveredBy.has(fan.id)) continue;
    if (!groupWinner.has(g)) groupWinner.set(g, fan.id);
  }

  const applied: AppliedFan[] = [];
  const finalDefs: FanDef[] = [];
  for (const fan of hitDefs) {
    const cover = coveredBy.get(fan.id);
    if (cover) {
      excluded.push({ id: fan.id, name: fan.name, reason: 'included', blockedBy: cover });
      continue;
    }
    if (fan.mutexGroup && groupWinner.get(fan.mutexGroup) !== fan.id) {
      excluded.push({
        id: fan.id,
        name: fan.name,
        reason: 'mutex',
        blockedBy: groupWinner.get(fan.mutexGroup) ?? fan.mutexGroup,
      });
      continue;
    }
    applied.push({ id: fan.id, name: fan.name, value: fan.value });
    finalDefs.push(fan);
  }

  let rawTotal: number;
  let total: number;
  if (scoring.mode === 'additive') {
    rawTotal = applied.reduce((sum, f) => sum + f.value, 0);
    total = scoring.cap === null ? rawTotal : Math.min(rawTotal, scoring.cap);
  } else {
    rawTotal = applied.reduce((mul, f) => mul * f.value, 1);
    total = scoring.cap === null ? rawTotal : Math.min(rawTotal, Math.pow(2, scoring.cap));
  }
  const capped = rawTotal !== total;
  const score = scoring.mode === 'multiplicative'
    ? (scoring.baseScore ?? 1) * total
    : total;

  return {
    decomposition: d,
    applied,
    excluded,
    total,
    rawTotal,
    capped,
    meetsMinFan: scoring.mode === 'additive'
      ? total >= scoring.minFan
      : Math.log2(total) >= scoring.minFan,
    score,
  };
}

/** 对全部拆分评分并选出番值最大者（同值取拆分 key 字典序，保证确定性） */
export function evaluateHand(
  hand: HandState,
  decompositions: Decomposition[],
  fans: FanDef[],
  scoring: ScoringConfig,
  game: GameContext,
): BestResult {
  const all = decompositions.map((d) => evaluateOne(d, hand, game, fans, scoring));
  all.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.decomposition.key.localeCompare(b.decomposition.key);
  });
  const best = all[0] ?? null;
  return { best, all, canWin: all.some((r) => r.meetsMinFan) };
}
