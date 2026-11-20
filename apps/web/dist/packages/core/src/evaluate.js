import { enumerateStandardDecomps } from "./decompose.js";
import { enumerateQidui, enumerateShisanyao } from "./structures.js";
import { predicates } from "./predicates.js";
import { countsOf, tileName } from "./tiles.js";
function resolvePredicate(pack, name) {
    const fn = predicates[name] ?? pack.customPredicates?.[name];
    if (!fn)
        throw new Error(`规则包 ${pack.id} 引用了不存在的谓词: ${name}`);
    return fn;
}
/** 把一组拆法还原成 counts(赖子按充当的牌计入) */
function expandSets(sets, pair, out) {
    for (const s of sets) {
        if (s.kind === 'shunzi') {
            out[s.base]++;
            out[s.base + 1]++;
            out[s.base + 2]++;
        }
        else {
            out[s.base] += 3;
        }
    }
    if (pair)
        out[pair.base] += 2;
}
function describeSets(sets, pair) {
    const parts = sets.map((s) => {
        const lz = s.laizi > 0 ? `(赖×${s.laizi})` : '';
        if (s.kind === 'shunzi')
            return `顺子${tileName(s.base)}${tileName(s.base + 1)}${tileName(s.base + 2)}${lz}`;
        return `刻子${tileName(s.base)}${lz}`;
    });
    if (pair)
        parts.push(`将${tileName(pair.base)}${pair.laizi > 0 ? `(赖×${pair.laizi})` : ''}`);
    return parts.join(' ');
}
function buildViews(hand, pack, ctx) {
    const laiziTypes = pack.laizi?.tiles ?? [];
    const laiziSet = new Set(laiziTypes);
    const laizi = hand.filter((t) => laiziSet.has(t)).length;
    const counts = countsOf(hand.filter((t) => !laiziSet.has(t)));
    const allowAsSelf = pack.laizi?.allowAsSelf ?? true;
    const meldSets = (ctx.melds ?? []).map((m) => ({
        kind: (m.kind === 'chi' ? 'shunzi' : m.kind === 'gang' || m.kind === 'angang' ? 'gang' : 'kezi'),
        base: m.base,
    }));
    const meldCounts = new Uint8Array(34);
    for (const m of ctx.melds ?? []) {
        if (m.kind === 'chi') {
            meldCounts[m.base]++;
            meldCounts[m.base + 1]++;
            meldCounts[m.base + 2]++;
        }
        else {
            meldCounts[m.base] += m.kind === 'peng' ? 3 : 4;
        }
    }
    const views = [];
    const structures = pack.structures;
    if (structures.includes('standard')) {
        for (const d of enumerateStandardDecomps(counts, laizi, laiziTypes, allowAsSelf)) {
            const full = new Uint8Array(34);
            expandSets(d.sets, d.pair, full);
            for (let i = 0; i < 34; i++)
                full[i] += meldCounts[i];
            views.push({
                structure: 'standard',
                sets: d.sets,
                pair: d.pair,
                meldSets,
                fullCounts: full,
                laiziWild: laizi - d.laiziAsSelf,
                laiziTotal: laizi,
            });
        }
    }
    if (structures.includes('qidui')) {
        for (const q of enumerateQidui(counts, laizi, laiziTypes, allowAsSelf)) {
            const full = new Uint8Array(34);
            for (const p of q.pairs)
                full[p.tile] += 2;
            for (let i = 0; i < 34; i++)
                full[i] += meldCounts[i];
            views.push({
                structure: 'qidui',
                sets: [],
                pair: null,
                qiduiPairs: q.pairs,
                meldSets,
                fullCounts: full,
                laiziWild: laizi - q.laiziAsSelf,
                laiziTotal: laizi,
            });
        }
    }
    if (structures.includes('shisanyao')) {
        for (const s of enumerateShisanyao(counts, laizi, laiziTypes, allowAsSelf)) {
            const full = new Uint8Array(34);
            for (const t of [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33])
                full[t] = 1;
            full[s.pairTile]++;
            for (let i = 0; i < 34; i++)
                full[i] += meldCounts[i];
            views.push({
                structure: 'shisanyao',
                sets: [],
                pair: { kind: 'pair', base: s.pairTile, laizi: 0 },
                shisanyaoPair: s.pairTile,
                meldSets,
                fullCounts: full,
                laiziWild: laizi - s.laiziAsSelf,
                laiziTotal: laizi,
            });
        }
    }
    return views;
}
function viewLabel(v) {
    if (v.structure === 'qidui')
        return `七对: ${v.qiduiPairs.map((p) => tileName(p.tile) + (p.laizi ? `(赖×${p.laizi})` : '')).join(' ')}`;
    if (v.structure === 'shisanyao')
        return `十三幺, 将: ${tileName(v.shisanyaoPair)}`;
    return describeSets(v.sets, v.pair);
}
function evaluateView(v, pack, ctx) {
    // 胡牌前置条件(如四川必须缺门)
    for (const req of pack.winRequirements ?? []) {
        if (!resolvePredicate(pack, req.predicate)(v, ctx, req.params))
            return null;
    }
    let hits = [];
    for (const def of pack.fans) {
        const fn = resolvePredicate(pack, def.predicate);
        if (!fn(v, ctx, def.params))
            continue;
        let score = def.score;
        if (def.multiplyBy === 'flowers') {
            const n = ctx.flowers?.length ?? 0;
            if (n === 0)
                continue;
            score *= n;
        }
        else if (def.multiplyBy === 'gangs') {
            const n = (ctx.melds ?? []).filter((m) => m.kind === 'gang' || m.kind === 'angang').length;
            if (n === 0)
                continue;
            score *= n;
        }
        hits.push({ def, score });
    }
    // 番种包含关系:命中 A 且 A.excludes 含 B → B 不计
    const hitIds = new Set(hits.map((h) => h.def.id));
    for (const h of hits) {
        for (const ex of h.def.excludes ?? [])
            hitIds.delete(ex);
    }
    hits = hits.filter((h) => hitIds.has(h.def.id));
    let totalFan = 0;
    let totalFen = 0;
    for (const h of hits) {
        if (h.def.unit === 'fan')
            totalFan += h.score;
        else
            totalFen += h.score;
    }
    if (pack.scoring.minFenToWin != null && totalFen < pack.scoring.minFenToWin)
        return null;
    let capped = false;
    if (pack.cap?.maxFan != null && totalFan > pack.cap.maxFan) {
        totalFan = pack.cap.maxFan;
        capped = true;
    }
    if (pack.cap?.maxFen != null && totalFen > pack.cap.maxFen) {
        totalFen = pack.cap.maxFen;
        capped = true;
    }
    let payout;
    const f = pack.scoring.formula;
    if (f?.type === 'pow2')
        payout = f.base * 2 ** totalFan;
    else if (f?.type === 'fen')
        payout = totalFen;
    return {
        view: v,
        label: viewLabel(v),
        fans: hits.map((h) => ({ id: h.def.id, name: h.def.name, score: h.score, unit: h.def.unit })),
        totalFan,
        totalFen,
        capped,
        payout,
    };
}
/**
 * 验算一手牌:穷举所有拆法,每种拆法算番,按规则包口径取最大。
 * hand 为胡牌时的全部手牌(通常 14 张,含赖子;花牌、副露走 ctx)。
 */
export function evaluateHand(hand, pack, ctx = {}) {
    const t0 = performance.now();
    const total = hand.length + (ctx.melds ?? []).length * 3;
    if (total % 3 !== 2) {
        return {
            win: false,
            reason: `牌数不对:手牌 ${hand.length} 张 + 副露 ${(ctx.melds ?? []).length} 组,无法构成胡牌`,
            analyses: [],
            elapsedMs: performance.now() - t0,
        };
    }
    const views = buildViews(hand, pack, ctx);
    const analyses = views
        .map((v) => evaluateView(v, pack, ctx))
        .filter((a) => a !== null);
    const rank = (a) => pack.scoring.rankBy === 'fan' ? a.totalFan * 10000 + a.totalFen : a.totalFen * 10000 + a.totalFan;
    analyses.sort((a, b) => rank(b) - rank(a));
    const elapsedMs = performance.now() - t0;
    if (analyses.length === 0) {
        return { win: false, reason: views.length === 0 ? '凑不成任何胡牌结构' : '不满足起胡条件', analyses: [], elapsedMs };
    }
    return { win: true, analyses, best: analyses[0], elapsedMs };
}
