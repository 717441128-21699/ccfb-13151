import { TILE_COUNT, isDragon, isHonor, isTerminal, isWind, isYao, suitOf, } from "./tiles.js";
const allSets = (v) => [
    ...v.sets.map((s) => ({ kind: s.kind, base: s.base })),
    ...v.meldSets.map((m) => ({ kind: m.kind === 'gang' ? 'kezi' : m.kind, base: m.base })),
];
function* allTiles(v) {
    for (let t = 0; t < TILE_COUNT; t++)
        for (let i = 0; i < v.fullCounts[t]; i++)
            yield t;
}
/** 内置谓词库:规则包按名字引用,策划在配置界面下拉选用 */
export const predicates = {
    always: () => true,
    // ---- 结构类 ----
    standard: (v) => v.structure === 'standard',
    qidui: (v) => v.structure === 'qidui',
    shisanyao: (v) => v.structure === 'shisanyao',
    /** 碰碰胡:全部面子为刻子(杠算刻子) */
    allKezi: (v) => v.structure === 'standard' && allSets(v).every((s) => s.kind === 'kezi'),
    /** 平胡:全部面子为顺子;params.pairNotIn: 'dragons'|'winds'|'honors' 限制将牌 */
    allShunzi: (v, _c, p) => {
        if (v.structure !== 'standard')
            return false;
        if (!allSets(v).every((s) => s.kind === 'shunzi'))
            return false;
        const ban = p?.pairNotIn ?? 'none';
        const b = v.pair.base;
        if (ban === 'dragons')
            return !isDragon(b);
        if (ban === 'winds')
            return !isWind(b);
        if (ban === 'honors')
            return !isHonor(b);
        return true;
    },
    /** 清一色:只有一种花色,无字牌 */
    oneSuit: (v) => {
        const suits = new Set();
        for (const t of allTiles(v)) {
            if (isHonor(t))
                return false;
            suits.add(suitOf(t));
        }
        return suits.size === 1;
    },
    /** 混一色:一种花色 + 字牌;params.requireHonor 默认 true */
    mixedOneSuit: (v, _c, p) => {
        const suits = new Set();
        let honor = false;
        for (const t of allTiles(v)) {
            if (isHonor(t))
                honor = true;
            else
                suits.add(suitOf(t));
        }
        if (suits.size !== 1)
            return false;
        return p?.requireHonor ?? true ? honor : true;
    },
    /** 字一色:全是字牌 */
    allHonors: (v) => {
        for (const t of allTiles(v))
            if (!isHonor(t))
                return false;
        return true;
    },
    /** 无字:没有字牌 */
    noHonors: (v) => {
        for (const t of allTiles(v))
            if (isHonor(t))
                return false;
        return true;
    },
    /** 断幺:没有幺九牌(无 1/9/字) */
    noYao: (v) => {
        for (const t of allTiles(v))
            if (isYao(t))
                return false;
        return true;
    },
    /** 全带幺:每个面子和对子都含幺九牌 */
    quanDaiYao: (v) => {
        if (v.structure !== 'standard')
            return false;
        const hasYao = (kind, base) => {
            if (kind === 'shunzi')
                return base % 9 === 0 || base % 9 === 6; // 123 或 789
            return isYao(base);
        };
        if (!allSets(v).every((s) => hasYao(s.kind, s.base)))
            return false;
        return isYao(v.pair.base);
    },
    /** 混幺九:碰碰胡且全是幺九,同时含老头牌与字牌 */
    hunYaoJiu: (v) => {
        if (!predicates.allKezi(v, {}))
            return false;
        let terminal = false;
        let honor = false;
        for (const t of allTiles(v)) {
            if (!isYao(t))
                return false;
            if (isHonor(t))
                honor = true;
            else
                terminal = true;
        }
        return terminal && honor;
    },
    /** 清幺九:全是老头牌(1/9),无字 */
    allTerminals: (v) => {
        for (const t of allTiles(v))
            if (!isTerminal(t))
                return false;
        return true;
    },
    /** 箭刻:params.count 默认 1 */
    dragonPung: (v, _c, p) => {
        const need = p?.count ?? 1;
        let n = v.meldSets.filter((m) => m.kind !== 'shunzi' && isDragon(m.base)).length;
        n += v.sets.filter((s) => s.kind === 'kezi' && isDragon(s.base)).length;
        return n >= need;
    },
    /** 箭牌作将 */
    dragonPair: (v) => v.pair !== null && isDragon(v.pair.base),
    /** 风刻:params.wind = 'seat'|'prevalent'|'any' */
    windPung: (v, ctx, p) => {
        const which = p?.wind ?? 'any';
        const keziBases = [
            ...v.sets.filter((s) => s.kind === 'kezi').map((s) => s.base),
            ...v.meldSets.filter((m) => m.kind !== 'shunzi').map((m) => m.base),
        ];
        const match = (t) => {
            if (!isWind(t))
                return false;
            if (which === 'seat')
                return t === ctx.seatWind;
            if (which === 'prevalent')
                return t === ctx.prevalentWind;
            return true;
        };
        return keziBases.some(match);
    },
    /** 风牌作将 */
    windPair: (v) => v.pair !== null && isWind(v.pair.base),
    /** 门清:无副露 */
    menqing: (v, ctx) => (ctx.melds ?? []).length === 0,
    // ---- 行牌时机类(边角规则) ----
    selfDraw: (_v, c) => !!c.isZimo,
    discardWin: (_v, c) => !c.isZimo && !c.isRobKong,
    robbingKong: (_v, c) => !!c.isRobKong,
    haidilao: (_v, c) => !!c.isZimo && !!c.isLastWallTile, // 海底捞月
    hediyu: (_v, c) => !c.isZimo && !!c.isLastDiscard, // 河底捞鱼
    kongFlower: (_v, c) => !!c.isKongFlower, // 杠上开花
    tianHu: (_v, c) => !!c.isTianHu,
    diHu: (_v, c) => !!c.isDiHu,
    /** 杠数达到 params.count(默认 1) */
    gangCount: (_v, c, p) => {
        const need = p?.count ?? 1;
        return (c.melds ?? []).filter((m) => m.kind === 'gang' || m.kind === 'angang').length >= need;
    },
    /** 有花牌(配合 multiplyBy: 'flowers' 按张计分) */
    hasFlowers: (_v, c) => (c.flowers ?? []).length > 0,
    /** 缺门:有 params.count(默认 1) 门花色一张都没有(四川定缺) */
    missingSuit: (v, _c, p) => {
        const need = p?.count ?? 1;
        const present = new Set();
        for (const t of allTiles(v))
            if (!isHonor(t))
                present.add(suitOf(t));
        return 3 - present.size >= need;
    },
    /** 所有数牌都在 params.ranks 内(长沙将将胡:2/5/8) */
    ranksOnly: (v, _c, p) => {
        const ranks = new Set(p?.ranks ?? []);
        for (const t of allTiles(v)) {
            if (isHonor(t))
                return false;
            if (!ranks.has((t % 9) + 1))
                return false;
        }
        return true;
    },
    /** 硬胡:赖子没有当野牌用(手中无赖子也算硬) */
    laiziWildNone: (v) => v.laiziWild === 0,
    /** 软胡:有赖子当野牌用 */
    laiziWildAny: (v) => v.laiziWild > 0,
    /** 手中摸到过赖子 */
    hasLaizi: (v) => v.laiziTotal > 0,
};
