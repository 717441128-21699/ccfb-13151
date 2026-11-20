import type { RulePack } from '../../core/src/rule.ts';

/**
 * 长沙麻将:万筒条 108 张无字牌,特色番型将将胡(全是 2/5/8)、缺一色。
 */
export const changsha: RulePack = {
  id: 'changsha',
  name: '长沙麻将',
  region: '湖南长沙',
  description: '无字牌,特色:将将胡(全副牌都是 2/5/8)、缺一色。',
  tiles: { suits: ['m', 'p', 's'], winds: false, dragons: false, flowers: 0 },
  laizi: null,
  structures: ['standard', 'qidui'],
  fans: [
    { id: 'jiangjianghu', name: '将将胡', score: 4, unit: 'fan', predicate: 'ranksOnly', params: { ranks: [2, 5, 8] }, description: '全副牌都是 2、5、8' },
    { id: 'qingyise', name: '清一色', score: 3, unit: 'fan', predicate: 'oneSuit', excludes: ['queyise'], description: '不计缺一色' },
    { id: 'penghu', name: '碰碰胡', score: 2, unit: 'fan', predicate: 'allKezi' },
    { id: 'qidui', name: '七对', score: 2, unit: 'fan', predicate: 'qidui' },
    { id: 'queyise', name: '缺一色', score: 1, unit: 'fan', predicate: 'missingSuit', params: { count: 1 } },
    { id: 'zimo', name: '自摸', score: 1, unit: 'fan', predicate: 'selfDraw' },
    { id: 'gangshanghua', name: '杠上开花', score: 1, unit: 'fan', predicate: 'kongFlower' },
    { id: 'qianggang', name: '抢杠胡', score: 1, unit: 'fan', predicate: 'robbingKong' },
    { id: 'haidilao', name: '海底捞月', score: 1, unit: 'fan', predicate: 'haidilao' },
  ],
  cap: {},
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
