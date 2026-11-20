/**
 * 四川麻将(血战到底):只有万筒条 108 张,必须缺一门才能胡,
 * 一炮多响,自摸加番,4 番封顶。
 */
export const sichuan = {
    id: 'sichuan',
    name: '四川血战到底',
    region: '四川',
    description: '定缺玩法:胡牌时必须缺一门花色;一家胡牌后其余家继续打(血战)。',
    tiles: { suits: ['m', 'p', 's'], winds: false, dragons: false, flowers: 0 },
    laizi: null,
    structures: ['standard', 'qidui'],
    winRequirements: [{ predicate: 'missingSuit', params: { count: 1 } }],
    fans: [
        { id: 'zimo', name: '自摸', score: 1, unit: 'fan', predicate: 'selfDraw' },
        { id: 'penghu', name: '大对子', score: 2, unit: 'fan', predicate: 'allKezi', description: '碰碰胡' },
        { id: 'qidui', name: '七对', score: 2, unit: 'fan', predicate: 'qidui' },
        { id: 'qingyise', name: '清一色', score: 4, unit: 'fan', predicate: 'oneSuit' },
        { id: 'gangshanghua', name: '杠上开花', score: 1, unit: 'fan', predicate: 'kongFlower' },
        { id: 'qianggang', name: '抢杠胡', score: 1, unit: 'fan', predicate: 'robbingKong' },
        { id: 'haidilao', name: '海底捞月', score: 1, unit: 'fan', predicate: 'haidilao' },
        { id: 'gen', name: '根', score: 1, unit: 'fan', predicate: 'gangCount', multiplyBy: 'gangs', description: '每有一个杠加 1 番' },
    ],
    cap: { maxFan: 4 },
    scoring: { rankBy: 'fan', formula: { type: 'pow2', base: 1 } },
    priorities: { hu: 4, gang: 3, peng: 2, chi: 1 },
    edge: {
        yiPaoDuoXiang: true,
        qiangGangHu: 'addedKong',
        haidilao: true,
        hediyu: true,
        kongFlower: true,
    },
};
