import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRulePack, assertValidRulePack } from '../src/rules/validate.ts';
import { renderRuleDoc } from '../src/rules/doc-generator.ts';
import { sichuanPack, guobiaoPack, laiziPack } from '../src/core/index.ts';

test('三份内置规则包均通过校验', () => {
  for (const pack of [sichuanPack, guobiaoPack, laiziPack]) {
    const issues = validateRulePack(pack);
    assert.deepEqual(issues, [], `${pack.id} 不应有问题: ${JSON.stringify(issues)}`);
    assert.doesNotThrow(() => assertValidRulePack(pack));
  }
});

test('悬空的 includes 引用被拦截', () => {
  const broken = structuredClone(sichuanPack);
  broken.fans[0]!.includes = ['not-exist'];
  const issues = validateRulePack(broken);
  assert.ok(issues.some((i) => i.message.includes('不存在的番种')));
});

test('未注册谓词被拦截', () => {
  const broken = structuredClone(sichuanPack);
  broken.fans[0]!.predicate = 'madeUpPredicate';
  const issues = validateRulePack(broken);
  assert.ok(issues.some((i) => i.message.includes('未注册的谓词')));
});

test('包含关系成环被拦截', () => {
  const broken = structuredClone(sichuanPack);
  broken.fans[0]!.includes = ['duanyaojiu'];
  broken.fans[4]!.includes = [broken.fans[0]!.id]; // duanyaojiu -> qingyise 形成环
  const issues = validateRulePack(broken);
  assert.ok(issues.some((i) => i.message.includes('环')));
});

test('重复番种 id、非法版本号、非法赖子数被拦截', () => {
  const broken = structuredClone(laiziPack);
  broken.fans[1]!.id = broken.fans[0]!.id;
  broken.version = 'v1';
  broken.wildcard.maxCount = 9;
  const issues = validateRulePack(broken);
  assert.ok(issues.some((i) => i.message.includes('重复')));
  assert.ok(issues.some((i) => i.path === 'version'));
  assert.ok(issues.some((i) => i.path === 'wildcard.maxCount'));
});

test('文档生成器产出含关键章节的 Markdown', () => {
  const md = renderRuleDoc(sichuanPack);
  assert.ok(md.startsWith('# 四川血战'));
  assert.ok(md.includes('## 1. 牌墙与赖子'));
  assert.ok(md.includes('一炮多响'));
  assert.ok(md.includes('抢杠胡'));
  assert.ok(md.includes('清一色'));
  assert.ok(md.includes('自动生成'));
});

test('文档与规则包数据一致：封顶值出现在文档中', () => {
  const md = renderRuleDoc(laiziPack);
  assert.ok(md.includes('封顶：6'));
  assert.ok(md.includes('红中赖子'));
});
