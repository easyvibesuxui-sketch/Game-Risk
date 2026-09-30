import { findSet } from "./cards";
import type { Rng } from "./combat";
import {
  attack,
  endAttack,
  endTurn,
  fortify,
  occupy,
  ownedContinents,
  placeArmies,
  reachable,
  territoriesOf,
  tradeCards,
  type Difficulty,
  type GameState,
} from "./engine";
import { CONTINENTS, TERRITORY_BY_ID, continentTerritories } from "./map";

interface Profile {
  /** Attacker armies (minus the one left behind) per defender needed to attack. */
  minRatio: number;
  /** Smallest stack that will start an attack. */
  minStack: number;
  /** Stop attacking after this many captures in one turn. */
  maxCaptures: number;
  /** Weight on finishing continents. */
  continentWeight: number;
  /** Bonus for attacking a rival who holds a whole continent. */
  breakBonus: number;
  /** Extra appetite for hitting the strongest rival. */
  leaderBonus: number;
  /** Chance of placing the draft on a random border instead of the best one. */
  sloppyDraft: number;
  fortifies: boolean;
}

export const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    minRatio: 2.5,
    minStack: 4,
    maxCaptures: 1,
    continentWeight: 0,
    breakBonus: 0,
    leaderBonus: 0,
    sloppyDraft: 0.85,
    fortifies: false,
  },
  medium: {
    minRatio: 1.25,
    minStack: 3,
    maxCaptures: Infinity,
    continentWeight: 2,
    breakBonus: 0.8,
    leaderBonus: 0,
    sloppyDraft: 0,
    fortifies: true,
  },
  hard: {
    minRatio: 1.05,
    minStack: 3,
    maxCaptures: Infinity,
    continentWeight: 3.5,
    breakBonus: 2.2,
    leaderBonus: 1.2,
    sloppyDraft: 0,
    fortifies: true,
  },
};

const enemyNeighbors = (s: GameState, t: string) =>
  TERRITORY_BY_ID[t].neighbors.filter((n) => s.owner[n] !== s.owner[t]);

const threat = (s: GameState, t: string) =>
  enemyNeighbors(s, t).reduce((n, e) => n + s.armies[e], 0);

/** How much the player wants each continent: share already held, weighted by its bonus. */
function continentWish(s: GameState, player: number): Record<string, number> {
  const wish: Record<string, number> = {};
  for (const c of CONTINENTS) {
    const ids = continentTerritories(c.id);
    const held = ids.filter((t) => s.owner[t] === player).length;
    wish[c.id] = (held / ids.length) * (1 + c.bonus / ids.length);
  }
  return wish;
}

function strength(s: GameState, player: number): number {
  return territoriesOf(s, player).reduce((n, t) => n + s.armies[t], 0) + territoriesOf(s, player).length * 2;
}

function leader(s: GameState): number {
  let best = -1;
  let score = -1;
  for (const p of s.players) {
    if (!p.alive || p.id === s.current) continue;
    const v = strength(s, p.id);
    if (v > score) {
      score = v;
      best = p.id;
    }
  }
  return best;
}

