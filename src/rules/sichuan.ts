/**
 * 四川血战（简化演示版）：定缺、无字、自摸加番、三番封顶。
 * 真实地方细则（查大叫、退税等）在平台中以同结构扩展，本包用于打通引擎链路。
 */

import type { RulePack } from './types.ts';

export const sichuanPack: RulePack = {
  version: '0.1.0',
  id: 'sichuan-xuezhan-demo',
  name: '四川血战（演示子集）',
  region: '四川',
  wall: { copiesPerTile: 4, flowerTiles: [] },
  wildcard: { enabled: false, naturalId: null, maxCount: 0, allowAsNatural: false },
  winStructures: {
    standard: true,
    sevenPairs: true,
    thirteenOrphans: false,
    allowQuadInSevenPairs: true,
  },
  claim: {
    order: ['win', 'pung', 'chow', 'exposedKong', 'concealedKong'],
    multiWin: true,
    robbingKong: true,
    lastTileBonus: true,
    supplementKong: true,
  },
  requirements: { requireMissingSuit: true },
  scoring: { mode: 'additive', cap: 3, minFan: 1, baseScore: 1 },
  fans: [
    {
      id: 'qingyise',
      name: '清一色',
      predicate: 'allOneSuit',
      value: 2,
      includes: ['duanyaojiu', 'pinghu'],
      description: '只含一种数牌花色，覆盖平胡/断幺',
    },
    {
      id: 'qidui',
      name: '七对',
      predicate: 'sevenPairs',
      value: 2,
      mutexGroup: 'structure',
    },
    {
      id: 'haohuaqidui',
      name: '豪华七对',
      predicate: 'deluxeSevenPairs',
      value: 3,
      includes: ['qidui'],
      mutexGroup: 'structure',
    },
    {
      id: 'penghu',
      name: '碰碰胡',
      predicate: 'allTriplets',
      value: 1,
      includes: ['pinghu'],
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
      id: 'zimo',
      name: '自摸',
      predicate: 'selfDraw',
      value: 1,
    },
    {
      id: 'haidilao',
      name: '海底捞月',
      predicate: 'lastTile',
      value: 1,
    },
    {
      id: 'qianggang',
      name: '抢杠胡',
      predicate: 'robKong',
      value: 1,
    },
    {
      id: 'gangshanghua',
      name: '杠上开花',
      predicate: 'supplementAfterKong',
      value: 1,
    },
  ],
  documentation: {
    summary: '四川血战演示规则：必须缺一门才能胡，三番封顶，一炮多响。',
    notes: [
      '定缺花色由牌局上下文 absentSuit 给出，胡牌时先做缺门校验。',
      '清一色覆盖平胡与断幺九，不重复计番。',
      '七对/碰碰胡/平胡同属结构互斥组，同一拆分只取其一。',
    ],
  },
};
