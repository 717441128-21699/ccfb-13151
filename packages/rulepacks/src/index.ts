import type { RulePack } from '../../core/src/rule.ts';
import { wuhan } from './wuhan.ts';
import { sichuan } from './sichuan.ts';
import { mcr } from './mcr.ts';
import { guangdong } from './guangdong.ts';
import { changsha } from './changsha.ts';

export { wuhan, sichuan, mcr, guangdong, changsha };

export const builtinPacks: RulePack[] = [wuhan, sichuan, mcr, guangdong, changsha];

export function getPack(id: string): RulePack {
  const p = builtinPacks.find((x) => x.id === id);
  if (!p) throw new Error(`未知规则包: ${id}(可选:${builtinPacks.map((x) => x.id).join(', ')})`);
  return p;
}
