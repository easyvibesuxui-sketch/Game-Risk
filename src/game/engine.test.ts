import { describe, expect, it } from "vitest";
import { aiStep } from "./ai";
import { isValidSet, tradeValue, type Card } from "./cards";
import { resolveAttack } from "./combat";
import {
  STARTING_ARMIES,
  attack,
  create,
  endAttack,
  fortify,
  placeArmies,
  reinforcements,
  territoriesOf,
  type GameState,
} from "./engine";
import { CONTINENTS, TERRITORIES, TERRITORY_BY_ID } from "./map";
import { LABEL_POINTS, TERRITORY_PATHS } from "./map-shapes";

function seeded(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

describe("map", () => {
  it("has 42 territories with symmetric neighbours and geometry", () => {
    expect(TERRITORIES).toHaveLength(42);
    for (const t of TERRITORIES) {
      for (const n of t.neighbors) expect(TERRITORY_BY_ID[n].neighbors).toContain(t.id);
      expect(TERRITORY_PATHS[t.id]?.length).toBeGreaterThan(20);
      expect(LABEL_POINTS[t.id]).toBeDefined();
    }
  });

  it("keeps the classic bonuses", () => {
    expect(Object.fromEntries(CONTINENTS.map((c) => [c.id, c.bonus]))).toEqual({
      na: 5, sa: 2, eu: 5, af: 3, as: 7, au: 2,
    });
  });
});

describe("combat", () => {
  it("compares high to high and gives ties to the defender", () => {
    expect(resolveAttack([6, 3, 1], [6, 2])).toMatchObject({ attackerLost: 1, defenderLost: 1 });
    expect(resolveAttack([5], [5, 5])).toMatchObject({ attackerLost: 1, defenderLost: 0 });
    expect(resolveAttack([6, 6], [5, 5])).toMatchObject({ attackerLost: 0, defenderLost: 2 });
  });
});

describe("cards", () => {
  const c = (symbol: Card["symbol"], id = symbol + Math.random()): Card => ({ id, territory: null, symbol });
  it("accepts three alike, one of each, and wilds", () => {
    expect(isValidSet([c("infantry"), c("infantry"), c("infantry")])).toBe(true);
    expect(isValidSet([c("infantry"), c("cavalry"), c("artillery")])).toBe(true);
    expect(isValidSet([c("infantry"), c("wild"), c("artillery")])).toBe(true);
    expect(isValidSet([c("infantry"), c("infantry"), c("artillery")])).toBe(false);
  });
  it("escalates trade values", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(tradeValue)).toEqual([4, 6, 8, 10, 12, 15, 20, 25]);
  });
});

describe("engine", () => {
  it("deals every territory and gives the human the right reserve", () => {
    const s = create("Tester", 2, "elves", seeded(1));
    expect(Object.keys(s.owner)).toHaveLength(42);
    expect(s.phase).toBe("setup");
    expect(s.reserve).toBe(STARTING_ARMIES[3] - territoriesOf(s, 0).length);
    for (const p of [1, 2]) {
      const total = territoriesOf(s, p).reduce((n, t) => n + s.armies[t], 0);
      expect(total).toBe(STARTING_ARMIES[3]);
    }
  });

  it("moves from setup to the first draft once the reserve is placed", () => {
    let s = create("Tester", 1, "humans", seeded(2));
    const mine = territoriesOf(s, 0)[0];
    const before = s.armies[mine];
    s = placeArmies(s, mine, 1);
    expect(s.armies[mine]).toBe(before + 1);
    s = placeArmies(s, mine, s.reserve);
    expect(s.phase).toBe("draft");
    expect(s.reserve).toBe(reinforcements(s, 0));
  });

  it("rejects placing on an enemy territory", () => {
    const s = create("Tester", 1, "humans", seeded(3));
    const theirs = territoriesOf(s, 1)[0];
    expect(() => placeArmies(s, theirs)).toThrow();
  });

  it("fortifies only along a friendly path", () => {
    let s = create("Tester", 1, "orcs", seeded(4));
    s = placeArmies(s, territoriesOf(s, 0)[0], s.reserve);
    s = placeArmies(s, territoriesOf(s, 0)[0], s.reserve);
    s = endAttack(s);
    const own = territoriesOf(s, 0);
    const from = own[0];
    const stranger = own.find((t) => t !== from && !TERRITORY_BY_ID[from].neighbors.includes(t) && s.owner[t] === 0);
    const isolated = stranger && !TERRITORY_BY_ID[stranger].neighbors.some((n) => s.owner[n] === 0);
    if (stranger && isolated) expect(() => fortify(s, from, stranger, 1)).toThrow();
  });

  it("finishes an all-AI campaign with one winner", () => {
    const rng = seeded(7);
    let s: GameState = create("Tester", 4, "dwarves", rng);
    s = { ...s, players: s.players.map((p) => ({ ...p, human: false })) };
    s = placeArmies(s, territoriesOf(s, 0)[0], s.reserve);
    let steps = 0;
    while (s.phase !== "gameover" && steps < 60000) {
      const next = aiStep(s, rng);
      expect(next).not.toBeNull();
      s = next!;
      steps++;
      const total = Object.values(s.armies);
      expect(total.every((a) => a >= 1 || s.phase === "occupy")).toBe(true);
    }
    // The human (player 0) falling also ends the campaign.
    expect(s.phase).toBe("gameover");
  });

  it("an attack never leaves the attacker below one army", () => {
    let s = create("Tester", 1, "northmen", seeded(9));
    s = placeArmies(s, territoriesOf(s, 0)[0], s.reserve);
    const from = territoriesOf(s, 0).find((t) => TERRITORY_BY_ID[t].neighbors.some((n) => s.owner[n] === 1))!;
    s = placeArmies(s, from, s.reserve);
    const to = TERRITORY_BY_ID[from].neighbors.find((n) => s.owner[n] === 1)!;
    const r = attack(s, from, to, 3, seeded(11));
    expect(r.armies[from]).toBeGreaterThanOrEqual(1);
  });
});

describe("findSet", () => {
  it("finds a set that needs a wild", async () => {
    const { findSet } = await import("./cards");
    const cards: Card[] = [
      { id: "a", territory: null, symbol: "artillery" },
      { id: "w", territory: null, symbol: "wild" },
      { id: "b", territory: null, symbol: "artillery" },
      { id: "c", territory: null, symbol: "infantry" },
      { id: "d", territory: null, symbol: "infantry" },
    ];
    expect(findSet(cards)).not.toBeNull();
  });
});
