import { Percept } from "../domain/types.js";

// Very simple discrete state encoding.
// Includes agent pos, relative target direction, and 4 blocked flags.
export function toStateKey(p: Percept): string {
  const dx = Math.sign(p.target.x - p.agent.x); // -1,0,1
  const dy = Math.sign(p.target.y - p.agent.y);
  const b = p.blocked;
  return [
    `x${p.agent.x}`, `y${p.agent.y}`,
    `dx${dx}`, `dy${dy}`,
    `u${b.up?1:0}`, `d${b.down?1:0}`, `l${b.left?1:0}`, `r${b.right?1:0}`
  ].join("|");
}
