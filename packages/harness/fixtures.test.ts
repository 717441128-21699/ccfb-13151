import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runFixtures } from './run.ts';

test('牌局验证:全部 fixture 一手都不能错', () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
  const { total, failed, results } = runFixtures(dir);
  for (const r of results.filter((x) => !x.ok)) {
    console.error(`✖ [${r.packId}] ${r.id}: ${r.problems.join('; ')}`);
  }
  assert.equal(failed, 0, `${failed}/${total} 手不符`);
  assert.ok(total > 0, 'fixture 为空');
});
