/**
 * 赖子玩法演示包：红中为赖子，最多 2 张，演示赖子胡、赖子将展开与封顶。
 * 各地“赖子能不能当本牌/能不能胡大牌”的差异通过 requireNoWildcard 与
 * wildcard 配置表达，无需改引擎。
 */

import type { RulePack } from './types.ts';

export const laiziPack: RulePack = {
  version: '0.1.0',
  id: 'hunan-laizi-demo',
  name: '红中赖子（演示）',
  region: '湖南（通用赖子演示）',
  wall: { copiesPerTile: 4, flowerTiles: [] },
  wildcard: { enabled: true, naturalId: 31, maxCount: 2, allowAsNatural: false },
  winStructures: {
    standard: true,
    sevenPairs: true,
    thirteenOrphans: false,
    allowQuadInSevenPairs: true,
  },
  claim: {
    order: ['win', 'pung', 'chow', 'exposedKong', 'concealedKong'],
    multiWin: true,
    robbingKong: false,
    lastTileBonus: true,
    supplementKong: true,
  },
  requirements: { requireMissingSuit: false },
  scoring: { mode: 'additive', cap: 6, minFan: 1, baseScore: 1 },
  fans: [
    {
      id: 'qingyise',
      name: '清一色',
      predicate: 'allOneSuit',
      value: 3,
      includes: ['duanyaojiu', 'pinghu'],
      requireNoWildcard: true,
      description: '赖子不参与时才可认定天然清一色',
    },
    {
      id: 'penghu',
      name: '碰碰胡',
      predicate: 'allTriplets',
      value: 2,
      includes: ['pinghu'],
      mutexGroup: 'structure',
    },
    {
      id: 'qidui',
      name: '七对',
      predicate: 'sevenPairs',
      value: 3,
      mutexGroup: 'structure',
    },
    {
      id: 'duanyaojiu',
      name: '断幺九',
      predicate: 'allSimples',
      value: 1,
    },
    {
      id: 'pinghu',
      name: '平胡',
      predicate: 'allSequences',
      value: 1,
      mutexGroup: 'structure',
    },
    {
      id: 'tianran',
      name: '天然胡（无赖）',
      predicate: 'noWildcard',
      value: 2,
      description: '不借助赖子胡牌',
    },
    {
      id: 'laizihu',
      name: '赖子胡',
      predicate: 'usesWildcard',
      params: { min: 1 },
      value: 1,
    },
    {
      id: 'zimo',
      name: '自摸',
      predicate: 'selfDraw',
      value: 1,
    },
  ],
  documentation: {
    summary: '红中赖子演示：赖子可替任意牌，六番封顶，天然胡加倍、大牌限天然。',
    notes: [
      '清一色声明 requireNoWildcard，赖子参与的清一色改走平胡/断幺等小番。',
      '两张赖子互配为将时，展开器枚举全部 34 个目标牌种参与番型比较。',
      '抢杠胡在本玩法关闭（claim.robbingKong=false），由动作解析器拦截。',
    ],
  },
};
