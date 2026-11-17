/**
 * 规则说明文档生成：把 RuleSet 渲染成 Markdown。
 * 运营看到的文档与引擎实际消费的是同一份配置，杜绝「文档写一套、程序跑一套」。
 */

import { tileLabel } from '@mahjong/core';
import type { RuleSet } from './schema.js';

export function renderRuleDoc(rule: RuleSet): string {
  const lines: string[] = [];
  lines.push(`# ${rule.name} 规则说明`);
  lines.push('');
  lines.push(`- 规则编号：\`${rule.id}\``);
  lines.push(`- 版本：${rule.version}`);
  lines.push(`- 地区：${rule.region}`);
  lines.push(`- 概述：${rule.description}`);
  lines.push('');

  lines.push('## 1. 牌池与赖子');
  lines.push('');
  lines.push(`- 使用花色：${rule.tileRange.suits.join('、')}`);
  lines.push(`- 风牌：${rule.tileRange.useWinds ? '使用' : '不使用'}`);
  lines.push(`- 箭牌（白发中）：${rule.tileRange.useDragons ? '使用' : '不使用'}`);
  lines.push(
    rule.joker.enabled
      ? `- 赖子：启用；定赖方式：${rule.joker.determine === 'turnNext' ? '翻牌顺位定赖' : '固定赖子'}` +
        `${rule.joker.fixedTiles?.length ? `（${rule.joker.fixedTiles.map(tileLabel).join('、')}）` : ''}；` +
        `七对中允许赖子：${rule.joker.allowedInSevenPairs ? '是' : '否'}`
      : '- 赖子：不启用',
  );
  lines.push('');

  lines.push('## 2. 胡牌牌型');
  lines.push('');
  lines.push(`- 标准型（4 面子 + 1 将）：${rule.winPatterns.standard ? '允许' : '不允许'}`);
  lines.push(`- 七对：${rule.winPatterns.sevenPairs ? '允许' : '不允许'}`);
  lines.push(`- 十三幺：${rule.winPatterns.thirteenOrphans ? '允许' : '不允许'}`);
  lines.push(`- 起胡番数：${rule.winPatterns.minFan} 番`);
  if (rule.globalConstraints.length > 0) {
    lines.push(`- 全局约束：${rule.globalConstraints.length} 条（如缺门要求）`);
  }
  lines.push('');

  lines.push('## 3. 番种表');
  lines.push('');
  lines.push('| 番种 | 番值 | 役满 | 包含（排除）的低番 | 说明 |');
  lines.push('| --- | --- | --- | --- | --- |');
  const fanName = (id: string) => rule.fans.find((f) => f.id === id)?.name ?? id;
  for (const f of [...rule.fans].sort((a, b) => b.value - a.value)) {
    lines.push(
      `| ${f.name} | ${f.value} | ${f.limit ? '是' : ''} | ${f.excludes.map(fanName).join('、') || '—'} | ${f.description} |`,
    );
  }
  lines.push('');

  lines.push('## 4. 计分与封顶');
  lines.push('');
  const m = rule.scoring.model;
  const modelText =
    m.kind === 'fanSum'
      ? '番值直接相加'
      : m.kind === 'fanMultiply'
        ? `指数计分（底番 ${m.baseFan}，每升一番翻倍）`
        : '番数查表计分';
  lines.push(`- 计分模型：${modelText}`);
  lines.push(`- 番数封顶：${rule.scoring.capFan === null ? '不封' : `${rule.scoring.capFan} 番`}`);
  lines.push(`- 分值封顶：${rule.scoring.capPoints === null ? '不封' : `${rule.scoring.capPoints} 分`}`);
  lines.push('');

  lines.push('## 5. 动作优先级与边角规则');
  lines.push('');
  lines.push(`- 动作优先级（高→低）：${rule.actionPriority.join(' > ')}`);
  lines.push(`- 一炮多响：${rule.events.multipleWinnersOnDiscard ? '允许，多家同时荣胡' : '不允许，仅头家胡'}`);
  lines.push(`- 抢杠胡：${rule.events.robKong ? `允许（可抢：${rule.events.robKongTargets.join('、')}）` : '不允许'}`);
  lines.push(`- 海底捞月：${rule.events.bottomDrawWin ? '计番' : '不计'}`);
  lines.push(`- 河底捞鱼：${rule.events.bottomDiscardWin ? '计番' : '不计'}`);
  lines.push(`- 杠上开花：${rule.events.afterKongWin ? '计番' : '不计'}`);
  lines.push('');
  return lines.join('\n');
}
