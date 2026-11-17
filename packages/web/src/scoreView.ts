/** 算番结果渲染：最大番拆法明细 + 全部备选拆法 + 拒绝原因 */
import { h } from './dom.ts';
import { tileLabel } from '@mahjong/core';
import type { ScoreResult, DecompositionScore } from '@mahjong/rules';

function meldLabel(tiles: number[], jokerSlots: number[], type: string): HTMLElement {
  const spans = tiles.map((t, i) =>
    h(
      'span',
      { class: jokerSlots.includes(i) ? 'mini-tile joker-slot' : 'mini-tile' },
      t < 0 ? '赖' : tileLabel(t),
    ),
  );
  const typeName = type === 'pair' ? '将' : type === 'triplet' ? '刻' : '顺';
  return h('span', { class: 'meld' }, h('em', {}, typeName), ...spans);
}

function kindName(kind: string): string {
  return kind === 'standard' ? '标准型' : kind === 'sevenPairs' ? '七对' : '十三幺';
}

function scoreCard(s: DecompositionScore, isBest: boolean): HTMLElement {
  const rows: HTMLElement[] = [];
  if (s.decomposition.kind === 'standard') {
    rows.push(
      h('div', { class: 'melds' },
        ...s.decomposition.melds.map((m) =>
          meldLabel(m.tiles, m.jokerSlots, m.type),
        ),
      ),
    );
  } else if (s.decomposition.kind === 'sevenPairs') {
    rows.push(
      h('div', { class: 'melds' },
        ...s.decomposition.pairs.map((m) =>
          meldLabel(m.tiles, m.jokerSlots, 'pair'),
        ),
      ),
    );
  } else {
    rows.push(
      h('div', { class: 'melds' },
        meldLabel(s.decomposition.tiles, s.decomposition.jokerSlots, 'orphan'),
      ),
    );
  }

  rows.push(
    h('div', { class: 'fan-hits' },
      ...s.hits.map((f) =>
        h('span', { class: `fan-chip ${f.limit ? 'limit' : ''}` },
          `${f.name} +${f.value}${f.limit ? '（役满）' : ''}`),
      ),
    ),
  );
  if (s.excluded.length > 0) {
    rows.push(
      h('div', { class: 'muted small' },
        '被包含排除：' + s.excluded.map((e) => e.fanId).join('、')),
    );
  }

  return h(
    'div',
    { class: `score-card ${isBest ? 'best' : ''}` },
    h('div', { class: 'score-head' },
      h('span', { class: 'kind-badge' }, kindName(s.decomposition.kind)),
      isBest ? h('span', { class: 'best-badge' }, '★ 最大番拆法') : null,
      h('span', { class: 'fan-total' }, `${s.totalFan} 番`),
      h('span', { class: 'points' }, `${s.points} 分${s.capped ? '（封顶）' : ''}`),
      s.meetsMinFan ? null : h('span', { class: 'tag warn' }, '未达起胡番'),
    ),
    ...rows,
  );
}

export function renderScoreResult(result: ScoreResult): HTMLElement {
  if (!result.win) {
    return h(
      'div',
      { class: 'result lose' },
      h('h3', {}, '✗ 不能胡'),
      h('ul', { class: 'reasons' },
        ...result.rejectedReasons.map((r) => h('li', {}, r)),
        result.rejectedReasons.length === 0 ? h('li', {}, '牌面不构成胡牌牌型') : null,
      ),
      result.scores.length > 0
        ? h('details', {},
            h('summary', {}, '查看牌面可胡但被规则拒绝的拆法'),
            ...result.scores.map((s) => scoreCard(s, false)),
          )
        : null,
    );
  }
  return h(
    'div',
    { class: 'result win' },
    h('h3', {}, `✓ 能胡：${result.best!.totalFan} 番 / ${result.best!.points} 分`),
    scoreCard(result.best!, true),
    result.scores.length > 1
      ? h('details', { open: false },
          h('summary', {}, `全部 ${result.scores.length} 种拆番方案（按分值降序）`),
          ...result.scores.map((s, i) => scoreCard(s, i === 0)),
        )
      : null,
    result.rejectedReasons.length > 0
      ? h('details', {},
          h('summary', {}, '被规则拒绝的拆法'),
          h('ul', {}, ...result.rejectedReasons.map((r) => h('li', {}, r))),
        )
      : null,
  );
}
