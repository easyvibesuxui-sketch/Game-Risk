export type Rng = () => number;

export interface RollResult {
  attack: number[];
  defend: number[];
  attackerLost: number;
  defenderLost: number;
}

export const rollDie = (rng: Rng) => 1 + Math.floor(rng() * 6);

export function rollDice(count: number, rng: Rng): number[] {
  return Array.from({ length: count }, () => rollDie(rng)).sort((a, b) => b - a);
}

/** Attacker 1–3 dice vs defender 1–2, compared high to high. Defender wins ties. */
export function resolveAttack(attack: number[], defend: number[]): RollResult {
  const a = [...attack].sort((x, y) => y - x);
  const d = [...defend].sort((x, y) => y - x);
  let attackerLost = 0;
  let defenderLost = 0;
  for (let i = 0; i < Math.min(a.length, d.length); i++) {
    if (a[i] > d[i]) defenderLost++;
    else attackerLost++;
  }
  return { attack: a, defend: d, attackerLost, defenderLost };
}

export const resolve_attack = resolveAttack;
