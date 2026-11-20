import { TILE_COUNT, YAO13 } from "./tiles.js";
function selfAssignVecs(types, total) {
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
 * 七对穷举:14 张 = 7 对。奇数张的牌各需 1 赖子配成对,剩余赖子两两自结成对
 * (自结对可以是任意牌型,影响清一色/字一色等判定,全部枚举)。
 */
export function enumerateQidui(counts, laizi, laiziTypes = [], allowAsSelf = true) {
    const assigns = laiziTypes.length === 0 || !allowAsSelf
        ? [new Uint8Array(TILE_COUNT)]
        : selfAssignVecs(laiziTypes, laizi);
    const out = [];
    const seen = new Set();
    for (const self of assigns) {
        let selfSum = 0;
        for (const v of self)
            selfSum += v;
        if (selfSum > laizi)
            continue;
        const L = laizi - selfSum;
        const c = new Uint8Array(TILE_COUNT);
        for (let i = 0; i < TILE_COUNT; i++)
            c[i] = counts[i] + self[i];
        const base = [];
        let oddNeed = 0;
        for (let t = 0; t < TILE_COUNT; t++) {
            const pairs = (c[t] / 2) | 0;
            for (let p = 0; p < pairs; p++)
                base.push({ tile: t, laizi: 0 });
            if (c[t] % 2 === 1) {
                oddNeed++;
                base.push({ tile: t, laizi: 1 });
            }
        }
        if (oddNeed > L)
            continue;
        const rest = L - oddNeed;
        if (rest % 2 !== 0)
            continue;
        const laiziPairs = rest / 2;
        // 剩余赖子两两成对,每对可为任意牌型(非降序列举避免排列重复)
        const extra = [];
        const recPairs = (start, left) => {
            if (left === 0) {
                const pairs = [...base, ...extra];
                const key = pairs.map((p) => p.tile).sort((a, b) => a - b).join(',') + `|h${selfSum}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    out.push({ pairs: pairs.map((p) => ({ ...p })), laiziAsSelf: selfSum });
                }
                return;
            }
            for (let t = start; t < TILE_COUNT; t++) {
                extra.push({ tile: t, laizi: 2 });
                recPairs(t, left - 1);
                extra.pop();
            }
        };
        recPairs(0, laiziPairs);
    }
    return out;
}
/**
 * 十三幺穷举:13 种幺九牌各一张 + 其中一种成对。
 * 枚举对子落在哪种幺九牌上,缺张由赖子补齐。
 */
export function enumerateShisanyao(counts, laizi, laiziTypes = [], allowAsSelf = true) {
    const assigns = laiziTypes.length === 0 || !allowAsSelf
        ? [new Uint8Array(TILE_COUNT)]
        : selfAssignVecs(laiziTypes, laizi);
    const out = [];
    const seen = new Set();
    for (const self of assigns) {
        let selfSum = 0;
        for (const v of self)
            selfSum += v;
        if (selfSum > laizi)
            continue;
        const L = laizi - selfSum;
        const c = new Uint8Array(TILE_COUNT);
        for (let i = 0; i < TILE_COUNT; i++)
            c[i] = counts[i] + self[i];
        let nonYao = 0;
        for (let t = 0; t < TILE_COUNT; t++)
            if (!YAO13.includes(t))
                nonYao += c[t];
        if (nonYao > 0)
            continue;
        for (const pairTile of YAO13) {
            let need = 0;
            for (const u of YAO13) {
                const req = u === pairTile ? 2 : 1;
                if (c[u] < req)
                    need += req - c[u];
            }
            if (need !== L)
                continue;
            const key = `${pairTile}|h${selfSum}`;
            if (!seen.has(key)) {
                seen.add(key);
                out.push({ pairTile, laiziAsSelf: selfSum });
            }
        }
    }
    return out;
}
