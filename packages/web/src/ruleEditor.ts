/** 规则集编辑面板：模板加载、JSON 编辑、静态校验、说明文档预览 */
import { h, mount } from './dom.ts';
import { RULE_TEMPLATES, state, notify } from './state.ts';
import { validateRuleSet, renderRuleDoc } from '@mahjong/rules';

let editor: HTMLTextAreaElement | null = null;
let statusEl: HTMLElement | null = null;
let docEl: HTMLElement | null = null;

function validate(): void {
  if (!editor || !statusEl) return;
  try {
    const parsed = JSON.parse(editor.value) as typeof state.rule;
    const errors = validateRuleSet(parsed);
    if (errors.length === 0) {
      state.rule = parsed;
      statusEl.textContent = '✓ 规则静态校验通过，已应用到全部面板';
      statusEl.className = 'status ok';
      notify();
    } else {
      statusEl.textContent = `✗ ${errors.length} 个问题：${errors.join('；')}`;
      statusEl.className = 'status err';
    }
  } catch (e) {
    statusEl!.textContent = `✗ JSON 解析失败：${(e as Error).message}`;
    statusEl!.className = 'status err';
  }
}

function refreshDoc(): void {
  if (!docEl) return;
  try {
    const parsed = JSON.parse(editor?.value ?? '{}') as typeof state.rule;
    mount(docEl, h('pre', { class: 'doc' }, renderRuleDoc(parsed)));
  } catch {
    mount(docEl, h('p', { class: 'muted' }, '（JSON 不合法，无法生成文档）'));
  }
}

export function renderRuleEditor(): HTMLElement {
  editor = h('textarea', {
    class: 'json-editor',
    spellcheck: false,
    value: JSON.stringify(state.rule, null, 2),
    oninput: () => {
      statusEl!.textContent = '有未保存修改';
      statusEl!.className = 'status warn';
    },
  });

  const templateSelect = h(
    'select',
    {
      onchange: (e: Event) => {
        const id = (e.target as HTMLSelectElement).value;
        const tpl = RULE_TEMPLATES[id];
        if (tpl) {
          state.rule = structuredClone(tpl);
          editor!.value = JSON.stringify(state.rule, null, 2);
          statusEl!.textContent = `已加载模板：${tpl.name}`;
          statusEl!.className = 'status warn';
          notify();
        }
      },
    },
    ...Object.values(RULE_TEMPLATES).map((r) =>
      h('option', { value: r.id }, `${r.name}（${r.version}）`),
    ),
  );

  const exportBtn = h(
    'button',
    {
      onclick: () => {
        const blob = new Blob([editor!.value], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = h('a', { href: url, download: `${state.rule.id}-${state.rule.version}.json` });
        a.click();
        URL.revokeObjectURL(url);
      },
    },
    '导出规则 JSON',
  );

  const docBtn = h('button', { onclick: refreshDoc }, '生成运营规则说明');
  const applyBtn = h('button', { class: 'primary', onclick: validate }, '校验并应用');

  statusEl = h('div', { class: 'status muted' }, '编辑后点击「校验并应用」');
  docEl = h('div', { class: 'doc-box' });

  return h(
    'section',
    { class: 'panel' },
    h('div', { class: 'toolbar' },
      h('label', {}, '规则模板：', templateSelect),
      applyBtn,
      exportBtn,
      docBtn,
    ),
    statusEl,
    h('div', { class: 'split' },
      h('div', { class: 'editor-wrap' }, h('div', { class: 'hint' }, '规则 DSL（JSON，番种 when 为白名单谓词表达式）'), editor),
      docEl,
    ),
  );
}
