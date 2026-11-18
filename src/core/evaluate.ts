/**
 * 引擎门面：规则包 + 一手牌 + 牌局上下文 -> 完整分析结论。
 * 浏览器与 Node 共用这一层；UI 只做数据绑定，不承载规则逻辑。
 */

import { analyzeHand } from './win.ts';
import { evaluateHand } from './fan-engine.ts';
import type { BestResult, DecompositionScore } from './fan-engine.ts';
import type { HandState } from './hand.ts';
import type { GameContext } from './predicates.ts';
import type { RulePack } from '../rules/types.ts';
import type { HandAnalysis, WaitResult } from './win.ts';

export interface RuleEvaluation {
  analysis: HandAnalysis;
  scoring: BestResult | null;
  /** 结构性门槛（如定缺）是否满足 */
  structuralChecks: {
    missingSuit: boolean;
  };
  /** 综合结论：能胡且番值达标且结构门槛通过 */
  canWin: boolean;
  best: DecompositionScore | null;
}

function checkMissingSuit(hand: HandState, pack: RulePack, game: GameContext): boolean {
  if (!pack.requirements.requireMissingSuit) return true;
  const suit = game.absentSuit;
  if (!suit) return false; // 定缺玩法必须给出缺门
  for (let id = 0; id < hand.counts.length; id++) {
    if ((hand.counts[id] ?? 0) === 0) continue;
    const s = id < 9 ? 'm' : id < 18 ? 's' : id < 27 ? 'p' : null;
    if (s === suit) return false;
  }
  return true;
}

export function evaluateWithRules(
  pack: RulePack,
  hand: HandState,
  game: GameContext,
): RuleEvaluation {
  const analysis = analyzeHand(hand);
  const missingSuit = checkMissingSuit(hand, pack, game);

  let scoring: BestResult | null = null;
  if (analysis.total === 14 && analysis.isWin) {
    scoring = evaluateHand(hand, analysis.decompositions, pack.fans, pack.scoring, game);
  }

  const canWin =
    analysis.isWin &&
    missingSuit &&
    (scoring?.canWin ?? false);

  return {
    analysis,
    scoring,
    structuralChecks: { missingSuit },
    canWin,
    best: scoring?.best ?? null,
  };
}

export type { WaitResult };
