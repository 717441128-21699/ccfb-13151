/**
 * 牌局验证装置:读取 fixtures/*.json,逐手跑引擎,与人工核过的期望值比对。
 * 用法:node packages/harness/run.ts [fixtures目录]
 * 退出码:全部一致 0;有任何一手不符 1(一手都不能错)。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateHand, type EvalResult } from '../core/src/evaluate.ts';
import { parseTile, parseTiles } from '../core/src/tiles.ts';
import type { WinContext } from '../core/src/rule.ts';
import { getPack } from '../rulepacks/src/index.ts';

export interface FixtureCase {
  id: string;
  note?: string;
  hand: string;
  context?: {
    isZimo?: boolean;
    isRobKong?: boolean;
    isLastWallTile?: boolean;
    isLastDiscard?: boolean;
    isKongFlower?: boolean;
    isTianHu?: boolean;
    isDiHu?: boolean;
    seatWind?: string;
    prevalentWind?: string;
    flowers?: string[];
    melds?: { kind: 'chi' | 'peng' | 'gang' | 'angang'; base: string }[];
  };
  expect: {
    win: boolean;
    totalFan?: number;
    totalFen?: number;
    fans?: string[];
  };
}

export interface CaseResult {
  packId: string;
  id: string;
  ok: boolean;
  problems: string[];
  result: EvalResult;
}

function parseContext(raw: FixtureCase['context']): WinContext {
  if (!raw) return {};
  return {
    isZimo: raw.isZimo,
    isRobKong: raw.isRobKong,
    isLastWallTile: raw.isLastWallTile,
    isLastDiscard: raw.isLastDiscard,
    isKongFlower: raw.isKongFlower,
    isTianHu: raw.isTianHu,
    isDiHu: raw.isDiHu,
    seatWind: raw.seatWind ? parseTile(raw.seatWind) : undefined,
    prevalentWind: raw.prevalentWind ? parseTile(raw.prevalentWind) : undefined,
    flowers: raw.flowers?.map(parseTile),
    melds: raw.melds?.map((m) => ({ kind: m.kind, base: parseTile(m.base) })),
  };
}

export function checkCase(packId: string, c: FixtureCase): CaseResult {
  const pack = getPack(packId);
  const problems: string[] = [];
  let result: EvalResult;
  try {
    result = evaluateHand(parseTiles(c.hand), pack, parseContext(c.context));
  } catch (e) {
    return {
      packId,
      id: c.id,
      ok: false,
      problems: [`引擎异常: ${(e as Error).message}`],
      result: { win: false, analyses: [], elapsedMs: 0 },
    };
  }

  const exp = c.expect;
  if (result.win !== exp.win) {
    problems.push(`胡牌判定不符:期望 ${exp.win},实际 ${result.win}${result.reason ? `(${result.reason})` : ''}`);
  }
  if (result.win && result.best) {
    if (exp.totalFan != null && result.best.totalFan !== exp.totalFan)
      problems.push(`总番不符:期望 ${exp.totalFan},实际 ${result.best.totalFan}`);
    if (exp.totalFen != null && result.best.totalFen !== exp.totalFen)
      problems.push(`总分不符:期望 ${exp.totalFen},实际 ${result.best.totalFen}`);
    if (exp.fans) {
      const actual = result.best.fans.map((f) => f.name).sort();
      const want = [...exp.fans].sort();
      if (JSON.stringify(actual) !== JSON.stringify(want))
        problems.push(`番种不符:期望 [${want.join(',')}],实际 [${actual.join(',')}]`);
    }
  }
  return { packId, id: c.id, ok: problems.length === 0, problems, result };
}

export function runFixtures(dir: string): { total: number; failed: number; results: CaseResult[] } {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const results: CaseResult[] = [];
  for (const file of files) {
    const fixture = JSON.parse(readFileSync(join(dir, file), 'utf8')) as {
      pack: string;
      cases: FixtureCase[];
    };
    for (const c of fixture.cases) {
      results.push(checkCase(fixture.pack, c));
    }
  }
  const failed = results.filter((r) => !r.ok).length;
  return { total: results.length, failed, results };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const dir = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
  const { total, failed, results } = runFixtures(dir);
  for (const r of results) {
    if (r.ok) {
      console.log(`✔ [${r.packId}] ${r.id}`);
    } else {
      console.log(`✖ [${r.packId}] ${r.id}`);
      for (const p of r.problems) console.log(`    ${p}`);
    }
  }
  console.log(`\n共 ${total} 手,${failed === 0 ? '全部一致 ✓' : `${failed} 手不符 ✗`}`);
  process.exit(failed === 0 ? 0 : 1);
}