function pickDraftTarget(s: GameState, profile: Profile, rng: Rng): string {
  const me = s.current;
  const own = territoriesOf(s, me);
  const border = own.filter((t) => enemyNeighbors(s, t).length > 0);
  if (border.length && rng() < profile.sloppyDraft) return border[Math.floor(rng() * border.length)];

  const wish = continentWish(s, me);
  let best = "";
  let bestScore = -Infinity;
  for (const t of border) {
    const enemies = enemyNeighbors(s, t);
    const weakest = Math.min(...enemies.map((e) => s.armies[e]));
    const score =
      wish[TERRITORY_BY_ID[t].continent] * profile.continentWeight * 2 +
      enemies.filter((e) => TERRITORY_BY_ID[e].continent === TERRITORY_BY_ID[t].continent).length -
      weakest * 0.3 +
      Math.min(threat(s, t), 12) * 0.15 +
      s.armies[t] * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best || own[0];
}

function pickAttack(s: GameState, profile: Profile): [string, string] | null {
  if (s.captures >= profile.maxCaptures) return null;
  const me = s.current;
  const wish = continentWish(s, me);
  const top = profile.leaderBonus ? leader(s) : -1;
  const whole = new Set<string>();
  for (const p of s.players) {
    if (p.id !== me && p.alive) for (const c of ownedContinents(s, p.id)) whole.add(c.id);
  }

  let best: [string, string] | null = null;
  let bestScore = 0;
  for (const from of territoriesOf(s, me)) {
    const a = s.armies[from];
    if (a < profile.minStack) continue;
    for (const to of enemyNeighbors(s, from)) {
      const d = s.armies[to];
      const ratio = (a - 1) / d;
      // A huge stack stops being timid, so cautious rivals never sit still forever.
      const needed = a >= 12 ? Math.min(profile.minRatio, 1.3) : profile.minRatio;
      if (ratio < needed && !(a >= 4 && d === 1)) continue;
      const cont = TERRITORY_BY_ID[to].continent;
      const defender = s.owner[to];
      const defenderLeft = territoriesOf(s, defender).length;
      const score =
        ratio +
        wish[cont] * profile.continentWeight +
        (whole.has(cont) ? profile.breakBonus : 0) +
        (defender === top ? profile.leaderBonus : 0) +
        (defenderLeft <= 2 ? 1.5 : 0) +
        (s.conquered ? 0 : 0.5);
      if (score > bestScore) {
        bestScore = score;
        best = [from, to];
      }
    }
  }
  return best;
}

function pickFortify(s: GameState): [string, string, number] | null {
  const me = s.current;
  const interior = territoriesOf(s, me)
    .filter((t) => s.armies[t] > 1 && enemyNeighbors(s, t).length === 0)
    .sort((x, y) => s.armies[y] - s.armies[x]);
  for (const from of interior) {
    const targets = [...reachable(s, from)].filter((t) => enemyNeighbors(s, t).length > 0);
    if (!targets.length) continue;
    targets.sort((x, y) => threat(s, y) - s.armies[y] - (threat(s, x) - s.armies[x]));
    return [from, targets[0], s.armies[from] - 1];
  }
  return null;
}

/**
 * One AI action. Returns null on the human's turn, when the game is over,
 * or when there is nothing to do, so the caller can keep the same state reference.
 */
export function aiStep(s: GameState, rng: Rng = Math.random): GameState | null {
  if (s.phase === "gameover" || s.players[s.current].human) return null;
  const me = s.players[s.current];
  const profile = PROFILES[s.difficulty ?? "medium"];

  switch (s.phase) {
    case "setup":
      return null;
    case "draft": {
      const owned = (id: string | null) => !!id && s.owner[id] === s.current;
      if (me.cards.length >= 3) {
        const set = findSet(me.cards, (c) => owned(c.territory));
        const eager = s.difficulty === "hard" || (s.difficulty !== "easy" && (s.trades >= 3 || s.reserve < 6));
        if (set && (me.cards.length >= 5 || eager)) {
          return tradeCards(
            s,
            set.map((c) => c.id),
          );
        }
      }
      if (s.reserve === 0) return { ...s, phase: "attack", resumeAttack: false };
      return placeArmies(s, pickDraftTarget(s, profile, rng), s.reserve);
    }
    case "attack": {
      const move = pickAttack(s, profile);
      if (!move) return endAttack(s);
      return attack(s, move[0], move[1], 3, rng);
    }
    case "occupy": {
      if (!s.occupy) return null;
      const { from, max, min } = s.occupy;
      const stillExposed = enemyNeighbors(s, from).length > 0;
      const n = stillExposed ? Math.max(min, Math.ceil(max * 0.6)) : max;
      return occupy(s, n);
    }
    case "fortify": {
      const move = profile.fortifies ? pickFortify(s) : null;
      return move ? fortify(s, ...move) : endTurn(s);
    }
  }
  return null;
}
