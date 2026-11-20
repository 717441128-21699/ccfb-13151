/**
 * 武汉麻将(红中赖子杠简化版):
 * 万筒条 + 中发白,红中为赖子,可硬胡(赖子当自身)。
 */
export const wuhan = {
    id: 'wuhan',
    name: '武汉麻将',
    region: '湖北武汉',
    description: '红中赖子杠玩法:红中为赖子,硬胡(赖子未代牌)加番,屁胡起胡。',
    tiles: { suits: ['m', 'p', 's'], winds: false, dragons: true, flowers: 0 },
    laizi: {
        tiles: [31], // 红中
        allowAsSelf: true,
        canDiscard: false,
        note: '红中为赖子,不可打出;手中无红中时按硬胡计',
    },
    structures: ['standard', 'qidui'],
    fans: [
        { id: 'yinghu', name: '硬胡', score: 1, unit: 'fan', predicate: 'laiziWildNone', description: '赖子未充当其他牌(含手中无赖子)' },
        { id: 'zimo', name: '自摸', score: 1, unit: 'fan', predicate: 'selfDraw' },
        { id: 'pengpenghu', name: '碰碰胡', score: 2, unit: 'fan', predicate: 'allKezi' },
        { id: 'qidui', name: '七对', score: 2, unit: 'fan', predicate: 'qidui' },
        { id: 'qingyise', name: '清一色', score: 3, unit: 'fan', predicate: 'oneSuit' },
        { id: 'gangshanghua', name: '杠上开花', score: 1, unit: 'fan', predicate: 'kongFlower' },
        { id: 'qianggang', name: '抢杠胡', score: 1, unit: 'fan', predicate: 'robbingKong' },
        { id: 'haidilao', name: '海底捞月', score: 1, unit: 'fan', predicate: 'haidilao' },
    ],
    cap: { maxFan: 10 },
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
