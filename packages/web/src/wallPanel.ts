/**
 * 牌墙模拟：按规则牌池构造 136 张牌墙，支持种子确定性洗牌与发牌。
 * 确定性随机（mulberry32）保证同一种子可复现，方便策划复盘与金手回放。
 */
import { h, mount } from './dom.ts';
import { state, tileLabel } from './state.ts';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildWall(): number[] {
  const useWinds = state.rule.tileRange.useWinds;
  const useDragons = state.rule.tileRange.useDragons;
  const maxTile = useWinds ? (useDragons ? 33 : 30) : 26;
  const wall: number[] = [];
  for (let t = 0; t <= maxTile; t++) {
    for (let k = 0; k < 4; k++) wall.push(t);
  }
  return wall;
}

export function renderWallPanel(): HTMLElement {
  const output = h('div', {});
  const seedInput = h('input', { type: 'number', value: '42', class: 'seed-input' }) as HTMLInputElement;
  const playerCount = h(
    'select',
    {},
    h('option', { value: '4', selected: true }, '4 家'),
    h('option', { value: '3' }, '3 家'),
  ) as HTMLSelectElement;

  const deal = (): void => {
    const seed = Number(seedInput.value) || 1;
    const rng = mulberry32(seed);
    const wall = buildWall();
    // Fisher–Yates 洗牌
    for (let i = wall.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [wall[i], wall[j]] = [wall[j]!, wall[i]!];
    }
    const n = Number(playerCount.value);
    const hands: number[][] = Array.from({ length: n }, () => []);
    let cursor = 0;
    // 每人 13 张（庄家 14 在发牌后补一张）
    for (let round = 0; round < 13; round++) {
      for (let p = 0; p < n; p++) hands[p]!.push(wall[cursor++]!);
    }
    const dealerExtra = wall[cursor++];
    const remaining = wall.slice(cursor);

    mount(
      output,
      h('div', { class: 'result' },
        h('h3', {}, `牌墙 ${wall.length} 张 · 种子 ${seed} · 剩余 ${remaining.length} 张`),
        ...hands.map((hand, idx) => {
          const sorted = hand.slice().sort((a, b) => a - b);
          const tiles = idx === 0 ? [...sorted, dealerExtra!].sort((a, b) => a - b) : sorted;
          return h('div', { class: 'dealt-hand' },
            h('strong', {}, idx === 0 ? `东家（庄，${tiles.length} 张）` : `玩家${idx + 1}（${tiles.length} 张）`),
            h('div', { class: 'wall-tiles' }, ...tiles.map((t) => h('span', { class: 'mini-tile' }, tileLabel(t)))),
          );
        }),
        h('details', {},
          h('summary', {}, '查看完整洗牌后牌墙序列'),
          h('div', { class: 'wall-tiles dense' }, ...wall.map((t) => h('span', { class: 'mini-tile' }, tileLabel(t)))),
        ),
      ),
    );
  };

  return h(
    'section',
    { class: 'panel' },
    h('h2', {}, '牌墙与发牌'),
    h('div', { class: 'toolbar' },
      h('label', {}, '随机种子：', seedInput),
      h('label', {}, '人数：', playerCount),
      h('button', { class: 'primary', onclick: deal }, '配牌墙并发牌'),
    ),
    h('p', { class: 'muted' }, '同一种子产生完全相同的牌墙，可复现、可回放；牌池随规则集的字牌开关联动。'),
    output,
  );
}
