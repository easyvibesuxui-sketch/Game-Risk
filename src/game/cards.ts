import type { Rng } from "./combat";
import { TERRITORIES } from "./map";

export type CardSymbol = "infantry" | "cavalry" | "artillery" | "wild";

export interface Card {
  id: string;
  territory: string | null;
  symbol: CardSymbol;
}

const SYMBOLS: CardSymbol[] = ["infantry", "cavalry", "artillery"];

export function buildDeck(rng: Rng): Card[] {
  const cards: Card[] = TERRITORIES.map((t, i) => ({ id: t.id, territory: t.id, symbol: SYMBOLS[i % 3] }));
  cards.push({ id: "wild-1", territory: null, symbol: "wild" }, { id: "wild-2", territory: null, symbol: "wild" });
  return shuffle(cards, rng);
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Three of a kind or one of each; a wild stands in for anything. */
export function isValidSet(cards: Card[]): boolean {
  if (cards.length !== 3) return false;
  const plain = cards.filter((c) => c.symbol !== "wild").map((c) => c.symbol);
  const kinds = new Set(plain).size;
  return kinds <= 1 || kinds === plain.length;
}

/** 4, 6, 8, 10, 12, 15, then +5 for every later set. */
export function tradeValue(tradeIndex: number): number {
  const table = [4, 6, 8, 10, 12, 15];
  return tradeIndex < table.length ? table[tradeIndex] : 15 + 5 * (tradeIndex - 5);
}

export function findSet(cards: Card[], preferOwned: (c: Card) => boolean = () => false): Card[] | null {
  let best: Card[] | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < cards.length; i++)
    for (let j = i + 1; j < cards.length; j++)
      for (let k = j + 1; k < cards.length; k++) {
        const set = [cards[i], cards[j], cards[k]];
        if (!isValidSet(set)) continue;
        const score = set.filter(preferOwned).length * 2 - set.filter((c) => c.symbol === "wild").length;
        if (score > bestScore) {
          best = set;
          bestScore = score;
        }
      }
  return best;
}
