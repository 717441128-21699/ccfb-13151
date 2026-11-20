import type { Tile } from './tiles.ts';

/** 副露(吃碰杠) */
export interface ExposedMeld {
  kind: 'chi' | 'peng' | 'gang' | 'angang';
  /** 顺子为最小牌,其余为牌本身 */
  base: Tile;
}

/** 胡牌时的上下文(由桌流程填入,边角规则都在这里体现) */
export interface WinContext {
  isZimo?: boolean; // 自摸
  isRobKong?: boolean; // 抢杠胡
  isLastWallTile?: boolean; // 海底捞月(牌墙最后一张自摸)
  isLastDiscard?: boolean; // 河底捞鱼(最后一张打出的牌胡)
  isKongFlower?: boolean; // 杠上开花
  isTianHu?: boolean; // 天胡
  isDiHu?: boolean; // 地胡
  seatWind?: Tile; // 门风
  prevalentWind?: Tile; // 圈风
  flowers?: Tile[]; // 手中的花牌(34-41)
  melds?: ExposedMeld[]; // 已副露
  winTile?: Tile; // 胡的那张牌
}

/** 番种定义。predicate 引用谓词库或规则包自定义谓词。 */
export interface FanDef {
  id: string;
  name: string;
  score: number;
  unit: 'fan' | 'fen'; // 番(翻倍制) 或 分(累加制,如国标)
  predicate: string;
  params?: Record<string, unknown>;
  /** 命中本番种后,这些番种不计(番种包含关系,如 清一色 不计 无字) */
  excludes?: string[];
  /** 分数随数量翻倍:flowers=按花牌数,gangs=按杠数 */
  multiplyBy?: 'flowers' | 'gangs';
  description?: string;
}

/** 规则包:一种地方玩法的完整配置,JSON 可序列化(customPredicates 除外) */
export interface RulePack {
  id: string;
  name: string;
  region?: string;
  description?: string;
  tiles: {
    suits: ('m' | 'p' | 's')[];
    winds: boolean;
    dragons: boolean;
    flowers: number; // 花牌张数(0 或 8)
  };
  laizi: null | {
    tiles: Tile[];
    allowAsSelf: boolean; // 赖子能否当自身用(硬胡)
    canDiscard: boolean;
    note?: string;
  };
  /** 启用的胡牌结构 */
  structures: ('standard' | 'qidui' | 'shisanyao')[];
  /** 胡牌前置条件(如四川必须缺门),全部满足才算胡 */
  winRequirements?: { predicate: string; params?: Record<string, unknown> }[];
  fans: FanDef[];
  cap?: { maxFan?: number; maxFen?: number };
  scoring: {
    rankBy: 'fan' | 'fen'; // 比大小以番还是分为准
    minFenToWin?: number; // 起胡分(国标 8 分)
    formula?: { type: 'pow2'; base: number } | { type: 'fen' } | { type: 'none' };
  };
  /** 吃碰杠胡优先级,数字大者优先 */
  priorities: { hu: number; gang: number; peng: number; chi: number };
  /** 边角规则 */
  edge: {
    yiPaoDuoXiang: boolean; // 一炮多响(false 则截胡)
    qiangGangHu: 'none' | 'addedKong' | 'all'; // 抢杠胡范围
    haidilao: boolean; // 海底捞月
    hediyu: boolean; // 河底捞鱼
    kongFlower: boolean; // 杠上开花
  };
  /** 代码级扩展点:本玩法特有的谓词(不进 JSON) */
  customPredicates?: Record<string, (v: unknown, ctx: unknown, params?: unknown) => boolean>;
}
