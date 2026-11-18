/**
 * 规则包校验器：浏览器配置台保存前、服务端加载时共用。
 * 把“悬空的番种引用、未注册谓词、非法计分参数”等配置错误挡在引擎之外，
 * 错误信息直接定位到具体字段，便于策划自行修正。
 */

import { PREDICATES } from '../core/predicates.ts';
import type { RulePack } from './types.ts';

export interface ValidationIssue {
  path: string;
  message: string;
}

export function validateRulePack(pack: RulePack): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (path: string, message: string): void => {
    issues.push({ path, message });
  };

  if (!pack.id) push('id', '规则包 id 不能为空');
  if (!pack.name) push('name', '规则包名称不能为空');
  if (!/^\d+\.\d+\.\d+$/.test(pack.version)) push('version', '版本号应为 semver，如 0.1.0');

  if (pack.wall.copiesPerTile <= 0 || pack.wall.copiesPerTile > 4) {
    push('wall.copiesPerTile', '每种牌张数应在 1..4');
  }
  if (pack.wildcard.enabled) {
    if (pack.wildcard.maxCount <= 0) push('wildcard.maxCount', '启用赖子时 maxCount 必须 > 0');
    if (pack.wildcard.maxCount > 4) push('wildcard.maxCount', '赖子张数不应超过 4');
  }

  if (!pack.scoring.mode) push('scoring.mode', '缺少计分模式');
  if (pack.scoring.minFan < 0) push('scoring.minFan', '起胡番不能为负');
  if (pack.scoring.cap !== null && pack.scoring.cap < 0) push('scoring.cap', '封顶不能为负');

  const fanIds = new Set<string>();
  for (const [i, fan] of pack.fans.entries()) {
    const base = `fans[${i}]`;
    if (fanIds.has(fan.id)) push(`${base}.id`, `番种 id 重复: ${fan.id}`);
    fanIds.add(fan.id);
    if (!fan.name) push(`${base}.name`, '番种名称不能为空');
    if (!(fan.predicate in PREDICATES)) push(`${base}.predicate`, `未注册的谓词: ${fan.predicate}`);
    if (fan.value <= 0) push(`${base}.value`, '番值/倍数必须为正数');
    for (const lowId of fan.includes ?? []) {
      if (lowId === fan.id) push(`${base}.includes`, '番种不能包含自身');
    }
  }
  // includes 引用完整性（两轮：先收集 id 再校验，允许前向引用）
  for (const [i, fan] of pack.fans.entries()) {
    for (const lowId of fan.includes ?? []) {
      if (!fanIds.has(lowId)) {
        push(`fans[${i}].includes`, `包含了不存在的番种 id: ${lowId}`);
      }
    }
  }

  // 包含关系不能成环
  const graph = new Map<string, string[]>();
  for (const fan of pack.fans) graph.set(fan.id, fan.includes ?? []);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const dfs = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of graph.get(id) ?? []) {
      if (fanIds.has(next) && dfs(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  for (const id of fanIds) {
    if (dfs(id)) {
      push('fans', `番种包含关系存在环（涉及 ${id}）`);
      break;
    }
  }

  if (pack.claim.order.length === 0) push('claim.order', '动作优先级不能为空');
  return issues;
}

export function assertValidRulePack(pack: RulePack): void {
  const issues = validateRulePack(pack);
  if (issues.length > 0) {
    throw new Error(`规则包校验失败：\n${issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n')}`);
  }
}
