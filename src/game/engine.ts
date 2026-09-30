import { buildDeck, isValidSet, shuffle, tradeValue, type Card } from "./cards";
import { resolveAttack, rollDice, type Rng } from "./combat";
import { FACTIONS, FACTION_BY_ID, type FactionId } from "./factions";
import { CONTINENTS, TERRITORIES, TERRITORY_BY_ID, areNeighbors, continentTerritories } from "./map";

export type Phase = "setup" | "draft" | "attack" | "occupy" | "fortify" | "gameover";

export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export interface Player {
  id: number;
  name: string;
  faction: FactionId;
  color: string;
  human: boolean;
  cards: Card[];
  alive: boolean;
}

export interface Battle {
  from: string;
  to: string;
  attacker: number;
  defender: number;
  attack: number[];
  defend: number[];
  attackerLost: number;
  defenderLost: number;
  conquered: boolean;
}

export interface GameState {
  version: 1;
  difficulty: Difficulty;
  turn: number;
  players: Player[];
  owner: Record<string, number>;
  armies: Record<string, number>;
  current: number;
  phase: Phase;
  /** Armies the current player still has to place (setup and draft). */
  reserve: number;
  deck: Card[];
  discard: Card[];
  trades: number;
  conquered: boolean;
  /** Territories the current player has taken this turn. */
  captures: number;
  occupy: { from: string; to: string; min: number; max: number } | null;
  /** After an elimination hands over 6+ cards, trading happens mid-attack. */
  resumeAttack: boolean;
  lastBattle: Battle | null;
  log: string[];
  winner: number | null;
}

/** Total starting armies per player, by player count. */
export const STARTING_ARMIES: Record<number, number> = { 2: 40, 3: 35, 4: 30, 5: 25, 6: 20 };

const LOG_LIMIT = 60;

function withLog(s: GameState, line: string): GameState {
  return { ...s, log: [line, ...s.log].slice(0, LOG_LIMIT) };
}

export const playerName = (s: GameState, id: number) => s.players[id].name;

export function territoriesOf(s: GameState, player: number): string[] {
  return TERRITORIES.filter((t) => s.owner[t.id] === player).map((t) => t.id);
}

export function ownedContinents(s: GameState, player: number) {
  return CONTINENTS.filter((c) => continentTerritories(c.id).every((t) => s.owner[t] === player));
}

export function reinforcements(s: GameState, player: number): number {
  const count = territoriesOf(s, player).length;
  const bonus = ownedContinents(s, player).reduce((n, c) => n + c.bonus, 0);
  return Math.max(3, Math.floor(count / 3)) + bonus;
}

export interface CreateOptions {
  difficulty?: Difficulty;
  rng?: Rng;
}

export function create(
  name: string,
  opponents: number,
  faction: FactionId,
  { difficulty = "medium", rng = Math.random }: CreateOptions = {},
): GameState {
  if (!DIFFICULTIES.includes(difficulty)) throw new Error(`Unknown difficulty ${difficulty}.`);
  if (!Number.isInteger(opponents) || opponents < 1 || opponents > FACTIONS.length - 1) {
    throw new Error(`Choose between 1 and ${FACTIONS.length - 1} opponents.`);
  }
  if (!FACTION_BY_ID[faction]) throw new Error(`Unknown faction ${faction}.`);

  const others = shuffle(
    FACTIONS.filter((f) => f.id !== faction),
    rng,
  ).slice(0, opponents);
  const lineup = [FACTION_BY_ID[faction], ...others];
  const players: Player[] = lineup.map((f, i) => ({
    id: i,
    name: i === 0 ? name.trim() || f.leader : f.leader,
    faction: f.id,
    color: f.color,
    human: i === 0,
    cards: [],
    alive: true,
  }));

  // Deal territories round-robin from a shuffled list, one army each.
  const owner: Record<string, number> = {};
  const armies: Record<string, number> = {};
  shuffle(
    TERRITORIES.map((t) => t.id),
    rng,
  ).forEach((id, i) => {
    owner[id] = i % players.length;
    armies[id] = 1;
  });

  let s: GameState = {
    version: 1,
    difficulty,
    turn: 0,
    players,
    owner,
    armies,
    current: 0,
    phase: "setup",
    reserve: 0,
    deck: buildDeck(rng),
    discard: [],
    trades: 0,
    conquered: false,
    captures: 0,
    occupy: null,
    resumeAttack: false,
    lastBattle: null,
    log: [],
    winner: null,
  };

  const total = STARTING_ARMIES[players.length];
  // Opponents deploy their opening reserve at once; the human places theirs on the board.
  for (const p of players.slice(1)) {
    s = autoDeploy(s, p.id, total - territoriesOf(s, p.id).length, rng);
  }
  s = { ...s, reserve: total - territoriesOf(s, 0).length };
  return withLog(s, `The campaign begins. ${players.length} realms contest the world.`);
}

