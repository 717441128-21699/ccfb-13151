/**
 * 番种引擎：对每一种可行拆法跑番种表，处理包含关系、起胡门槛、封顶与计分，
 * 最终给出「最大番拆法」与完整拆番明细——即策划验收时看的「怎么拆番最大」。
 */

import {
  checkWin,
  type AnyDecomposition,
} from '@mahjong/core';
import {
  defaultWinContext,
  type FanContext,
  type WinContext,
} from '@mahjong/core';
import type { FanDefinition, RuleSet } from './schema.js';
import { evalExpr, validateExpr } from './dsl.js';
import type { HandTiles } from '@mahjong/core';

export interface FanHit {
  fanId: string;
  name: string;
  value: number;
  limit: boolean;
}

export interface DecompositionScore {
  decomposition: AnyDecomposition;
  hits: FanHit[];
  totalFan: number;
  /** 被包含关系排除掉的番种（透明展示，方便策划核对） */
  excluded: Array<{ fanId: string; reason: string }>;
  capped: boolean;
  points: number;
  /** 是否满足起胡番数 */
  meetsMinFan: boolean;
}

export interface ScoreResult {
  win: boolean;
  /** 所有拆法的计分（按分值降序） */
  scores: DecompositionScore[];
  /** 最高分拆法（win=true 时一定存在） */
  best: DecompositionScore | null;
  /** 不满足全局约束/起胡门槛的说明 */
  rejectedReasons: string[];
}

function applyExclusions(
  hits: FanDefinition[],
): { kept: FanDefinition[]; excluded: Array<{ fanId: string; reason: string }> } {
  const hitIds = new Set(hits.map((h) => h.id));
  const removed = new Map<string, string>();
  for (const h of hits) {
    for (const low of h.excludes) {
      if (hitIds.has(low) && low !== h.id) removed.set(low, h.id);
    }
  }
  return {
    kept: hits.filter((h) => !removed.has(h.id)),
    excluded: [...removed.entries()].map(([fanId, reason]) => ({ fanId, reason })),
  };
}

function computePoints(
  rule: RuleSet,
  totalFan: number,
  hasLimit: boolean,
): { points: number; capped: boolean } {
  const { model, capFan, capPoints } = rule.scoring;
  // 役满直接取分值封顶，不走普通番数换算
  if (hasLimit) {
    return { points: capPoints ?? totalFan, capped: capPoints !== null };
  }
  let fan = totalFan;
  let capped = false;
  if (capFan !== null && fan > capFan) {
    fan = capFan;
    capped = true;
  }
  let points: number;
  switch (model.kind) {
    case 'fanSum':
      points = fan;
      break;
    case 'fanMultiply':
      points = model.baseFan * 2 ** Math.max(0, fan - model.baseFan);
      break;
    case 'pointTable':
      points = model.perFanPoints[Math.min(fan, model.perFanPoints.length - 1)] ?? 0;
      break;
  }
  if (hasLimit && capPoints !== null) {
    points = capPoints;
    capped = true;
  }
  if (capPoints !== null && points > capPoints) {
    points = capPoints;
    capped = true;
  }
  return { points, capped };
}

export interface ScoreInput {
  hand: HandTiles;
  rule: RuleSet;
  context?: Partial<WinContext>;
}

export function scoreHand(input: ScoreInput): ScoreResult {
  const { hand, rule } = input;
  const ctx: WinContext = { ...defaultWinContext, ...input.context };
  const rejectedReasons: string[] = [];

  const winCheck = checkWin(hand, {
    sevenPairs: rule.winPatterns.sevenPairs,
    thirteenOrphans: rule.winPatterns.thirteenOrphans,
  });
  if (!winCheck.win) {
    return { win: false, scores: [], best: null, rejectedReasons: ['牌面不构成任何胡牌牌型'] };
  }

  const scores: DecompositionScore[] = [];
  for (const decomposition of winCheck.decompositions) {
    const fanCtx: FanContext = { hand, decomposition, win: ctx };

    // 全局约束（如缺门）：任一不满足，该拆法直接作废
    const constraintFailed = rule.globalConstraints
      .map((e) => evalExpr(e, fanCtx))
      .filter((ok) => !ok).length;
    if (constraintFailed > 0) {
      rejectedReasons.push(`拆法 ${decomposition.signature} 未通过全局约束`);
      continue;
    }

    const matched = rule.fans.filter((f) => evalExpr(f.when, fanCtx));
    const { kept, excluded } = applyExclusions(matched);
    const limitFans = kept.filter((f) => f.limit);
    const hasLimit = limitFans.length > 0;
    // 役满语义：命中任意役满番即按 capPoints 封顶，普通番不再叠加
    const scoredFans = hasLimit ? limitFans : kept;
    const totalFan = scoredFans.reduce((s, f) => s + f.value, 0);
    const { points, capped } = computePoints(rule, totalFan, hasLimit);
    const meetsMinFan = totalFan >= rule.winPatterns.minFan;
    if (!meetsMinFan) {
      rejectedReasons.push(
        `拆法 ${decomposition.signature} 仅 ${totalFan} 番，低于起胡 ${rule.winPatterns.minFan} 番`,
      );
    }
    scores.push({
      decomposition,
      hits: scoredFans.map((f) => ({
        fanId: f.id,
        name: f.name,
        value: f.value,
        limit: Boolean(f.limit),
      })),
      totalFan,
      excluded,
      capped,
      points,
      meetsMinFan,
    });
  }

  scores.sort((a, b) => b.points - a.points || b.totalFan - a.totalFan);
  const valid = scores.filter((s) => s.meetsMinFan);
  return {
    win: valid.length > 0,
    scores,
    best: valid[0] ?? null,
    rejectedReasons,
  };
}

/** 规则集静态校验（发布前/保存前调用） */
export function validateRuleSet(rule: RuleSet): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const f of rule.fans) {
    if (ids.has(f.id)) errors.push(`番种 id 重复: ${f.id}`);
    ids.add(f.id);
    if (f.value < 0) errors.push(`番种 ${f.id} 番值为负`);
    errors.push(...validateExpr(f.when).map((e) => `番种 ${f.id}: ${e}`));
  }
  for (const f of rule.fans) {
    for (const ex of f.excludes) {
      if (!ids.has(ex)) errors.push(`番种 ${f.id} 引用了不存在的 excludes: ${ex}`);
      if (ex === f.id) errors.push(`番种 ${f.id} 不能 excludes 自身`);
    }
  }
  for (const [i, c] of rule.globalConstraints.entries()) {
    errors.push(...validateExpr(c).map((e) => `全局约束[${i}]: ${e}`));
  }
  // 包含关系环检测：每个根用独立的访问状态，避免跨根的进行中标记互相污染
  const graph = new Map(rule.fans.map((f) => [f.id, f.excludes]));
  const hasCycleFrom = (root: string): boolean => {
    const state = new Map<string, 0 | 1 | 2>();
    const dfs = (id: string): boolean => {
      const s = state.get(id) ?? 0;
      if (s === 1) return true; // 回到当前路径上的进行中节点 → 真环
      if (s === 2) return false; // 已完整处理 → 无环，剪枝
      state.set(id, 1);
      for (const nxt of graph.get(id) ?? []) {
        if (ids.has(nxt) && dfs(nxt)) return true;
      }
      state.set(id, 2);
      return false;
    };
    return dfs(root);
  };
  for (const f of rule.fans) {
    if (hasCycleFrom(f.id)) {
      errors.push('番种包含关系存在环');
      break;
    }
  }
  return errors;
}
