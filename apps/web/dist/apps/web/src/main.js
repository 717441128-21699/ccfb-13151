import { evaluateHand, generateRuleDoc, validateRulePack, parseTile, parseTiles, tileName, tileCode, suitOf, } from "../../../packages/core/src/index.js";
import { builtinPacks } from "../../../packages/rulepacks/src/index.js";
// ---------- 规则包注册表(内置 + 浏览器本地自定义) ----------
const packs = new Map();
for (const p of builtinPacks)
    packs.set(p.id, p);
try {
    const custom = JSON.parse(localStorage.getItem('mahjong.customPacks') ?? '[]');
    for (const p of custom)
        packs.set(p.id, p);
}
catch {
    /* 本地数据损坏则忽略 */
}
function persistCustom() {
    const customs = [...packs.values()].filter((p) => !builtinPacks.some((b) => b.id === p.id && b === p));
    try {
        localStorage.setItem('mahjong.customPacks', JSON.stringify(customs));
    }
    catch {
        /* 存储不可用时跳过 */
    }
}
const $ = (id) => document.getElementById(id);
// ---------- 页签 ----------
for (const btn of document.querySelectorAll('nav button')) {
    btn.onclick = () => {
        document.querySelectorAll('nav button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        for (const tab of ['play', 'config', 'doc']) {
            $(`tab-${tab}`).classList.toggle('hidden', tab !== btn.dataset.tab);
        }
        if (btn.dataset.tab === 'doc')
            renderDoc();
        if (btn.dataset.tab === 'config')
            loadConfig();
    };
}
// ---------- 玩法选择器 ----------
function fillPackSelect(sel) {
    sel.innerHTML = '';
    for (const p of packs.values()) {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.name;
        sel.appendChild(o);
    }
}
const packSelect = $('packSelect');
const cfgPackSelect = $('cfgPackSelect');
const docPackSelect = $('docPackSelect');
function refreshPackSelects() {
    for (const s of [packSelect, cfgPackSelect, docPackSelect])
        fillPackSelect(s);
}
refreshPackSelects();
const currentPack = () => packs.get(packSelect.value);
// ---------- 牌桌验算 ----------
const hand = [];
function packTiles(pack) {
    const tiles = [];
    const base = { m: 0, p: 9, s: 18 };
    for (const s of pack.tiles.suits)
        for (let r = 0; r < 9; r++)
            tiles.push(base[s] + r);
    if (pack.tiles.winds)
        for (let t = 27; t <= 30; t++)
            tiles.push(t);
    if (pack.tiles.dragons)
        for (let t = 31; t <= 33; t++)
            tiles.push(t);
    return tiles;
}
function tileEl(t, cls, onClick) {
    const el = document.createElement('span');
    const suit = suitOf(t);
    el.className = `tile ${cls} ${suit >= 0 ? `s${suit}` : 'honor'}${currentPack().laizi?.tiles.includes(t) ? ' laizi' : ''}`;
    el.textContent = tileName(t);
    el.title = tileCode(t);
    el.onclick = onClick;
    return el;
}
function renderPalette() {
    const pal = $('palette');
    pal.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'tiles';
    for (const t of packTiles(currentPack())) {
        row.appendChild(tileEl(t, '', () => {
            if (hand.filter((x) => x === t).length >= 4)
                return;
            if (hand.length >= 14)
                return;
            hand.push(t);
            renderHand();
        }));
    }
    pal.appendChild(row);
}
function renderHand() {
    const view = $('handView');
    view.innerHTML = '';
    hand.forEach((t, i) => {
        view.appendChild(tileEl(t, 'hand', () => {
            hand.splice(i, 1);
            renderHand();
        }));
    });
    $('handCount').textContent = `${hand.length} 张`;
}
function readContext() {
    const ctx = {
        isZimo: $('ctxZimo').checked,
        isRobKong: $('ctxRobKong').checked,
        isLastWallTile: $('ctxLastWall').checked,
        isLastDiscard: $('ctxLastDiscard').checked,
        isKongFlower: $('ctxKongFlower').checked,
        isTianHu: $('ctxTian').checked,
        isDiHu: $('ctxDi').checked,
    };
    const sw = $('ctxSeatWind').value;
    const pw = $('ctxPrevWind').value;
    if (sw)
        ctx.seatWind = parseTile(sw);
    if (pw)
        ctx.prevalentWind = parseTile(pw);
    const fl = $('ctxFlowers').value.trim();
    if (fl)
        ctx.flowers = parseTiles(fl);
    const meldsRaw = $('ctxMelds').value.trim();
    if (meldsRaw) {
        ctx.melds = meldsRaw.split(/[\s,]+/).map((s) => {
            const m = /^(chi|peng|gang|angang):(.+)$/.exec(s);
            if (!m)
                throw new Error(`副露格式错误: ${s}(应如 peng:5m)`);
            return { kind: m[1], base: parseTile(m[2]) };
        });
    }
    return ctx;
}
function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
$('evalBtn').onclick = () => {
    const pack = currentPack();
    let ctx;
    try {
        ctx = readContext();
    }
    catch (e) {
        $('resultSummary').innerHTML = `<span class="bad">${esc(e.message)}</span>`;
        return;
    }
    const r = evaluateHand([...hand], pack, ctx);
    $('elapsed').textContent = `穷举+算番耗时 ${r.elapsedMs.toFixed(3)} ms,共 ${r.analyses.length} 种拆法`;
    if (!r.win) {
        $('resultSummary').innerHTML = `<span class="bad">不能胡</span> <span class="dim">${esc(r.reason ?? '')}</span>`;
        $('resultFans').innerHTML = '';
        $('resultAll').innerHTML = '';
        return;
    }
    const best = r.best;
    const unit = pack.scoring.rankBy === 'fan' ? `${best.totalFan} 番` : `${best.totalFen} 分`;
    $('resultSummary').innerHTML =
        `<span class="ok">能胡:${unit}</span>${best.capped ? ' <span class="bad">(已封顶)</span>' : ''}` +
            (best.payout != null ? ` <span class="dim">结算 ${best.payout}</span>` : '') +
            `<br>最佳拆法:${esc(best.label)}`;
    $('resultFans').innerHTML =
        '<table style="margin-top:8px"><tr><th>番种</th><th>分值</th></tr>' +
            best.fans
                .map((f) => `<tr><td>${esc(f.name)}</td><td>${f.score} ${f.unit === 'fan' ? '番' : '分'}</td></tr>`)
                .join('') +
            '</table>';
    $('resultAll').innerHTML =
        '<h2 style="margin-top:12px">全部拆法(按番从大到小)</h2><table><tr><th>#</th><th>拆法</th><th>番/分</th><th>番种</th></tr>' +
            r.analyses
                .map((a, i) => `<tr><td>${i + 1}</td><td>${esc(a.label)}</td><td>${a.totalFan} 番 / ${a.totalFen} 分</td>` +
                `<td>${a.fans.map((f) => esc(f.name)).join('、') || '—'}</td></tr>`)
                .join('') +
            '</table>';
};
packSelect.onchange = () => {
    hand.length = 0;
    $('packDesc').textContent = currentPack().description ?? '';
    renderPalette();
    renderHand();
};
// ---------- 规则配置 ----------
function loadConfig() {
    if (cfgPackSelect.value !== packSelect.value)
        cfgPackSelect.value = packSelect.value;
    const pack = packs.get(cfgPackSelect.value);
    const { customPredicates: _drop, ...json } = pack;
    $('cfgJson').value = JSON.stringify(json, null, 2);
    $('cfgErrors').textContent = '';
}
cfgPackSelect.onchange = loadConfig;
$('cfgValidate').onclick = () => {
    try {
        const pack = JSON.parse($('cfgJson').value);
        const errors = validateRulePack(pack);
        $('cfgErrors').textContent = errors.length
            ? errors.map((e) => `✗ ${e.path}: ${e.message}`).join('\n')
            : '✓ 配置合法';
    }
    catch (e) {
        $('cfgErrors').textContent = `JSON 解析失败: ${e.message}`;
    }
};
$('cfgApply').onclick = () => {
    try {
        const pack = JSON.parse($('cfgJson').value);
        const errors = validateRulePack(pack);
        if (errors.length) {
            $('cfgErrors').textContent = errors.map((e) => `✗ ${e.path}: ${e.message}`).join('\n');
            return;
        }
        packs.set(pack.id, pack);
        persistCustom();
        refreshPackSelects();
        packSelect.value = pack.id;
        $('packDesc').textContent = currentPack().description ?? '';
        renderPalette();
        $('cfgErrors').textContent = '✓ 已应用,验算与规则说明已切换到新配置';
    }
    catch (e) {
        $('cfgErrors').textContent = `JSON 解析失败: ${e.message}`;
    }
};
$('cfgReset').onclick = () => {
    const id = cfgPackSelect.value;
    const builtin = builtinPacks.find((p) => p.id === id);
    if (builtin)
        packs.set(id, builtin);
    else
        packs.delete(id);
    persistCustom();
    refreshPackSelects();
    loadConfig();
    $('cfgErrors').textContent = '✓ 已恢复';
};
// ---------- 规则说明 ----------
function miniMarkdown(md) {
    const lines = md.split('\n');
    const out = [];
    let inTable = false;
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    for (const line of lines) {
        if (line.startsWith('|')) {
            const cells = line.split('|').slice(1, -1).map((c) => c.trim());
            if (cells.every((c) => /^-+$/.test(c)))
                continue;
            if (!inTable) {
                out.push('<table>');
                inTable = true;
            }
            out.push(`<tr>${cells.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`);
            continue;
        }
        if (inTable) {
            out.push('</table>');
            inTable = false;
        }
        if (line.startsWith('## '))
            out.push(`<h2>${inline(line.slice(3))}</h2>`);
        else if (line.startsWith('# '))
            out.push(`<h1>${inline(line.slice(2))}</h1>`);
        else if (line.startsWith('> '))
            out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
        else if (line.startsWith('- '))
            out.push(`<div>• ${inline(line.slice(2))}</div>`);
        else if (line.trim() === '')
            out.push('');
        else
            out.push(`<p>${inline(line)}</p>`);
    }
    if (inTable)
        out.push('</table>');
    return out.join('\n');
}
let currentDoc = '';
function renderDoc() {
    if (docPackSelect.value !== packSelect.value)
        docPackSelect.value = packSelect.value;
    const pack = packs.get(docPackSelect.value);
    currentDoc = generateRuleDoc(pack);
    $('docView').innerHTML = miniMarkdown(currentDoc);
}
docPackSelect.onchange = renderDoc;
$('docCopy').onclick = () => {
    navigator.clipboard
        .writeText(currentDoc)
        .then(() => {
        $('docCopy').textContent = '已复制 ✓';
        setTimeout(() => ($('docCopy').textContent = '复制 Markdown'), 1500);
    })
        .catch(() => {
        $('docCopy').textContent = '复制失败,请手动选择';
    });
};
// ---------- 初始化 ----------
$('packDesc').textContent = currentPack().description ?? '';
renderPalette();
renderHand();
