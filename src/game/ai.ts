import { findSet } from "./cards";
import type { Rng } from "./combat";
import {
  attack,
  endAttack,
  endTurn,
  fortify,
  occupy,
  placeArmies,
  reachable,
  territoriesOf,
  tradeCards,
  type GameState,
} from "./engine";
import { CONTINENTS, TERRITORY_BY_ID, continentTerritories } from "./map";

const enemyNeighbors = (s: GameState, t: string) =>
  TERRITORY_BY_ID[t].neighbors.filter((n) => s.owner[n] !== s.owner[t]);

const threat = (s: GameState, t: string) =>
  enemyNeighbors(s, t).reduce((n, e) => n + s.armies[e], 0);

/** How much the player wants each continent: share already held, cheap to finish. */
function continentWish(s: GameState, player: number): Record<string, number> {
  const wish: Record<string, number> = {};
  for (const c of CONTINENTS) {
    const ids = continentTerritories(c.id);
    const held = ids.filter((t) => s.owner[t] === player).length;
    wish[c.id] = (held / ids.length) * (1 + c.bonus / ids.length);
  }
  return wish;
}

function pickDraftTarget(s: GameState): string {
  const me = s.current;
  const wish = continentWish(s, me);
  let best = "";
  let bestScore = -Infinity;
  for (const t of territoriesOf(s, me)) {
    const enemies = enemyNeighbors(s, t);
    if (!enemies.length) continue;
    const weakest = Math.min(...enemies.map((e) => s.armies[e]));
    const score =
      wish[TERRITORY_BY_ID[t].continent] * 4 +
      enemies.filter((e) => TERRITORY_BY_ID[e].continent === TERRITORY_BY_ID[t].continent).length -
      weakest * 0.3 +
      Math.min(threat(s, t), 12) * 0.15;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best || territoriesOf(s, me)[0];
}

function pickAttack(s: GameState): [string, string] | null {
  const me = s.current;
  const wish = continentWish(s, me);
  let best: [string, string] | null = null;
  let bestScore = 0;
  for (const from of territoriesOf(s, me)) {
    const a = s.armies[from];
    if (a < 3) continue;
    for (const to of enemyNeighbors(s, from)) {
      const d = s.armies[to];
      const ratio = (a - 1) / d;
      if (ratio < 1.25 && !(a >= 4 && d === 1)) continue;
      const cont = TERRITORY_BY_ID[to].continent;
      const defenderLeft = territoriesOf(s, s.owner[to]).length;
      const score = ratio + wish[cont] * 2 + (defenderLeft <= 2 ? 1.5 : 0) + (s.conquered ? 0 : 0.5);
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
  const own = territoriesOf(s, me);
  const interior = own
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

  switch (s.phase) {
    case "setup":
      return null;
    case "draft": {
      const owned = (id: string | null) => !!id && s.owner[id] === s.current;
      if (me.cards.length >= 3) {
        const set = findSet(me.cards, (c) => owned(c.territory));
        if (set && (me.cards.length >= 5 || s.trades >= 3 || s.reserve < 6)) {
          return tradeCards(
            s,
            set.map((c) => c.id),
          );
        }
      }
      if (s.reserve === 0) return { ...s, phase: "attack", resumeAttack: false };
      return placeArmies(s, pickDraftTarget(s), s.reserve);
    }
    case "attack": {
      const move = pickAttack(s);
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
      const move = pickFortify(s);
      return move ? fortify(s, ...move) : endTurn(s);
    }
  }
  return null;
}
