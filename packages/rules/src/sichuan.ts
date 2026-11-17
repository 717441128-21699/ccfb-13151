/**
 * 四川血战到底（简化模板，番名与分值按常见线下约定，可由策划在 Web 端改）。
 * 特点：无字牌、必须缺门、赖子默认关闭（部分变种翻牌定赖）、刮风下雨在事件层另计。
 */

import type { RuleSet } from './schema.js';
import { dsl } from './dsl.js';

const c = dsl.call;

export const sichuanRule: RuleSet = {
  id: 'sichuan-xuezhan',
  name: '四川麻将（血战到底）',
  region: '四川',
  version: '1.0.0',
  description:
    '无字牌；必须缺一门才能胡；标准型与七对；支持一炮多响、抢杠胡、海底捞月、杠上开花。',

  tileRange: {
    suits: ['m', 's', 'p'],
    useWinds: false,
    useDragons: false,
  },
  joker: {
    enabled: false,
    determine: 'fixed',
    allowedInSevenPairs: false,
  },
  winPatterns: {
    standard: true,
    sevenPairs: true,
    thirteenOrphans: false,
    minFan: 1,
  },
  fans: [
    {
      id: 'ping-hu',
      name: '平胡',
      value: 1,
      description: '4 个顺子加将，门前或副露均可',
      when: c('and', c('standard'), c('allSequences')),
      excludes: [],
    },
    {
      id: 'dui-dui-hu',
      name: '对对胡',
      value: 2,
      description: '4 个刻子加将',
      when: c('and', c('standard'), c('allTriplets')),
      excludes: ['ping-hu'],
    },
    {
      id: 'qing-yi-se',
      name: '清一色',
      value: 4,
      description: '整手牌只有一种花色',
      when: c('pureOneSuit'),
      excludes: ['dui-dui-hu', 'ping-hu'],
    },
    {
      id: 'qi-dui',
      name: '七对',
      value: 4,
      description: '七个对子胡牌',
      when: c('sevenPairs'),
      excludes: ['ping-hu', 'dui-dui-hu'],
    },
    {
      id: 'long-qi-dui',
      name: '龙七对',
      value: 8,
      description: '七对中含一组四张（豪华）',
      when: c('and', c('sevenPairs'), c('sevenPairsLuxury')),
      excludes: ['qi-dui'],
      limit: true,
    },
    {
      id: 'qing-qi-dui',
      name: '清七对',
      value: 8,
      description: '清一色的七对',
      when: c('and', c('sevenPairs'), c('pureOneSuit')),
      excludes: ['qi-dui', 'qing-yi-se'],
      limit: true,
    },
    {
      id: 'qing-long-qi-dui',
      name: '清龙七对',
      value: 16,
      description: '清一色且含四张的七对',
      when: c('and', c('sevenPairs'), c('pureOneSuit'), c('sevenPairsLuxury')),
      excludes: ['long-qi-dui', 'qing-qi-dui', 'qi-dui', 'qing-yi-se'],
      limit: true,
    },
    {
      id: 'gen-1',
      name: '根（每根 1 番）',
      value: 1,
      description: '手里每有一种 4 张相同的自然牌计 1 番（本模板先按单根建模）',
      when: dsl.cmp('>=', c('fourOfAKindCount'), dsl.lit(1)),
      excludes: [],
    },
    {
      id: 'gang-shang-hua',
      name: '杠上开花',
      value: 1,
      description: '补杠摸牌后自摸胡',
      when: c('afterKong'),
      excludes: [],
    },
    {
      id: 'hai-di',
      name: '海底捞月',
      value: 1,
      description: '牌墙最后一张自摸胡',
      when: c('bottomDraw'),
      excludes: [],
    },
    {
      id: 'qiang-gang',
      name: '抢杠胡',
      value: 1,
      description: '他人加杠时荣胡（事件加番，不排除牌型番）',
      when: c('robKong'),
      excludes: [],
    },
  ],
  scoring: {
    model: { kind: 'fanSum' },
    capFan: null,
    capPoints: 32,
  },
  actionPriority: ['robbingKong', 'win', 'kong', 'pung', 'chow'],
  events: {
    multipleWinnersOnDiscard: true,
    robKong: true,
    robKongTargets: ['added'],
    bottomDrawWin: true,
    bottomDiscardWin: true,
    afterKongWin: true,
    dealerPaymentOnMultiWin: 'each',
  },
  // 缺门约束：出现的花色数必须 <= 2
  globalConstraints: [
    dsl.cmp('<=', c('suitCount'), dsl.lit(2)),
  ],
};
