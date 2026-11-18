/**
 * 国标麻将（81 番体系）子集：演示“高番覆盖低番 + 8 番起胡 + 乘法可选”的结构。
 * 完整 81 番按同一 FanDef 结构登记即可，本包挑选有代表性的番种打通链路。
 */

import type { RulePack } from './types.ts';

export const guobiaoPack: RulePack = {
  version: '0.1.0',
  id: 'guobiao-subset',
  name: '国标麻将（演示子集）',
  region: '全国（国标）',
  wall: { copiesPerTile: 4, flowerTiles: [] },
  wildcard: { enabled: false, naturalId: null, maxCount: 0, allowAsNatural: false },
  winStructures: {
    standard: true,
    sevenPairs: true,
    thirteenOrphans: true,
    allowQuadInSevenPairs: false,
  },
  claim: {
    order: ['win', 'concealedKong', 'exposedKong', 'pung', 'chow'],
    multiWin: false,
    robbingKong: true,
    lastTileBonus: true,
    supplementKong: true,
  },
  requirements: { requireMissingSuit: false },
  scoring: { mode: 'additive', cap: null, minFan: 8, baseScore: 1 },
  fans: [
    {
      id: 'shisanyao',
      name: '十三幺',
      predicate: 'thirteenOrphans',
      value: 88,
      includes: ['quandaibudai', 'menqianqing', 'zimo', 'wuziyise'],
      mutexGroup: 'structure',
    },
    {
      id: 'qingyise',
      name: '清一色',
      predicate: 'allOneSuit',
      value: 24,
      includes: ['hunyise', 'wuziyise', 'duanyaojiu', 'pinghuhe', 'menqianqing'],
    },
    {
      id: 'hunyise',
      name: '混一色',
      predicate: 'mixedOneSuit',
      value: 6,
      includes: ['wuziyise'],
    },
    {
      id: 'wuziyise',
      name: '无字',
      predicate: 'noHonors',
      value: 1,
    },
    {
      id: 'qidui',
      name: '七对',
      predicate: 'sevenPairs',
      value: 24,
      mutexGroup: 'structure',
    },
    {
      id: 'pengpenghe',
      name: '碰碰和',
      predicate: 'allTriplets',
      value: 6,
      mutexGroup: 'structure',
    },
    {
      id: 'pinghuhe',
      name: '平和',
      predicate: 'allSequences',
      value: 2,
      mutexGroup: 'structure',
    },
    {
      id: 'quandaibudai',
      name: '全带幺',
      predicate: 'allWithTerminals',
      value: 4,
    },
    {
      id: 'duanyaojiu',
      name: '断幺',
      predicate: 'allSimples',
      value: 2,
    },
    {
      id: 'sanjieke',
      name: '三色三同顺',
      predicate: 'tripleSequences',
      value: 8,
    },
    {
      id: 'sanjieke-tri',
      name: '三色三同刻',
      predicate: 'tripleTriplets',
      value: 16,
    },
    {
      id: 'menqianqing',
      name: '门前清',
      predicate: 'concealed',
      value: 2,
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
      value: 8,
    },
    {
      id: 'qiangganghu',
      name: '抢杠胡',
      predicate: 'robKong',
      value: 8,
    },
    {
      id: 'gangshangkaihua',
      name: '杠上开花',
      predicate: 'supplementAfterKong',
      value: 8,
    },
  ],
  documentation: {
    summary: '国标演示子集：8 番起胡，高番覆盖低番，无封顶。',
    notes: [
      '清一色（24）自动覆盖混一色（6）、无字（1）、断幺（2）、平和（2）。',
      '七对、碰碰和、平和为结构互斥组。',
      '海底捞月/抢杠胡/杠上开花各 8 番，本身即满足起胡线。',
    ],
  },
};
