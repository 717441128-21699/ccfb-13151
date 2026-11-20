import { wuhan } from "./wuhan.js";
import { sichuan } from "./sichuan.js";
import { mcr } from "./mcr.js";
import { guangdong } from "./guangdong.js";
import { changsha } from "./changsha.js";
export { wuhan, sichuan, mcr, guangdong, changsha };
export const builtinPacks = [wuhan, sichuan, mcr, guangdong, changsha];
export function getPack(id) {
    const p = builtinPacks.find((x) => x.id === id);
    if (!p)
        throw new Error(`未知规则包: ${id}(可选:${builtinPacks.map((x) => x.id).join(', ')})`);
    return p;
}
