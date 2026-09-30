import type { Card } from "../game/cards";
import { isValidSet, tradeValue } from "../game/cards";
import { mustTrade, reinforcements, territoriesOf, type GameState } from "../game/engine";
import { FACTION_BY_ID, emblemUrl, portraitUrl } from "../game/factions";
import { TERRITORY_BY_ID } from "../game/map";

export type PlaceAmount = 1 | 5 | "all";

interface Props {
  state: GameState;
  status: string;
  selected: string | null;
  fortifyTo: string | null;
  dice: number;
  maxDice: number;
  place: PlaceAmount;
  moveCount: number;
  selectedCards: string[];
  blitzTarget: string | null;
  muted: boolean;
  onDice: (n: number) => void;
  onPlace: (p: PlaceAmount) => void;
  onMoveCount: (n: number) => void;
  onToggleCard: (id: string) => void;
  onTrade: () => void;
  onBlitz: () => void;
  onEndAttack: () => void;
  onOccupy: () => void;
  onFortify: () => void;
  onEndTurn: () => void;
  onCancel: () => void;
  onMute: () => void;
  onAbandon: () => void;
}

const SYMBOL_LABEL: Record<Card["symbol"], string> = {
  infantry: "Spear",
  cavalry: "Horse",
  artillery: "Siege",
  wild: "Crown",
};

function Die({ value, side }: { value: number; side: "att" | "def" }) {
  const pips: Record<number, [number, number][]> = {
    1: [[2, 2]],
    2: [[1, 1], [3, 3]],
    3: [[1, 1], [2, 2], [3, 3]],
    4: [[1, 1], [3, 1], [1, 3], [3, 3]],
    5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]],
    6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]],
  };
  return (
    <svg className={`die ${side}`} viewBox="0 0 4 4" aria-label={`${value}`}>
      <rect x="0.15" y="0.15" width="3.7" height="3.7" rx="0.7" />
      {pips[value].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="0.36" />
      ))}
    </svg>
  );
}

function BattleSlip({ state }: { state: GameState }) {
  const b = state.lastBattle;
  if (!b) return null;
  const att = state.players[b.attacker];
  const def = state.players[b.defender];
  return (
    <section className="panel battle">
      <h3>Last battle</h3>
      <p className="battle-line">
        <span style={{ color: att.color }}>{TERRITORY_BY_ID[b.from].name}</span> →{" "}
        <span style={{ color: def.color }}>{TERRITORY_BY_ID[b.to].name}</span>
      </p>
      <div className="dice-rows">
        <div>
          {b.attack.map((v, i) => (
            <Die key={i} value={v} side="att" />
          ))}
        </div>
        <div>
          {b.defend.map((v, i) => (
            <Die key={i} value={v} side="def" />
          ))}
        </div>
      </div>
      <p className="battle-result">
        {att.name} loses {b.attackerLost} · {def.name} loses {b.defenderLost}
        {b.conquered && <strong> · Conquered!</strong>}
      </p>
    </section>
  );
}

