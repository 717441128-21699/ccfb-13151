export const TILE_COUNT = 34;
export const FLOWER_BASE = 34;
export const FLOWER_NAMES = ['春', '夏', '秋', '冬', '梅', '兰', '竹', '菊'];
const CN_NUM = '一二三四五六七八九';
const SUIT_NAMES = ['万', '筒', '条'];
const HONOR_NAMES = ['东', '南', '西', '北', '中', '发', '白'];
export const WINDS = [27, 28, 29, 30];
export const DRAGONS = [31, 32, 33];
/** 十三幺所需的 13 种幺九牌 */
export const YAO13 = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
export const suitOf = (t) => (t < 27 ? (t / 9) | 0 : -1); // 0万 1筒 2条,-1 字牌
export const rankOf = (t) => (t < 27 ? (t % 9) + 1 : 0); // 1-9,字牌为 0
export const isHonor = (t) => t >= 27 && t < TILE_COUNT;
export const isWind = (t) => t >= 27 && t <= 30;
export const isDragon = (t) => t >= 31 && t <= 33;
export const isTerminal = (t) => t < 27 && (t % 9 === 0 || t % 9 === 8);
export const isYao = (t) => isTerminal(t) || isHonor(t);
export const isFlower = (t) => t >= FLOWER_BASE;
export function tileName(t) {
    if (isFlower(t))
        return `花·${FLOWER_NAMES[t - FLOWER_BASE]}`;
    if (isHonor(t))
        return HONOR_NAMES[t - 27];
    return `${CN_NUM[t % 9]}${SUIT_NAMES[suitOf(t)]}`;
}
/** 紧凑编码:1m..9m / 1p..9p / 1s..9s / 1z..7z(东南西北中发白) / f1..f8(花) */
export function tileCode(t) {
    if (isFlower(t))
        return `f${t - FLOWER_BASE + 1}`;
    if (isHonor(t))
        return `${t - 26}z`;
    return `${(t % 9) + 1}${'mps'[suitOf(t)]}`;
}
export function parseTile(s) {
    const m = /^([1-9])([mps])$/.exec(s);
    if (m)
        return 'mps'.indexOf(m[2]) * 9 + Number(m[1]) - 1;
    const z = /^([1-7])z$/.exec(s);
    if (z)
        return 26 + Number(z[1]);
    const f = /^f([1-8])$/.exec(s);
    if (f)
        return FLOWER_BASE + Number(f[1]) - 1;
    const cn = HONOR_NAMES.indexOf(s);
    if (cn >= 0)
        return 27 + cn;
    for (let suit = 0; suit < 3; suit++) {
        const idx = CN_NUM.indexOf(s[0]);
        if (idx >= 0 && s[1] === SUIT_NAMES[suit])
            return suit * 9 + idx;
    }
    throw new Error(`无法识别的牌: ${s}`);
}
/** 解析空格/逗号分隔的牌串,如 "1m 2m 3m 5z" */
export function parseTiles(str) {
    return str
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(parseTile);
}
export function countsOf(tiles) {
    const c = new Uint8Array(TILE_COUNT);
    for (const t of tiles) {
        if (t >= TILE_COUNT)
            throw new Error(`花牌不计入手牌 counts: ${tileCode(t)}`);
        c[t]++;
    }
    return c;
}
export function tilesFromCounts(c) {
    const out = [];
    for (let t = 0; t < TILE_COUNT; t++)
        for (let i = 0; i < c[t]; i++)
            out.push(t);
    return out;
}
