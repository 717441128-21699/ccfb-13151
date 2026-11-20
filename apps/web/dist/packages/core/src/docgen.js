import { tileName } from "./tiles.js";
import { predicates } from "./predicates.js";
/** 校验一份规则包配置(策划在配置界面保存时调用) */
export function validateRulePack(pack) {
    const errors = [];
    const err = (path, message) => {
        errors.push({ path, message });
    };
    if (!pack.id)
        err('id', '缺少规则包 id');
    if (!pack.name)
        err('name', '缺少玩法名称');
    if (!Array.isArray(pack.tiles?.suits) || pack.tiles.suits.length === 0)
        err('tiles.suits', '至少启用一门花色');
    if (!Array.isArray(pack.structures) || pack.structures.length === 0)
        err('structures', '至少启用一种胡牌结构');
    for (const s of pack.structures ?? []) {
        if (!['standard', 'qidui', 'shisanyao'].includes(s))
            err('structures', `未知胡牌结构: ${s}`);
    }
    const fanIds = new Set();
    for (const fan of pack.fans ?? []) {
        if (!fan.id)
            err('fans', '存在缺少 id 的番种');
        if (fanIds.has(fan.id))
            err(`fans.${fan.id}`, `番种 id 重复: ${fan.id}`);
        fanIds.add(fan.id);
        if (!predicates[fan.predicate] && !pack.customPredicates?.[fan.predicate])
            err(`fans.${fan.id}`, `未知谓词: ${fan.predicate}`);
        if (typeof fan.score !== 'number' || fan.score < 0)
            err(`fans.${fan.id}`, `番种分值非法: ${fan.score}`);
    }
    for (const fan of pack.fans ?? []) {
        for (const ex of fan.excludes ?? []) {
            if (!fanIds.has(ex))
                err(`fans.${fan.id}.excludes`, `不计关系指向不存在的番种: ${ex}`);
        }
    }
    for (const req of pack.winRequirements ?? []) {
        if (!predicates[req.predicate] && !pack.customPredicates?.[req.predicate])
            err('winRequirements', `未知谓词: ${req.predicate}`);
    }
    if (pack.laizi) {
        for (const t of pack.laizi.tiles) {
            if (t < 0 || t > 33)
                err('laizi.tiles', `赖子牌型越界: ${t}`);
        }
        if (pack.laizi.tiles.length === 0)
            err('laizi.tiles', '赖子配置为空');
    }
    if (pack.cap?.maxFan != null && pack.cap.maxFan <= 0)
        err('cap.maxFan', '封顶番数必须为正');
    if (pack.cap?.maxFen != null && pack.cap.maxFen <= 0)
        err('cap.maxFen', '封顶分数必须为正');
    return errors;
}
/** 生成给运营看的规则说明(Markdown) */
export function generateRuleDoc(pack) {
    const L = [];
    L.push(`# ${pack.name} 规则说明`);
    if (pack.region)
        L.push(`\n> 地区:${pack.region}`);
    if (pack.description)
        L.push(`\n${pack.description}`);
    L.push(`\n## 一、牌张构成`);
    const suitNames = { m: '万', p: '筒', s: '条' };
    const parts = pack.tiles.suits.map((s) => `${suitNames[s]}子`);
    if (pack.tiles.winds)
        parts.push('风牌(东南西北)');
    if (pack.tiles.dragons)
        parts.push('箭牌(中发白)');
    if (pack.tiles.flowers > 0)
        parts.push(`花牌 ${pack.tiles.flowers} 张`);
    L.push(`- 使用:${parts.join('、')},数牌各四张`);
    const tileTotal = pack.tiles.suits.length * 9 * 4 +
        (pack.tiles.winds ? 16 : 0) +
        (pack.tiles.dragons ? 12 : 0) +
        pack.tiles.flowers;
    L.push(`- 牌墙共 ${tileTotal} 张`);
    if (pack.laizi) {
        L.push(`\n## 二、赖子`);
        L.push(`- 赖子牌:${pack.laizi.tiles.map(tileName).join('、')}`);
        L.push(`- 赖子可充当任意牌;${pack.laizi.allowAsSelf ? '可以' : '不可以'}当作自身使用(硬胡)`);
        L.push(`- ${pack.laizi.canDiscard ? '可以打出' : '不可打出'}`);
        if (pack.laizi.note)
            L.push(`- ${pack.laizi.note}`);
    }
    L.push(`\n## 三、胡牌牌型`);
    const structNames = {
        standard: '标准型(4 面子 + 1 对将)',
        qidui: '七对',
        shisanyao: '十三幺',
    };
    for (const s of pack.structures)
        L.push(`- ${structNames[s]}`);
    for (const req of pack.winRequirements ?? []) {
        L.push(`- 胡牌前置条件:${req.predicate}${req.params ? ` ${JSON.stringify(req.params)}` : ''}`);
    }
    L.push(`\n## 四、番种表`);
    L.push(`| 番种 | ${pack.scoring.rankBy === 'fan' ? '番数' : '分数'} | 不计 | 说明 |`);
    L.push(`| --- | --- | --- | --- |`);
    const byId = new Map(pack.fans.map((f) => [f.id, f]));
    for (const fan of pack.fans) {
        const ex = (fan.excludes ?? []).map((e) => byId.get(e)?.name ?? e).join('、') || '—';
        L.push(`| ${fan.name} | ${fan.score}${fan.unit === 'fan' ? ' 番' : ' 分'} | ${ex} | ${fan.description ?? ''} |`);
    }
    L.push(`\n## 五、封顶与计分`);
    if (pack.cap?.maxFan != null)
        L.push(`- 封顶:${pack.cap.maxFan} 番`);
    if (pack.cap?.maxFen != null)
        L.push(`- 封顶:${pack.cap.maxFen} 分`);
    if (!pack.cap?.maxFan && !pack.cap?.maxFen)
        L.push(`- 不封顶`);
    if (pack.scoring.minFenToWin != null)
        L.push(`- 起胡:${pack.scoring.minFenToWin} 分`);
    const f = pack.scoring.formula;
    if (f?.type === 'pow2')
        L.push(`- 计分:底 ${f.base} × 2^总番数`);
    else if (f?.type === 'fen')
        L.push(`- 计分:按总分结算`);
    L.push(`\n## 六、吃碰杠优先级`);
    const prio = Object.entries(pack.priorities).sort((a, b) => b[1] - a[1]);
    const prioNames = { hu: '胡', gang: '杠', peng: '碰', chi: '吃' };
    L.push(`- ${prio.map(([k]) => prioNames[k]).join(' > ')}`);
    L.push(`\n## 七、边角规则`);
    L.push(`- 一炮多响:${pack.edge.yiPaoDuoXiang ? '允许(多家同胡一张炮牌)' : '不允许(截胡,离炮手最近者胡)'}`);
    const qg = { none: '不允许', addedKong: '仅抢补杠(加杠)', all: '补杠与明杠均可抢' };
    L.push(`- 抢杠胡:${qg[pack.edge.qiangGangHu]}`);
    L.push(`- 海底捞月:${pack.edge.haidilao ? '计' : '不计'}`);
    L.push(`- 河底捞鱼:${pack.edge.hediyu ? '计' : '不计'}`);
    L.push(`- 杠上开花:${pack.edge.kongFlower ? '计' : '不计'}`);
    L.push('');
    return L.join('\n');
}