export function Sidebar(p: Props) {
  const s = p.state;
  const me = s.players[0];
  const faction = FACTION_BY_ID[me.faction];
  const myTurn = s.players[s.current].human && s.phase !== "gameover";
  const chosenCards = me.cards.filter((c) => p.selectedCards.includes(c.id));
  const canTrade = myTurn && s.phase === "draft" && chosenCards.length === 3 && isValidSet(chosenCards);

  return (
    <aside className="sidebar">
      <header className="me">
        <img className="me-portrait" src={portraitUrl(me.faction)} alt="" />
        <div>
          <p className="eyebrow">{faction.realm}</p>
          <h2>{me.name}</h2>
          <p className="turn-line">
            Turn {s.turn} · {s.difficulty[0].toUpperCase() + s.difficulty.slice(1)}
          </p>
        </div>
      </header>

      <ol className="phases" aria-label="Turn phases">
        {(["draft", "attack", "fortify"] as const).map((ph) => (
          <li
            key={ph}
            className={
              s.phase === ph || (ph === "attack" && s.phase === "occupy") || (ph === "draft" && s.phase === "setup")
                ? "on"
                : ""
            }
          >
            {ph === "draft" && s.phase === "setup" ? "Setup" : ph[0].toUpperCase() + ph.slice(1)}
          </li>
        ))}
      </ol>

      <section className={`panel status${myTurn ? " mine" : ""}`} aria-live="polite">
        <p>{p.status}</p>

        {myTurn && (s.phase === "setup" || s.phase === "draft") && !mustTrade(s) && (
          <div className="row">
            <span className="label">Place</span>
            <div className="segmented">
              {([1, 5, "all"] as PlaceAmount[]).map((a) => (
                <button key={a} type="button" className={p.place === a ? "on" : ""} onClick={() => p.onPlace(a)}>
                  {a === "all" ? "All" : a}
                </button>
              ))}
            </div>
          </div>
        )}

        {myTurn && s.phase === "attack" && (
          <>
            {p.selected && p.maxDice > 0 && (
              <div className="row">
                <span className="label">Dice</span>
                <div className="segmented">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={n > p.maxDice}
                      className={Math.min(p.dice, p.maxDice) === n ? "on" : ""}
                      onClick={() => p.onDice(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="actions">
              {p.blitzTarget && (
                <button type="button" className="btn" onClick={p.onBlitz} title="Roll until the fight is decided">
                  Blitz {TERRITORY_BY_ID[p.blitzTarget].name}
                </button>
              )}
              {p.selected && (
                <button type="button" className="btn ghost" onClick={p.onCancel}>
                  Deselect
                </button>
              )}
              <button type="button" className="btn primary" onClick={p.onEndAttack}>
                End attack
              </button>
            </div>
          </>
        )}

        {myTurn && s.phase === "occupy" && s.occupy && (
          <>
            <div className="row">
              <span className="label">Move</span>
              <input
                type="range"
                min={s.occupy.min}
                max={s.occupy.max}
                value={p.moveCount}
                onChange={(e) => p.onMoveCount(Number(e.target.value))}
              />
              <strong className="count">{p.moveCount}</strong>
            </div>
            <div className="actions">
              <button type="button" className="btn primary" onClick={p.onOccupy}>
                Occupy {TERRITORY_BY_ID[s.occupy.to].name}
              </button>
            </div>
          </>
        )}

        {myTurn && s.phase === "fortify" && (
          <>
            {p.selected && p.fortifyTo && (
              <div className="row">
                <span className="label">March</span>
                <input
                  type="range"
                  min={1}
                  max={s.armies[p.selected] - 1}
                  value={p.moveCount}
                  onChange={(e) => p.onMoveCount(Number(e.target.value))}
                />
                <strong className="count">{p.moveCount}</strong>
              </div>
            )}
            <div className="actions">
              {p.selected && p.fortifyTo && (
                <button type="button" className="btn primary" onClick={p.onFortify}>
                  March and end turn
                </button>
              )}
              {p.selected && (
                <button type="button" className="btn ghost" onClick={p.onCancel}>
                  Deselect
                </button>
              )}
              <button type="button" className={p.fortifyTo ? "btn" : "btn primary"} onClick={p.onEndTurn}>
                End turn
              </button>
            </div>
          </>
        )}
      </section>

      <BattleSlip state={s} />

      <section className="panel">
        <h3>
          Cards <span className="muted">· next set {tradeValue(s.trades)}</span>
        </h3>
        {me.cards.length === 0 ? (
          <p className="muted small">Conquer a land in your turn to earn a card.</p>
        ) : (
          <div className="cards">
            {me.cards.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`card sym-${c.symbol}${p.selectedCards.includes(c.id) ? " picked" : ""}`}
                aria-pressed={p.selectedCards.includes(c.id)}
                onClick={() => p.onToggleCard(c.id)}
              >
                <span className="card-sym">{SYMBOL_LABEL[c.symbol]}</span>
                <span className="card-land">{c.territory ? TERRITORY_BY_ID[c.territory].name : "Any"}</span>
              </button>
            ))}
          </div>
        )}
        {myTurn && s.phase === "draft" && me.cards.length >= 3 && (
          <div className="actions">
            <button type="button" className="btn" disabled={!canTrade} onClick={p.onTrade}>
              Trade set for {tradeValue(s.trades)}
            </button>
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Realms</h3>
        <ul className="realms">
          {s.players.map((pl) => {
            const lands = territoriesOf(s, pl.id);
            const armies = lands.reduce((n, t) => n + s.armies[t], 0);
            return (
              <li key={pl.id} className={`${pl.alive ? "" : "fallen"}${s.current === pl.id ? " current" : ""}`}>
                <img src={emblemUrl(pl.faction)} alt="" />
                <span className="swatch" style={{ background: pl.color }} />
                <span className="realm-name">
                  {pl.name}
                  <small>{FACTION_BY_ID[pl.faction].name}</small>
                </span>
                <span className="realm-stats">
                  {pl.alive ? (
                    <>
                      {lands.length} lands · {armies}
                      <small>
                        +{reinforcements(s, pl.id)}/turn · {pl.cards.length} cards
                      </small>
                    </>
                  ) : (
                    "fallen"
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel log">
        <h3>Chronicle</h3>
        <ul>
          {s.log.slice(0, 8).map((line, i) => (
            <li key={`${s.log.length}-${i}`}>{line}</li>
          ))}
        </ul>
      </section>

      <footer className="side-foot">
        <button type="button" className="btn ghost" onClick={p.onMute}>
          {p.muted ? "Sound off" : "Sound on"}
        </button>
        <button type="button" className="btn ghost" onClick={p.onAbandon}>
          New campaign
        </button>
      </footer>
    </aside>
  );
}
