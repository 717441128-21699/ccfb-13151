import { FLOWER_BASE } from "./tiles.js";
/** 按规则包配置砌牌墙(数牌字牌各四张 + 花牌) */
export function buildWall(pack) {
    const wall = [];
    const suitBase = { m: 0, p: 9, s: 18 };
    const push4 = (t) => {
        for (let i = 0; i < 4; i++)
            wall.push(t);
    };
    for (const s of pack.tiles.suits) {
        for (let r = 0; r < 9; r++)
            push4(suitBase[s] + r);
    }
    if (pack.tiles.winds)
        for (let t = 27; t <= 30; t++)
            push4(t);
    if (pack.tiles.dragons)
        for (let t = 31; t <= 33; t++)
            push4(t);
    for (let f = 0; f < pack.tiles.flowers; f++)
        wall.push(FLOWER_BASE + f);
    return wall;
}
/** 洗牌(传入种子随机源,便于测试复现) */
export function shuffle(wall, rng) {
    const a = [...wall];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
/** 发牌:四家各 13 张,庄家 14 张,剩余为牌墙 */
export function deal(pack, rng) {
    const wall = shuffle(buildWall(pack), rng);
    const hands = [[], [], [], []];
    for (let round = 0; round < 13; round++) {
        for (let p = 0; p < 4; p++)
            hands[p].push(wall.pop());
    }
    hands[0].push(wall.pop()); // 庄家 14 张
    return { hands, wall };
}
/** 简单的种子随机源(测试/演示用) */
export function seededRng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 2 ** 32;
    };
}
