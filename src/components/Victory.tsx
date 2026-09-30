import { useEffect, useState } from "react";
import { territoriesOf, type GameState } from "../game/engine";
import { FACTION_BY_ID, emblemUrl, portraitUrl } from "../game/factions";
import { Cinematic } from "./Cinematic";

/** The triumph film, then the winner's standard rises over it. */
export function Victory({ state, onNew }: { state: GameState; onNew: () => void }) {
  const me = state.players[0];
  const faction = FACTION_BY_ID[me.faction];
  const [reveal, setReveal] = useState(false);

  // Bring the honours in during the aerial shot rather than waiting for the end.
  useEffect(() => {
    const id = window.setTimeout(() => setReveal(true), 5200);
    return () => window.clearTimeout(id);
  }, []);

  const lands = territoriesOf(state, 0).length;
  const armies = territoriesOf(state, 0).reduce((n, t) => n + state.armies[t], 0);
  const fallen = state.players.filter((p) => !p.human).map((p) => FACTION_BY_ID[p.faction].name);

  return (
    <Cinematic
      name="victory"
      hold
      onDone={() => setReveal(true)}
      skipLabel="Skip film"
      className={reveal ? "revealed" : ""}
    >
      <div className={`victory${reveal ? " show" : ""}`} style={{ ["--c" as string]: faction.color }}>
        <div className="victory-standard">
          <img className="victory-portrait" src={portraitUrl(me.faction)} alt="" />
          <img className="victory-emblem" src={emblemUrl(me.faction)} alt="" />
        </div>
        <p className="eyebrow light">{faction.realm}</p>
        <h1>The world is yours</h1>
        <p className="victory-line">
          {me.name} of the {faction.name} rules all forty-two lands after {state.turn} turns.
        </p>
        <ul className="victory-stats">
          <li>
            <strong>{lands}</strong> lands
          </li>
          <li>
            <strong>{armies}</strong> armies
          </li>
          <li>
            <strong>{state.difficulty[0].toUpperCase() + state.difficulty.slice(1)}</strong> rivals
          </li>
        </ul>
        <p className="victory-fallen">Fallen: {fallen.join(", ")}</p>
        <button type="button" className="btn primary" onClick={onNew}>
          New campaign
        </button>
      </div>
    </Cinematic>
  );
}
