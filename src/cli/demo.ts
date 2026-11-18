/**
 * 端到端演示：同一引擎在 Node 侧的命令行入口，
 * 展示“摆一手牌 -> 能不能胡 -> 几番 -> 怎么拆番最大 -> 听哪些牌”的完整链路。
 * 浏览器端复用同样的 src/core 模块，仅 UI 不同。
 */

import { fromNotation } from '../core/hand.ts';
import { evaluateWithRules } from '../core/evaluate.ts';
import { analyzeHand } from '../core/win.ts';
import { tileNotation } from '../core/tiles.ts';
import { sichuanPack, guobiaoPack, laiziPack } from '../core/index.ts';
import type { RulePack } from '../rules/types.ts';
import type { RuleEvaluation } from '../core/evaluate.ts';
import type { GameContext } from '../core/predicates.ts';

const line = '─'.repeat(72);

function showMelds(result: RuleEvaluation): void {
  const best = result.best;
  if (!best) {
    console.log('  无可行拆分');
    return;
  }
  const d = best.decomposition;
  if (d.kind === 'sevenPairs') {
    console.log('  最优拆分（七对）：',
      d.pairs?.map((p) => p.targetTiles.map((t) => tileNotation(t)).join('')).join(' '));
  } else if (d.kind === 'thirteenOrphans') {
    console.log('  最优拆分（十三幺）');
  } else {
    const meldText = d.melds
      .map((m) => m.targetTiles.map((t) => tileNotation(t)).join('') + (m.wildUsed ? `(赖${m.wildUsed})` : ''))
      .join(' ');
    const pairText = d.pair
      ? d.pair.targetTiles.map((t) => tileNotation(t)).join('') + (d.pair.wildUsed ? `(赖${d.pair.wildUsed})` : '')
      : `两赖将(待定)`;
    console.log(`  最优拆分：面子 [${meldText}] 将 [${pairText}]`);
  }
}

function showCase(pack: RulePack, notation: string, game: GameContext, title: string): void {
  console.log(`\n${line}\n【${pack.name}】${title}`);
  console.log(`  手牌：${notation}`);
  const hand = fromNotation(notation);
  const result = evaluateWithRules(pack, hand, game);

  if (!result.analysis.isWin) {
    console.log('  结论：不构成胡牌结构');
    return;
  }
  if (!result.structuralChecks.missingSuit) {
    console.log('  结论：牌型可胡，但未满足定缺要求，结构性拒绝');
    return;
  }
  showMelds(result);
  const best = result.best!;
  console.log(`  命中番种：${best.applied.map((f) => `${f.name}(${f.value})`).join('、') || '无'}`);
  if (best.excluded.length > 0) {
    console.log(`  被覆盖/互斥：${best.excluded.map((e) => `${e.name}<-${e.blockedBy}`).join('、')}`);
  }
  console.log(`  番值：原始 ${best.rawTotal} → 合计 ${best.total}${best.capped ? '（已封顶）' : ''}，${result.canWin ? '达到起胡线 ✅' : '未达起胡线 ❌'}`);
}

function showWaits(pack: RulePack, notation: string): void {
  console.log(`\n${line}\n【${pack.name}】听牌枚举（13 张）`);
  console.log(`  手牌：${notation}`);
  const hand = fromNotation(notation);
  const { waits } = analyzeHand(hand);
  if (waits.length === 0) {
    console.log('  不听牌');
    return;
  }
  const text = waits.map((w) => tileNotation(w.tile)).join(' ');
  console.log(`  听 ${waits.length} 张：${text}`);
}

// —— 四川血战 ——
showCase(
  sichuanPack,
  '123m 456m 789m 234m 55m',
  { winMethod: 'selfDraw', exposedKongs: 0, concealedKongs: 0, exposedMelds: 0, isLastTile: false, absentSuit: 'p' },
  '清一色自摸（三番封顶演示）',
);

// —— 国标 ——
showCase(
  guobiaoPack,
  '19m 19s 19p ESWN ZFB E',
  { winMethod: 'discard', exposedKongs: 0, concealedKongs: 0, exposedMelds: 0, isLastTile: false, absentSuit: null },
  '十三幺（88 番大牌 + 高番覆盖小番）',
);

// —— 赖子 ——
showCase(
  laiziPack,
  '123m 456m 789m 123p 5m*5m*',
  { winMethod: 'selfDraw', exposedKongs: 0, concealedKongs: 0, exposedMelds: 0, isLastTile: false, absentSuit: null },
  '两赖万能将（赖子展开 + 最优拆番）',
);

// —— 听牌 ——
showWaits(sichuanPack, '123m 456m 789m 23p EE');

console.log(`\n${line}\n演示结束。浏览器配置台产出的规则包与上述 JSON 同构，引擎零改动接入新地方玩法。\n`);
