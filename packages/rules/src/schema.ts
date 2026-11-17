/**
 * 地方玩法规则集 Schema。
 * 一份 RuleSet 完整描述一个地方玩法：牌池/赖子、胡型开关、番种表、
 * 番种包含关系、封顶、动作优先级、边角事件、计分模型。
 * 所有字段可 JSON 序列化，直接进 Git 做版本管理与评审。
 */

import type { ExprNode } from './dsl.js';

/** 动作优先级声明：前置动作优先于后置动作，例如 ['robbingKong','win','kong','pung','chow'] */
export type ActionKind = 'chow' | 'pung' | 'kong' | 'win' | 'robbingKong';

export interface JokerRule {
  enabled: boolean;
  /** 固定赖子牌编号；若 rule 为 'turn'（翻牌定赖），这里给初始值或留空由对局下发 */
  fixedTiles?: number[];
  /** 翻牌定赖时的取法：+1 顺位 / 同点数跨花色等，引擎提供钩子 */
  determine?: 'fixed' | 'turnNext';
  /** 赖子能否参与七对（部分玩法赖子只能替牌不能成对） */
  allowedInSevenPairs: boolean;
}

export type ScoringModel =
  | { kind: 'fanSum' } // 番种直接相加
  | { kind: 'fanMultiply'; baseFan: number } // 底番 × 2^(总番-底番) 类指数模型
  | { kind: 'pointTable'; perFanPoints: number[] }; // 番数→分值查表

export interface RuleSet {
  id: string;
  name: string;
  region: string;
  version: string;
  description: string;

  tileRange: {
    /** 是否使用三种数牌花色（个别玩法只有两种） */
    suits: Array<'m' | 's' | 'p'>;
    useWinds: boolean;
    useDragons: boolean;
  };

  joker: JokerRule;

  winPatterns: {
    standard: boolean;
    sevenPairs: boolean;
    thirteenOrphans: boolean;
    /** 起胡番数门槛（低于此番数的胡牌不成立） */
    minFan: number;
  };

  /** 番种表 */
  fans: FanDefinition[];

  /** 计分模型与封顶 */
  scoring: {
    model: ScoringModel;
    /** 封顶番数（null = 不封） */
    capFan: number | null;
    /** 封顶分值（在分值层面再封一道，null = 不封） */
    capPoints: number | null;
  };

  /** 动作优先级（高到低） */
  actionPriority: ActionKind[];

  /** 边角事件规则 */
  events: {
    /** 一炮多响：多家同时荣胡是否全部成立 */
    multipleWinnersOnDiscard: boolean;
    /** 抢杠胡是否允许 */
    robKong: boolean;
    /** 可被抢的杠类型 */
    robKongTargets: Array<'exposed' | 'concealed' | 'added'>;
    /** 海底捞月（自摸牌墙最后一张） */
    bottomDrawWin: boolean;
    /** 河底捞鱼（荣胡最后弃牌） */
    bottomDiscardWin: boolean;
    /** 杠上开花 */
    afterKongWin: boolean;
    /** 一炮多响时放炮者的包赔方式：'each' 每家各赔一份 / 'split' 分摊 */
    dealerPaymentOnMultiWin: 'each' | 'split';
  };

  /** 额外约束（如必须缺门），表达式引用谓词库；为空则无 */
  globalConstraints: ExprNode[];
}

export interface FanDefinition {
  id: string;
  name: string;
  /** 番值（fanSum 模型下直接相加；指数模型下作为番数档位） */
  value: number;
  /** 番种描述，自动进入规则说明文档 */
  description: string;
  /** 命中条件 DSL */
  when: ExprNode;
  /**
   * 包含关系：本番种命中时，列表中的番种被排除（高番包低番）。
   * 例如清一色包含混一色、对对胡包含平胡。
   * 不同胡型（标准型/七对/十三幺）天然属于不同拆法，引擎对各拆法独立计分后
   * 取最高分，无需在此声明跨胡型互斥。
   */
  excludes: string[];
  /** 是否为役满/封顶番种（命中即直接到 capPoints） */
  limit?: boolean;
}