/** Spread armies over a player's most exposed territories (used for AI openings). */
export function autoDeploy(s: GameState, player: number, count: number, rng: Rng = Math.random): GameState {
  const armies = { ...s.armies };
  const own = territoriesOf(s, player);
  const border = own.filter((t) => TERRITORY_BY_ID[t].neighbors.some((n) => s.owner[n] !== player));
  const pool = border.length ? border : own;
  for (let i = 0; i < count; i++) {
    const pick = pool[Math.floor(rng() * pool.length)];
    armies[pick] += 1;
  }
  return { ...s, armies };
}

function assertCurrent(s: GameState, phase: Phase | Phase[]) {
  const phases = Array.isArray(phase) ? phase : [phase];
  if (!phases.includes(s.phase)) throw new Error(`Not allowed during ${s.phase}.`);
}

export function mustTrade(s: GameState): boolean {
  return s.phase === "draft" && s.players[s.current].cards.length >= 5;
}

export function placeArmies(s: GameState, territory: string, count = 1): GameState {
  assertCurrent(s, ["setup", "draft"]);
  if (s.owner[territory] !== s.current) throw new Error("You can only reinforce your own territory.");
  if (mustTrade(s)) throw new Error("You hold five or more cards: trade a set first.");
  const n = Math.min(Math.max(1, Math.floor(count)), s.reserve);
  if (n <= 0) throw new Error("No armies left to place.");
  let next: GameState = {
    ...s,
    armies: { ...s.armies, [territory]: s.armies[territory] + n },
    reserve: s.reserve - n,
  };
  if (next.reserve === 0) {
    if (next.phase === "setup") next = beginTurn(next, 0);
    else next = { ...next, phase: "attack", resumeAttack: false };
  }
  return next;
}

export function tradeCards(s: GameState, cardIds: string[]): GameState {
  assertCurrent(s, "draft");
  const player = s.players[s.current];
  const cards = cardIds.map((id) => player.cards.find((c) => c.id === id));
  if (cards.some((c) => !c) || new Set(cardIds).size !== 3) throw new Error("Pick three of your cards.");
  const set = cards as Card[];
  if (!isValidSet(set)) throw new Error("That is not a set: three alike or one of each.");

  const value = tradeValue(s.trades);
  const armies = { ...s.armies };
  const ownedCard = set.find((c) => c.territory && s.owner[c.territory] === s.current);
  if (ownedCard?.territory) armies[ownedCard.territory] += 2;

  const players = s.players.map((p) =>
    p.id === s.current ? { ...p, cards: p.cards.filter((c) => !cardIds.includes(c.id)) } : p,
  );
  const extra = ownedCard?.territory ? ` (+2 on ${TERRITORY_BY_ID[ownedCard.territory].name})` : "";
  return withLog(
    { ...s, players, armies, reserve: s.reserve + value, trades: s.trades + 1, discard: [...s.discard, ...set] },
    `${player.name} trades a set for ${value} armies${extra}.`,
  );
}

export function maxAttackDice(s: GameState, from: string): number {
  return Math.min(3, s.armies[from] - 1);
}

export function canAttack(s: GameState, from: string, to: string): boolean {
  return (
    s.phase === "attack" &&
    s.owner[from] === s.current &&
    s.owner[to] !== s.current &&
    s.armies[from] >= 2 &&
    areNeighbors(from, to)
  );
}

export function attack(s: GameState, from: string, to: string, dice: number, rng: Rng = Math.random): GameState {
  if (!canAttack(s, from, to)) throw new Error("That attack is not possible.");
  const attackerDice = Math.max(1, Math.min(dice, maxAttackDice(s, from)));
  const defenderDice = Math.min(2, s.armies[to]);
  const roll = resolveAttack(rollDice(attackerDice, rng), rollDice(defenderDice, rng));
  const defender = s.owner[to];
  const armies = { ...s.armies };
  armies[from] -= roll.attackerLost;
  armies[to] -= roll.defenderLost;
  const conquered = armies[to] === 0;
  const battle: Battle = {
    from,
    to,
    attacker: s.current,
    defender,
    ...roll,
    conquered,
  };
  let next: GameState = { ...s, armies, lastBattle: battle };
  if (!conquered) return next;

  const owner = { ...s.owner, [to]: s.current };
  next = withLog(
    { ...next, owner, conquered: true, captures: next.captures + 1 },
    `${playerName(s, s.current)} takes ${TERRITORY_BY_ID[to].name} from ${playerName(s, defender)}.`,
  );

  if (territoriesOf(next, defender).length === 0) next = eliminate(next, defender);
  const worldTaken = territoriesOf(next, s.current).length === TERRITORIES.length;
  const humanFallen = !next.players[0].alive;
  if (worldTaken || humanFallen) {
    const moved = { ...next.armies, [from]: 1, [to]: armies[from] - 1 };
    const line = worldTaken
      ? `${playerName(s, s.current)} rules the whole world.`
      : `${playerName(s, 0)} has fallen.`;
    return withLog({ ...next, armies: moved, phase: "gameover", winner: s.current, occupy: null }, line);
  }
  return { ...next, phase: "occupy", occupy: { from, to, min: attackerDice, max: armies[from] - 1 } };
}

