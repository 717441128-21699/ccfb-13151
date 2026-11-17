/**
 * 金手回归运行器：逐手比对引擎实际输出与人工期望值，任一字段不符即失败并给出差异。
 * 同时对 manual 用例跑独立校验器交叉复核。
 */

import { parseHand } from '@mahjong/core';
import { scoreHand, type RuleSet } from '@mahjong/rules';
import { crossCheckStandard } from './crossCheck.js';
import type {
  CaseFailure,
  GoldenCase,
  GoldenReport,
  GoldenSuite,
} from './types.js';

export function runSuite(suite: GoldenSuite, rule: RuleSet): GoldenReport {
  if (suite.ruleId !== rule.id) {
    throw new Error(`用例集 ${suite.ruleId} 与规则 ${rule.id} 不匹配`);
  }
  const failures: CaseFailure[] = [];
  let passed = 0;

  for (const c of suite.cases) {
    const localFailures = runCase(c, rule);
    if (localFailures.length === 0) passed++;
    else failures.push(...localFailures);
  }

  return {
    ruleId: rule.id,
    total: suite.cases.length,
    passed,
    failed: suite.cases.length - passed,
    failures,
  };
}

export function runCase(c: GoldenCase, rule: RuleSet): CaseFailure[] {
  const failures: CaseFailure[] = [];
  const hand = parseHand(c.hand);
  const result = scoreHand({ hand, rule, context: c.context });

  const push = (field: string, expected: unknown, actual: unknown): void => {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      failures.push({ caseId: c.id, note: c.note, field, expected, actual });
    }
  };

  push('win', c.expected.win, result.win);
  if (c.expected.win && result.best) {
    push('totalFan', c.expected.totalFan, result.best.totalFan);
    push('points', c.expected.points, result.best.points);
    push(
      'fanIds',
      [...c.expected.fanIds].sort(),
      result.best.hits.map((h) => h.fanId).sort(),
    );
    if (c.expected.bestKind) {
      push('bestKind', c.expected.bestKind, result.best.decomposition.kind);
    }
  } else if (!c.expected.win) {
    push('totalFan', 0, result.best?.totalFan ?? 0);
  }

  // 手动用例：独立划分器交叉复核标准型结论
  if (c.provenance === 'manual' && !c.reviewer) {
    failures.push({
      caseId: c.id,
      note: c.note,
      field: 'reviewer',
      expected: 'manual 用例必须登记复核人',
      actual: undefined,
    });
  }
  if (c.provenance === 'manual') {
    const cross = crossCheckStandard(hand, rule, c.context);
    if (!cross.consistent) {
      failures.push({
        caseId: c.id,
        note: c.note,
        field: 'crossCheck',
        expected: cross.engineWin,
        actual: cross.partitionWin,
      });
    }
  }
  return failures;
}

export function summarizeReports(reports: GoldenReport[]): string {
  const lines: string[] = [];
  let total = 0;
  let failed = 0;
  for (const r of reports) {
    total += r.total;
    failed += r.failed;
    lines.push(
      `${r.failed === 0 ? 'PASS' : 'FAIL'}  ${r.ruleId.padEnd(20)} ` +
        `${r.passed}/${r.total} 通过` +
        (r.failed ? `，失败 ${r.failed} 手` : ''),
    );
    for (const f of r.failures) {
      lines.push(
        `        ✖ ${f.caseId} [${f.field}] 期望=${JSON.stringify(f.expected)} 实际=${JSON.stringify(f.actual)}（${f.note}）`,
      );
    }
  }
  lines.push('');
  lines.push(
    failed === 0
      ? `金手回归全部通过：${total} 手零错误`
      : `金手回归存在失败：${failed}/${total} 手不符合期望`,
  );
  return lines.join('\n');
}
