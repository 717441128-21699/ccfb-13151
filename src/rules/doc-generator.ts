/**
 * 规则说明生成器：把规则包渲染成运营可读的 Markdown 文档。
 * 策划在浏览器配置台保存规则包后可一键导出，文档与引擎读取的是同一份数据，
 * 从根上杜绝“文档写的规则和线上跑的规则不一致”。
 */

import type { RulePack } from './types.ts';
import type { FanDef } from '../core/fan-engine.ts';

function fanLine(fan: FanDef, all: FanDef[]): string {
  const tags: string[] = [];
  if (fan.mutexGroup) tags.push(`互斥组:${fan.mutexGroup}`);
  if (fan.requireNoWildcard) tags.push('仅天然（无赖子）');
  const covered = (fan.includes ?? [])
    .map((id: string) => all.find((f) => f.id === id)?.name ?? id)
    .join('、');
  if (covered) tags.push(`覆盖:${covered}`);
  const params = fan.params ? ` 参数=${JSON.stringify(fan.params)}` : '';
  const desc = fan.description ? ` —— ${fan.description}` : '';
  return `| ${fan.name} | \`${fan.predicate}\`${params} | ${fan.value} | ${tags.join('；') || '—'} |${desc ? '' : ''}`;
}

export function renderRuleDoc(pack: RulePack): string {
  const lines: string[] = [];
  lines.push(`# ${pack.name} 规则说明`);
  lines.push('');
  lines.push(`- 规则包 ID：\`${pack.id}\``);
  lines.push(`- 适用地区：${pack.region}`);
  lines.push(`- 语义版本：${pack.version}`);
  if (pack.documentation?.summary) {
    lines.push(`- 概述：${pack.documentation.summary}`);
  }
  lines.push('');

  lines.push('## 1. 牌墙与赖子');
  lines.push('');
  lines.push(`- 每种牌张数：${pack.wall.copiesPerTile}`);
  lines.push(`- 花牌：${pack.wall.flowerTiles.length > 0 ? pack.wall.flowerTiles.join('、') : '无'}`);
  if (pack.wildcard.enabled) {
    lines.push(`- 赖子：启用，最多 ${pack.wildcard.maxCount} 张，可按天然形态使用：${pack.wildcard.allowAsNatural ? '是' : '否'}`);
  } else {
    lines.push('- 赖子：不启用');
  }
  lines.push('');

  lines.push('## 2. 胡牌结构');
  lines.push('');
  lines.push(`- 标准牌型（n 面子 + 1 将）：${pack.winStructures.standard ? '允许' : '不允许'}`);
  lines.push(`- 七对：${pack.winStructures.sevenPairs ? '允许' : '不允许'}${pack.winStructures.allowQuadInSevenPairs ? '（四张同种算两对）' : ''}`);
  lines.push(`- 十三幺：${pack.winStructures.thirteenOrphans ? '允许' : '不允许'}`);
  lines.push(`- 定缺要求：${pack.requirements.requireMissingSuit ? '必须缺一门' : '无'}`);
  lines.push('');

  lines.push('## 3. 吃碰杠与边角规则');
  lines.push('');
  lines.push(`- 动作优先级（高 → 低）：${pack.claim.order.join(' > ')}`);
  lines.push(`- 一炮多响：${pack.claim.multiWin ? '允许（多家同时胡）' : '不允许（取首家）'}`);
  lines.push(`- 抢杠胡：${pack.claim.robbingKong ? '允许' : '不允许'}`);
  lines.push(`- 杠上开花：${pack.claim.supplementKong ? '允许' : '不允许'}`);
  lines.push(`- 海底捞月加番：${pack.claim.lastTileBonus ? '是' : '否'}`);
  lines.push('');

  lines.push('## 4. 计分与番种');
  lines.push('');
  lines.push(`- 计分模式：${pack.scoring.mode === 'additive' ? '番数累加' : '倍数相乘'}`);
  lines.push(`- 起胡番：${pack.scoring.minFan}`);
  lines.push(`- 封顶：${pack.scoring.cap === null ? '不封顶' : pack.scoring.cap}`);
  if (pack.scoring.mode === 'multiplicative' && pack.scoring.baseScore !== undefined) {
    lines.push(`- 底分：${pack.scoring.baseScore}`);
  }
  lines.push('');
  lines.push('| 番种 | 判定谓词 | 番值/倍数 | 约束 |');
  lines.push('| --- | --- | --- | --- |');
  for (const fan of pack.fans) lines.push(fanLine(fan, pack.fans));
  lines.push('');

  if (pack.documentation?.notes?.length) {
    lines.push('## 5. 策划备注');
    lines.push('');
    for (const note of pack.documentation.notes) lines.push(`- ${note}`);
    lines.push('');
  }

  lines.push('---');
  lines.push(`*本文档由规则包 ${pack.id}@${pack.version} 自动生成，修改规则请在配置台操作并升版本号。*`);
  return lines.join('\n');
}
