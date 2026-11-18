/**
 * 规则包：一个地方玩法的完整声明式描述。
 * 策划在浏览器里产出的就是这份 JSON（带 schema 校验），引擎不内置任何地方规则。
 */

import type { FanDef, ScoringConfig } from '../core/fan-engine.ts';

export type ClaimAction = 'chow' | 'pung' | 'concealedKong' | 'exposedKong' | 'win';

export interface ClaimPriority {
  /** 同一事件多个可响应动作时的优先级（数组靠前优先），如 ["win","pung","chow"] */
  order: ClaimAction[];
  /** 一炮多响：多家可胡是否同时成立 */
  multiWin: boolean;
  /** 抢杠胡是否允许 */
  robbingKong: boolean;
  /** 海底捞月（最后一张）是否加番 */
  lastTileBonus: boolean;
  /** 杠后补牌自摸（杠上开花）是否允许 */
  supplementKong: boolean;
}

export interface WinStructureConfig {
  standard: boolean;
  sevenPairs: boolean;
  thirteenOrphans: boolean;
  /** 七对是否允许四张同种算两对（经典七对） */
  allowQuadInSevenPairs: boolean;
}

export interface WildcardConfig {
  enabled: boolean;
  /** 赖子的天然牌 ID（如红中=31）；null 表示按配牌动态决定 */
  naturalId: number | null;
  /** 最多允许张数 */
  maxCount: number;
  /** 赖子是否可以按天然形态本身使用（部分玩法禁止） */
  allowAsNatural: boolean;
}

export interface RulePack {
  /** 规则包语义版本，配置变更必须升版本，历史牌局按旧版本复算 */
  version: string;
  id: string;
  name: string;
  region: string;
  /** 牌墙配置 */
  wall: {
    /** 每种牌张数（标准 4） */
    copiesPerTile: number;
    /** 花牌 ID 列表（本版本保留字段，花牌流程见路线图） */
    flowerTiles: number[];
  };
  wildcard: WildcardConfig;
  winStructures: WinStructureConfig;
  claim: ClaimPriority;
  fans: FanDef[];
  scoring: ScoringConfig;
  /** 起胡限制（除 minFan 外的结构性限制，如必须缺门） */
  requirements: {
    /** 必须缺一门（四川定缺） */
    requireMissingSuit: boolean;
  };
  documentation?: {
    summary: string;
    notes: string[];
  };
}
