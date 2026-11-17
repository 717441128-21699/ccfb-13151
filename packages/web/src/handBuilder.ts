/** 摆牌桌：点击选牌摆桌，切换胡牌上下文，算番 / 听牌 / 清空 */
import { h, mount } from './dom.ts';
import {
  addTile,
  handToString,
  handTotal,
  removeTile,
  resetHand,
  state,
  subscribe,
  tileLabel,
} from './state.ts';
import { parseHand } from '@mahjong/core';
import { scoreHand } from '@mahjong/rules';
import { listWaits } from '@mahjong/core';
import { renderScoreResult } from './scoreView.ts';

const TILE_GROUPS: Array<{ title: string; tiles: number[] }> = [
  { title: '万', tiles: Array.from({ length: 9 }, (_, i) => i) },
  { title: '条', tiles: Array.from({ length: 9 }, (_, i) => i + 9) },
  { title: '筒', tiles: Array.from({ length: 9 }, (_, i) => i + 18) },
  { title: '字', tiles: Array.from({ length: 7 }, (_, i) => i + 27) },
];

function tileButton(t: number): HTMLElement {
  const used = state.hand.counts[t]!;
  const btn = h(
    'button',
    {
      class: `tile ${used >= 4 ? 'full' : ''}`,
      title: '左键放入 / 右键取出',
      onclick: () => addTile(t),
      oncontextmenu: (e: Event) => {
        e.preventDefault();
        removeTile(t);
      },
    },
    tileLabel(t),
    used > 0 ? h('span', { class: 'badge' }, String(used)) : null,
  );
  return btn;
}

function contextCheckbox(key: keyof typeof state.context, label: string): HTMLElement {
  return h(
    'label',
    { class: 'chk' },
    h('input', {
      type: 'checkbox',
      checked: state.context[key],
      onchange: (e: Event) => {
        state.context[key] = (e.target as HTMLInputElement).checked;
      },
    }),
    label,
  );
}

export function renderHandBuilder(): HTMLElement {
  const output = h('div', { class: 'score-output' });

  const handLine = h('div', { class: 'hand-line' });
  const renderHandLine = (): void => {
    const total = handTotal(state.hand);
    const ok = total % 3 === 2;
    mount(
      handLine,
      h('div', {},
        h('span', { class: 'hand-string' }, handToString(state.hand) || '（空）'),
        h('span', { class: ok ? 'tag ok' : 'tag warn' }, `${total} 张${ok ? '' : '（胡牌需 3n+2 张）'}`),
      ),
    );
  };
  subscribe(renderHandLine);
  renderHandLine();

  const scoreBtn = h(
    'button',
    {
      class: 'primary',
      onclick: () => {
        const hand = parseHand(handToString(state.hand));
        const result = scoreHand({ hand, rule: state.rule, context: state.context });
        mount(output, renderScoreResult(result));
      },
    },
    '算番（能否胡 / 几番 / 最大番拆法）',
  );

  const waitsBtn = h(
    'button',
    {
      onclick: () => {
        const hand = parseHand(handToString(state.hand));
        const waits = listWaits(hand, {
          sevenPairs: state.rule.winPatterns.sevenPairs,
          thirteenOrphans: state.rule.winPatterns.thirteenOrphans,
        });
        mount(
          output,
          h('div', { class: 'result' },
            h('h3', {}, `听牌枚举（${waits.length} 种）`),
            waits.length === 0
              ? h('p', { class: 'muted' }, '当前无听牌')
              : h('div', { class: 'wait-grid' },
                  ...waits.map((w) =>
                    h('div', { class: 'wait-cell' },
                      h('strong', {}, w.tile < 0 ? '赖子' : tileLabel(w.tile)),
                      h('span', { class: 'muted' }, `${w.decompositionCount} 种拆法`),
                    ),
                  ),
                ),
          ),
        );
      },
    },
    '枚举听牌',
  );

  const clearBtn = h('button', { onclick: resetHand }, '清空');

  const tilePanel = h(
    'div',
    { class: 'tile-picker' },
    ...TILE_GROUPS.map((g) =>
      h('div', { class: 'tile-group' },
        h('span', { class: 'group-title' }, g.title),
        ...g.tiles.map(tileButton),
      ),
    ),
    h('div', { class: 'tile-group' },
      h('span', { class: 'group-title' }, '赖子'),
      h(
        'button',
        {
          class: `tile joker ${state.hand.jokers >= 4 ? 'full' : ''}`,
          onclick: () => addTile('joker'),
          oncontextmenu: (e: Event) => {
            e.preventDefault();
            removeTile('joker');
          },
        },
        '赖',
        state.hand.jokers > 0 ? h('span', { class: 'badge' }, String(state.hand.jokers)) : null,
      ),
    ),
  );

  return h(
    'section',
    { class: 'panel' },
    h('div', { class: 'toolbar' }, scoreBtn, waitsBtn, clearBtn),
    h('div', { class: 'toolbar context' },
      contextCheckbox('selfDrawn', '自摸'),
      contextCheckbox('robKong', '抢杠胡'),
      contextCheckbox('afterKong', '杠上开花'),
      contextCheckbox('bottomDraw', '海底捞月'),
      contextCheckbox('bottomDiscard', '河底捞鱼'),
    ),
    tilePanel,
    handLine,
    output,
  );
}
