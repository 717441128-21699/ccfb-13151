/** 边角事件面板：模拟一炮多响 / 抢杠 / 动作优先级裁决 */
import { h, mount } from './dom.ts';
import { state } from './state.ts';
import { resolveClaims, checkEventBonuses, type ActionClaim, type ActionKind } from '@mahjong/rules';

const ACTIONS: ActionKind[] = ['robbingKong', 'win', 'kong', 'pung', 'chow'];
const ACTION_LABEL: Record<ActionKind, string> = {
  robbingKong: '抢杠胡',
  win: '荣胡',
  kong: '杠',
  pung: '碰',
  chow: '吃',
};

export function renderEventsPanel(): HTMLElement {
  const output = h('div', {});
  const claims: ActionClaim[] = [];
  let seq = 0;

  const rows = h('div', { class: 'claim-rows' });

  const addRow = (preset: ActionKind = 'win'): void => {
    seq++;
    const playerInput = h('input', { value: `玩家${seq}`, class: 'player-input' }) as HTMLInputElement;
    const actionSelect = h(
      'select',
      {},
      ...ACTIONS.map((a) => h('option', { value: a, selected: a === preset }, ACTION_LABEL[a])),
    ) as HTMLSelectElement;
    const canWinChk = h('input', { type: 'checkbox', checked: true }) as HTMLInputElement;
    const row = h('div', { class: 'claim-row' }, playerInput, actionSelect,
      h('label', { class: 'chk' }, canWinChk, '满足胡牌条件'),
      h('button', { onclick: () => { row.remove(); } }, '删'));
    rows.append(row);
  };
  addRow('win');
  addRow('robbingKong');

  const runBtn = h(
    'button',
    {
      class: 'primary',
      onclick: () => {
        claims.length = 0;
        for (const row of rows.querySelectorAll<HTMLElement>('.claim-row')) {
          const [p, a, c] = [
            row.querySelector<HTMLInputElement>('.player-input')!,
            row.querySelector<HTMLSelectElement>('select')!,
            row.querySelector<HTMLInputElement>('input[type=checkbox]')!,
          ];
          claims.push({
            player: p.value,
            action: a.value as ActionKind,
            canWin: c.checked,
            kongKind: a.value === 'robbingKong' ? 'added' : undefined,
          });
        }
        const resolution = resolveClaims(state.rule, claims);
        const bonuses = checkEventBonuses(state.rule, {
          bottomDraw: state.context.bottomDraw,
          bottomDiscard: state.context.bottomDiscard,
          afterKong: state.context.afterKong,
        });
        mount(
          output,
          h('div', { class: 'result' },
            h('h3', {}, '裁决结果'),
            h('p', { class: 'muted' },
              `当前规则：一炮多响=${state.rule.events.multipleWinnersOnDiscard ? '允许' : '不允许'}，` +
              `优先级 ${state.rule.actionPriority.map((a) => ACTION_LABEL[a] ?? a).join(' > ')}`),
            h('div', { class: 'verdict ok' },
              '成立：',
              ...resolution.accepted.map((c) =>
                h('span', { class: 'fan-chip' }, `${c.player} ${ACTION_LABEL[c.action]}`)),
            ),
            resolution.rejected.length
              ? h('div', { class: 'verdict reject' },
                  '驳回：',
                  ...resolution.rejected.map((r) =>
                    h('span', { class: 'fan-chip' }, `${r.claim.player} ${ACTION_LABEL[r.claim.action]}（${r.reason}）`)),
                )
              : h('p', { class: 'muted' }, '无驳回声明'),
            h('p', {}, '事件加番：' + (bonuses.length ? bonuses.join('、') : '当前上下文无生效事件')),
          ),
        );
      },
    },
    '按当前规则裁决',
  );

  return h(
    'section',
    { class: 'panel' },
    h('h2', {}, '边角事件裁决（一炮多响 / 抢杠 / 吃碰杠优先级）'),
    rows,
    h('div', { class: 'toolbar' }, h('button', { onclick: () => addRow() }, '加一家声明'), runBtn),
    output,
  );
}
