/**
 * 金手回归 CLI：npm run golden
 * 退出码非 0 表示有用例失败，可直接挂 CI 门禁。
 */

import { sichuanRule, guangdongRule, validateRuleSet } from '@mahjong/rules';
import { runSuite, summarizeReports } from './runner.js';
import { sichuanGolden } from './golden/sichuan.golden.js';
import { guangdongGolden } from './golden/guangdong.golden.js';

const rules = [sichuanRule, guangdongRule];
const suites = [sichuanGolden, guangdongGolden];

let hasError = false;
for (const rule of rules) {
  const errs = validateRuleSet(rule);
  if (errs.length > 0) {
    hasError = true;
    console.error(`规则集 ${rule.id} 静态校验失败:\n - ${errs.join('\n - ')}`);
  }
}

const reports = suites.map((suite) => {
  const rule = rules.find((r) => r.id === suite.ruleId)!;
  return runSuite(suite, rule);
});
console.log(summarizeReports(reports));
if (reports.some((r) => r.failed > 0) || hasError) process.exitCode = 1;
