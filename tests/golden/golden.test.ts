/**
 * 黄金牌局运行器：读取 tests/golden/<rulePackId>.json，逐手比对
 * 胡牌结论、番种集合、番值与结构性拒绝原因。
 *
 * 扩容方式：新增玩法时投放同构 JSON（每手 expected 由人工核对），
 * 本文件无需修改即自动纳入 CI。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fromNotation } from '../../src/core/hand.ts';
import { evaluateWithRules } from '../../src/core/evaluate.ts';
import { sichuanPack, guobiaoPack, laiziPack } from '../../src/core/index.ts';
import type { RulePack } from '../../src/rules/types.ts';
import type { GameContext, WinMethod } from '../../src/core/predicates.ts';

const here = dirname(fileURLToPath(import.meta.url));
const PACKS: Record<string, RulePack> = {
  'sichuan-xuezhan-demo': sichuanPack,
  'guobiao-subset': guobiaoPack,
  'hunan-laizi-demo': laiziPack,
};

interface GoldenCase {
  id: string;
  hand: string;
  wildcards: number;
  game: Omit<GameContext, 'winMethod'> & { winMethod: WinMethod };
  isWin: boolean;
  expectedFanTotal?: number;
  expectedFanIds: string[];
  canWinExpected?: boolean;
  structuralReject?: string;
  assertContainsOnly?: boolean;
  note?: string;
}

interface GoldenFile {
  schemaVersion: string;
  cases: GoldenCase[];
}

for (const file of readdirSync(here).filter((f) => f.endsWith('.json'))) {
  const packId = file.replace('.json', '');
  const pack = PACKS[packId];
  if (!pack) throw new Error(`黄金牌局引用了未注册规则包: ${packId}`);

  const data = JSON.parse(readFileSync(join(here, file), 'utf8')) as GoldenFile;

  test(`黄金套件 ${packId}（${data.cases.length} 手）`, async (t) => {
    for (const c of data.cases) {
      await t.test(c.id, () => {
        const hand = fromNotation(c.hand);
        assert.equal(hand.wildcards, c.wildcards, `${c.id}: 赖子张数与声明不符`);
        const result = evaluateWithRules(pack, hand, c.game);

        assert.equal(result.analysis.isWin, c.isWin, `${c.id}: 胡牌结论不符`);

        if (!c.isWin) {
          assert.equal(result.best, null);
          return;
        }

        if (c.structuralReject === 'missingSuit') {
          assert.equal(result.structuralChecks.missingSuit, false, `${c.id}: 应被定缺拒绝`);
          assert.equal(result.canWin, false);
          return;
        }

        assert.ok(result.best, `${c.id}: 缺少评分结果`);
        const appliedIds = result.best!.applied.map((f) => f.id);

        if (c.assertContainsOnly === false) {
          for (const id of c.expectedFanIds) {
            assert.ok(appliedIds.includes(id), `${c.id}: 缺少番种 ${id}，实际 ${appliedIds.join(',')}`);
          }
        } else {
          assert.deepEqual(
            [...appliedIds].sort(),
            [...c.expectedFanIds].sort(),
            `${c.id}: 番种集合不符`,
          );
        }

        if (c.expectedFanTotal !== undefined) {
          assert.equal(result.best!.total, c.expectedFanTotal, `${c.id}: 番值不符`);
        }
        if (c.canWinExpected !== undefined) {
          assert.equal(result.canWin, c.canWinExpected, `${c.id}: 起胡线结论不符`);
        }
      });
    }
  });
}
