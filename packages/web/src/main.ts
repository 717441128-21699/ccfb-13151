import { h, mount } from './dom.ts';
import { renderRuleEditor } from './ruleEditor.ts';
import { renderHandBuilder } from './handBuilder.ts';
import { renderEventsPanel } from './eventsPanel.ts';
import { renderWallPanel } from './wallPanel.ts';
import { renderGoldenPanel } from './goldenPanel.ts';
import './styles.css';

const TABS = [
  { id: 'rules', label: '规则配置', render: renderRuleEditor },
  { id: 'hand', label: '摆牌算番', render: renderHandBuilder },
  { id: 'wall', label: '牌墙发牌', render: renderWallPanel },
  { id: 'events', label: '边角事件', render: renderEventsPanel },
  { id: 'golden', label: '金手验证', render: renderGoldenPanel },
] as const;

const app = document.querySelector<HTMLDivElement>('#app')!;
const content = h('div', { class: 'tab-content' });
const buttons = new Map<string, HTMLButtonElement>();

const switchTab = (id: string): void => {
  const tab = TABS.find((t) => t.id === id)!;
  mount(content, tab.render());
  for (const [tid, btn] of buttons) btn.classList.toggle('active', tid === id);
};

const tabBar = h(
  'nav',
  { class: 'tab-bar' },
  ...TABS.map((t) => {
    const btn = h('button', { onclick: () => switchTab(t.id) }, t.label) as HTMLButtonElement;
    buttons.set(t.id, btn);
    return btn;
  }),
);

app.append(
  h('header', { class: 'app-header' },
    h('h1', {}, '地方麻将规则配置与验证平台'),
    h('p', { class: 'muted' }, '规则 DSL · 赖子穷举引擎 · 番种包含/封顶 · 金手回归 —— 浏览器与服务端共用同一套 TS 引擎'),
  ),
  tabBar,
  content,
);
switchTab('rules');
