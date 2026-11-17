/** 金手回归面板：浏览器内直接跑引擎自带的种子金手集，结果与 CLI 完全一致 */
import { h, mount } from './dom.ts';
import { RULE_TEMPLATES } from './state.ts';
import { runSuite } from '@mahjong/validate';
import { sichuanGolden, guangdongGolden } from '@mahjong/validate';

const SUITES = [sichuanGolden, guangdongGolden];

export function renderGoldenPanel(): HTMLElement {
  const output = h('div', {});
  const btn = h(
    'button',
    {
      class: 'primary',
      onclick: () => {
        const blocks = SUITES.map((suite) => {
          const rule = RULE_TEMPLATES[suite.ruleId]!;
          const report = runSuite(suite, rule);
          return h(
            'div',
            { class: `golden-block ${report.failed === 0 ? 'ok' : 'err'}` },
            h('h3', {},
              `${report.failed === 0 ? '✓' : '✗'} ${rule.name}：${report.passed}/${report.total} 通过`),
            report.failures.length
              ? h('ul', {}, ...report.failures.map((f) =>
                  h('li', {}, `${f.caseId} [${f.field}] 期望 ${JSON.stringify(f.expected)} ≠ 实际 ${JSON.stringify(f.actual)}`)))
              : h('p', { class: 'muted' }, '零错误（manual 用例已过独立划分器交叉复核）'),
          );
        });
        mount(output, h('div', { class: 'result' }, h('h3', {}, '金手回归结果'), ...blocks));
      },
    },
    '运行金手回归（种子集）',
  );
  return h(
    'section',
    { class: 'panel' },
    h('h2', {}, '金手验证（十玩法 × 各 50 手的落地结构，当前为种子用例）'),
    h('p', { class: 'muted' },
      '每手 manual 用例带 reviewer 留痕，并由独立划分器交叉复核；CI 门禁命令 npm run golden。'),
    btn,
    output,
  );
}
