/**
 * 规则 DSL 求值器。
 *
 * 表达式是纯 JSON 节点，函数只能引用 @mahjong/core 的白名单谓词，
 * 不接触 Function/eval/全局对象，因此策划在浏览器里配的规则可以安全回放与版本化。
 */

import { PREDICATES, type FanContext } from '@mahjong/core';

export type ExprNode =
  | { kind: 'lit'; value: boolean | number | string }
  | { kind: 'ref'; name: string }
  | { kind: 'call'; fn: string; args: ExprNode[] }
  | { kind: 'and'; exprs: ExprNode[] }
  | { kind: 'or'; exprs: ExprNode[] }
  | { kind: 'not'; expr: ExprNode }
  | { kind: 'cmp'; op: '==' | '!=' | '>=' | '<=' | '>' | '<'; left: ExprNode; right: ExprNode };

export class RuleDslError extends Error {
  constructor(
    message: string,
    readonly path: string,
  ) {
    super(`规则 DSL 错误 @ ${path}: ${message}`);
    this.name = 'RuleDslError';
  }
}

function evalNode(node: ExprNode, ctx: FanContext, path: string): unknown {
  switch (node.kind) {
    case 'lit':
      return node.value;
    case 'ref':
      if (node.name === 'ctx') return ctx;
      throw new RuleDslError(`未知引用 ${node.name}（仅支持 ctx）`, path);
    case 'call': {
      // 内建逻辑/比较运算符也允许以 call 形式书写（Web 表单生成的规则更紧凑）
      if (node.fn === 'and' || node.fn === 'or') {
        const vals = node.args.map((a, i) => evalNode(a, ctx, `${path}.args[${i}]`));
        return node.fn === 'and' ? vals.every(Boolean) : vals.some(Boolean);
      }
      if (node.fn === 'not') {
        return !evalNode(node.args[0]!, ctx, `${path}.args[0]`);
      }
      if (['==', '!=', '>=', '<=', '>', '<'].includes(node.fn)) {
        const l = evalNode(node.args[0]!, ctx, `${path}.args[0]`);
        const r = evalNode(node.args[1]!, ctx, `${path}.args[1]`);
        switch (node.fn) {
          case '==': return l === r;
          case '!=': return l !== r;
          case '>=': return (l as number) >= (r as number);
          case '<=': return (l as number) <= (r as number);
          case '>': return (l as number) > (r as number);
          case '<': return (l as number) < (r as number);
        }
      }
      const fn = PREDICATES[node.fn];
      if (!fn) throw new RuleDslError(`谓词 ${node.fn} 不在白名单内`, path);
      const args = node.args.map((a, i) =>
        evalNode(a, ctx, `${path}.args[${i}]`),
      );
      try {
        return fn(ctx, args);
      } catch (e) {
        throw new RuleDslError(
          `谓词 ${node.fn} 执行失败: ${(e as Error).message}`,
          path,
        );
      }
    }
    case 'and':
      return node.exprs.every((e, i) =>
        Boolean(evalNode(e, ctx, `${path}.and[${i}]`)),
      );
    case 'or':
      return node.exprs.some((e, i) =>
        Boolean(evalNode(e, ctx, `${path}.or[${i}]`)),
      );
    case 'not':
      return !evalNode(node.expr, ctx, `${path}.not`);
    case 'cmp': {
      const l = evalNode(node.left, ctx, `${path}.left`);
      const r = evalNode(node.right, ctx, `${path}.right`);
      switch (node.op) {
        case '==': return l === r;
        case '!=': return l !== r;
        case '>=': return (l as number) >= (r as number);
        case '<=': return (l as number) <= (r as number);
        case '>': return (l as number) > (r as number);
        case '<': return (l as number) < (r as number);
      }
    }
  }
}

export function evalExpr(node: ExprNode, ctx: FanContext): boolean {
  const v = evalNode(node, ctx, '$');
  return Boolean(v);
}

const BUILTIN_OPS = new Set(['and', 'or', 'not', '==', '!=', '>=', '<=', '>', '<']);

/** 静态校验：函数名白名单、节点结构、参数个数（粗校验） */
export function validateExpr(node: ExprNode, path = '$'): string[] {
  const errors: string[] = [];
  switch (node.kind) {
    case 'lit':
    case 'ref':
      if (node.kind === 'ref' && node.name !== 'ctx') {
        errors.push(`${path}: 未知引用 ${node.name}`);
      }
      break;
    case 'call':
      if (!BUILTIN_OPS.has(node.fn) && !(node.fn in PREDICATES)) {
        errors.push(`${path}: 谓词 ${node.fn} 不在白名单`);
      }
      node.args.forEach((a, i) => errors.push(...validateExpr(a, `${path}.args[${i}]`)));
      break;
    case 'and':
    case 'or':
      if (node.exprs.length === 0) errors.push(`${path}: ${node.kind} 至少一个子表达式`);
      node.exprs.forEach((e, i) => errors.push(...validateExpr(e, `${path}.${node.kind}[${i}]`)));
      break;
    case 'not':
      errors.push(...validateExpr(node.expr, `${path}.not`));
      break;
    case 'cmp':
      errors.push(...validateExpr(node.left, `${path}.left`));
      errors.push(...validateExpr(node.right, `${path}.right`));
      break;
  }
  return errors;
}

// ---------- 便捷构造器（Web 表单与测试里用） ----------
export const dsl = {
  lit: (value: boolean | number | string): ExprNode => ({ kind: 'lit', value }),
  call: (fn: string, ...args: ExprNode[]): ExprNode => ({ kind: 'call', fn, args }),
  and: (...exprs: ExprNode[]): ExprNode => ({ kind: 'and', exprs }),
  or: (...exprs: ExprNode[]): ExprNode => ({ kind: 'or', exprs }),
  not: (expr: ExprNode): ExprNode => ({ kind: 'not', expr }),
  cmp: (
    op: ExprNode extends never ? never : '==' | '!=' | '>=' | '<=' | '>' | '<',
    left: ExprNode,
    right: ExprNode,
  ): ExprNode => ({ kind: 'cmp', op, left, right }),
};
