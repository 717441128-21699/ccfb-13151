import type { RulePack } from '../../core/src/rule.ts';

/**
 * 广东麻将(鸡平胡):番数累加、爆胡封顶,自摸加番,允许一炮多响。
 */
export const guangdong: RulePack = {
  id: 'guangdong',
  name: '广东鸡平胡',
  region: '广东',
  description: '鸡胡起步,番种累加,5 番爆胡封顶。',
  tiles: { suits: ['m', 'p', 's'], winds: true, dragons: true, flowers: 0 },
  laizi: null,
  structures: ['standard', 'qidui'],
  fans: [
    { id: 'pinghu', name: '平胡', score: 1, unit: 'fan', predicate: 'allShunzi', params: { pairNotIn: 'none' } },
    { id: 'penghu', name: '碰碰胡', score: 2, unit: 'fan', predicate: 'allKezi' },
    { id: 'hunyise', name: '混一色', score: 2, unit: 'fan', predicate: 'mixedOneSuit' },
    { id: 'qidui', name: '七对', score: 3, unit: 'fan', predicate: 'qidui' },
    { id: 'qingyise', name: '清一色', score: 4, unit: 'fan', predicate: 'oneSuit' },
    { id: 'ziyise', name: '字一色', score: 5, unit: 'fan', predicate: 'allHonors', excludes: ['penghu'] },
    { id: 'zimo', name: '自摸', score: 1, unit: 'fan', predicate: 'selfDraw' },
    { id: 'gangshanghua', name: '杠上开花', score: 1, unit: 'fan', predicate: 'kongFlower' },
    { id: 'qianggang', name: '抢杠胡', score: 1, unit: 'fan', predicate: 'robbingKong' },
    { id: 'haidilao', name: '海底捞月', score: 1, unit: 'fan', predicate: 'haidilao' },
  ],
  cap: { maxFan: 5 },
  scoring: { rankBy: 'fan', formula: { type: 'pow2', base: 1 } },
  priorities: { hu: 4, gang: 3, peng: 2, chi: 1 },
  edge: {
    yiPaoDuoXiang: true,
    qiangGangHu: 'addedKong',
    haidilao: true,
    hediyu: false,
    kongFlower: true,
  },
};
