/**
 * 金手用例格式。
 *
 * 每一手都带 provenance（来源）：
 *  - 'manual'   人工核过的真实牌局，期望值以人工复核为准（最高信任级）
 *  - 'derived'  由构造器生成、经独立校验器复核的回归用例
 * 平台上线验收要求：每个玩法至少 50 手，其中 manual 用例不得为空且逐手双人复核。
 */

import type { WinContext } from '@mahjong/core';

export interface GoldenCase {
  id: string;
  ruleId: string;
  /** 手牌字符串（parseHand 语法，X = 赖子） */
  hand: string;
  context: Partial<WinContext>;
  expected: {
    win: boolean;
    /** 期望总番（不胡为 0） */
    totalFan: number;
    /** 期望命中的番种 id（顺序无关，按集合比对） */
    fanIds: string[];
    /** 期望分值 */
    points: number;
    /** 期望的最佳拆法类型，便于定位拆牌回归 */
    bestKind?: 'standard' | 'sevenPairs' | 'thirteenOrphans';
  };
  note: string;
  provenance: 'manual' | 'derived';
  /** 人工复核人（manual 必填） */
  reviewer?: string;
}

export interface GoldenSuite {
  ruleId: string;
  cases: GoldenCase[];
}

export interface CaseFailure {
  caseId: string;
  note: string;
  field: string;
  expected: unknown;
  actual: unknown;
}

export interface GoldenReport {
  ruleId: string;
  total: number;
  passed: number;
  failed: number;
  failures: CaseFailure[];
}
