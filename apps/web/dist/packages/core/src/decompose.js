import { TILE_COUNT } from "./tiles.js";
function keyOf(sets, pair, laiziAsSelf) {
    const s = sets
        .map((x) => `${x.kind[0]}${x.base}`)
        .sort()
        .join(',');
    return `${s}|p${pair.base}|h${laiziAsSelf}`;
}
/**
 * 把 0..total 张"当作自身"的赖子分配到各赖子牌型上,返回所有 counts 向量。
 * 例如赖子=[中,发]、共 2 张 → (0,0),(1,0),(0,1),(2,0),(1,1),(0,2)。
 */
function selfAssignments(types, total) {
    if (types.length === 0)
        return total === 0 ? [new Uint8Array(TILE_COUNT)] : [];
    const out = [];
    const cur = new Uint8Array(TILE_COUNT);
    const rec = (idx, left) => {
        if (idx === types.length - 1) {
            cur[types[idx]] = left;
            out.push(cur.slice());
            cur[types[idx]] = 0;
            return;
        }
        for (let k = 0; k <= left; k++) {
            cur[types[idx]] = k;
            rec(idx + 1, left - k);
        }
        cur[types[idx]] = 0;
    };
    for (let s = 0; s <= total; s++)
        rec(0, s);
    return out;
}
/**
 * 穷举标准结构(4 面子 + 1 对子)的全部拆法。
 * @param counts   非赖子牌的 counts(34 维)
 * @param laizi    手中赖子物理张数
 * @param laiziTypes 赖子牌型(如 [红中]);空数组表示通用野牌
 * @param allowAsSelf 是否允许赖子当作自身使用(硬胡需要)
 *
 * 算法:先枚举"赖子当自身"的分配,再选定对子,然后递归剥离面子
 * (每张真牌可由真牌组成面子,也可用赖子补齐),最后剩余赖子自成面子。
 * 结果按抽象结构去重(同构不同赖子归属只保留一种)。
 */
export function enumerateStandardDecomps(counts, laizi, laiziTypes = [], allowAsSelf = true) {
    const out = [];
    const seen = new Set();
    const assigns = laiziTypes.length === 0 || !allowAsSelf
        ? [new Uint8Array(TILE_COUNT)]
        : selfAssignments(laiziTypes, laizi);
    for (const self of assigns) {
        let selfSum = 0;
        for (const v of self)
            selfSum += v;
        if (selfSum > laizi)
            continue;
        const L0 = laizi - selfSum;
        const c = new Int16Array(TILE_COUNT);
        for (let i = 0; i < TILE_COUNT; i++)
            c[i] = counts[i] + self[i];
        for (let t = 0; t < TILE_COUNT; t++) {
            const real = Math.min(2, c[t]);
            const k = 2 - real; // 对子需要的赖子数
            if (k > L0)
                continue;
            c[t] -= real;
            const pair = { kind: 'pair', base: t, laizi: k };
            const acc = [];
            const emit = () => {
                const key = keyOf(acc, pair, selfSum);
                if (!seen.has(key)) {
                    seen.add(key);
                    out.push({ sets: acc.map((s) => ({ ...s })), pair: { ...pair }, laiziAsSelf: selfSum });
                }
            };
            dfsSets(c, L0 - k, acc, emit);
            c[t] += real;
        }
    }
    return out;
}
/** 递归剥离面子:c 中最小非零下标必须被某个以它为起点的面子覆盖,赖子可补齐缺张。 */
function dfsSets(c, L, acc, emit) {
    let i = 0;
    while (i < TILE_COUNT && c[i] === 0)
        i++;
    if (i === TILE_COUNT) {
        if (L === 0)
            emit();
        else
            dfsLaiziOnly(L, acc, emit);
        return;
    }
    // 刻子(i):k 张赖子补齐,use 张真牌
    const maxK = Math.min(2, L);
    for (let k = Math.max(0, 3 - c[i]); k <= maxK; k++) {
        const use = 3 - k;
        if (use > c[i])
            continue;
        c[i] -= use;
        acc.push({ kind: 'kezi', base: i, laizi: k });
        dfsSets(c, L - k, acc, emit);
        acc.pop();
        c[i] += use;
    }
    // 顺子(i, i+1, i+2):缺 m 张用赖子补
    if (i < 27 && i % 9 <= 6) {
        const d1 = c[i + 1] > 0;
        const d2 = c[i + 2] > 0;
        const m = (d1 ? 0 : 1) + (d2 ? 0 : 1);
        if (m <= L) {
            c[i]--;
            if (d1)
                c[i + 1]--;
            if (d2)
                c[i + 2]--;
            acc.push({ kind: 'shunzi', base: i, laizi: m });
            dfsSets(c, L - m, acc, emit);
            acc.pop();
            c[i]++;
            if (d1)
                c[i + 1]++;
            if (d2)
                c[i + 2]++;
        }
    }
}
/** 真牌全部用完后,剩余赖子自成面子(3 的倍数张):刻子任意牌、顺子任意相连三门。 */
function dfsLaiziOnly(L, acc, emit) {
    if (L === 0) {
        emit();
        return;
    }
    if (L % 3 !== 0)
        return;
    for (let t = 0; t < TILE_COUNT; t++) {
        acc.push({ kind: 'kezi', base: t, laizi: 3 });
        dfsLaiziOnly(L - 3, acc, emit);
        acc.pop();
    }
    for (let t = 0; t < 27; t++) {
        if (t % 9 > 6)
            continue;
        acc.push({ kind: 'shunzi', base: t, laizi: 3 });
        dfsLaiziOnly(L - 3, acc, emit);
        acc.pop();
    }
}