function eliminate(s: GameState, loser: number): GameState {
  const taken = s.players[loser].cards;
  const players = s.players.map((p) => {
    if (p.id === loser) return { ...p, alive: false, cards: [] };
    if (p.id === s.current) return { ...p, cards: [...p.cards, ...taken] };
    return p;
  });
  return withLog(
    { ...s, players },
    `${playerName(s, loser)} is destroyed${taken.length ? ` and yields ${taken.length} cards` : ""}.`,
  );
}

export function occupy(s: GameState, count: number): GameState {
  assertCurrent(s, "occupy");
  if (!s.occupy) throw new Error("Nothing to occupy.");
  const { from, to, min, max } = s.occupy;
  const n = Math.min(max, Math.max(min, Math.floor(count)));
  const armies = { ...s.armies, [from]: s.armies[from] - n, [to]: n };
  const next: GameState = { ...s, armies, occupy: null, phase: "attack" };
  // Six or more cards after an elimination: trade down now, then keep attacking.
  if (next.players[s.current].cards.length >= 6) {
    return { ...next, phase: "draft", reserve: 0, resumeAttack: true };
  }
  return next;
}

export function endAttack(s: GameState): GameState {
  assertCurrent(s, "attack");
  return { ...s, phase: "fortify" };
}

export function reachable(s: GameState, from: string): Set<string> {
  const player = s.owner[from];
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const t = queue.shift()!;
    for (const n of TERRITORY_BY_ID[t].neighbors) {
      if (!seen.has(n) && s.owner[n] === player) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  seen.delete(from);
  return seen;
}

export function fortify(s: GameState, from: string, to: string, count: number): GameState {
  assertCurrent(s, "fortify");
  if (s.owner[from] !== s.current || s.owner[to] !== s.current) throw new Error("Both territories must be yours.");
  if (!reachable(s, from).has(to)) throw new Error("No friendly path between those territories.");
  const n = Math.min(s.armies[from] - 1, Math.max(1, Math.floor(count)));
  if (n < 1) throw new Error("At least one army must stay behind.");
  const moved: GameState = {
    ...s,
    armies: { ...s.armies, [from]: s.armies[from] - n, [to]: s.armies[to] + n },
  };
  return endTurn(
    withLog(moved, `${playerName(s, s.current)} marches ${n} from ${TERRITORY_BY_ID[from].name} to ${TERRITORY_BY_ID[to].name}.`),
  );
}

function drawCard(s: GameState): GameState {
  let deck = s.deck;
  let discard = s.discard;
  if (deck.length === 0) {
    deck = shuffle(discard, Math.random);
    discard = [];
  }
  if (deck.length === 0) return s;
  const [card, ...rest] = deck;
  const players = s.players.map((p) => (p.id === s.current ? { ...p, cards: [...p.cards, card] } : p));
  return { ...s, deck: rest, discard, players };
}

export function endTurn(s: GameState): GameState {
  assertCurrent(s, ["attack", "fortify"]);
  let next = s.conquered ? drawCard(s) : s;
  const count = next.players.length;
  let id = next.current;
  do id = (id + 1) % count;
  while (!next.players[id].alive);
  next = beginTurn(next, id);
  return next;
}

function beginTurn(s: GameState, player: number): GameState {
  const turn = player <= s.current || s.phase === "setup" ? s.turn + 1 : s.turn;
  const reserve = reinforcements(s, player);
  return withLog(
    {
      ...s,
      turn,
      current: player,
      phase: "draft",
      reserve,
      conquered: false,
      captures: 0,
      occupy: null,
      resumeAttack: false,
    },
    `${playerName(s, player)} musters ${reserve} armies.`,
  );
}

export const GameState = { create };
