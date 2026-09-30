import { useCallback, useEffect, useMemo, useState } from "react";
import { sfxConquer, sfxDice, sfxPlace, setMuted, unlockAudio } from "../audio";
import { aiStep } from "../game/ai";
import {
  GameState,
  attack,
  canAttack,
  endAttack,
  endTurn,
  fortify,
  maxAttackDice,
  mustTrade,
  occupy,
  placeArmies,
  reachable,
  tradeCards,
  type Difficulty,
  type GameState as Game,
} from "../game/engine";
import { FACTION_BY_ID, portraitUrl, type FactionId } from "../game/factions";
import { TERRITORY_BY_ID } from "../game/map";
import { loadGame, loadMute, saveGame, saveMute } from "../game/storage";
import { Board } from "./Board";
import { Sidebar, type PlaceAmount } from "./Sidebar";
import { Intro } from "./Intro";
import { TitleScreen } from "./TitleScreen";
import { Victory } from "./Victory";

const AI_DELAY = { draft: 420, attack: 260, occupy: 200, fortify: 380 } as Record<string, number>;

export function Campaign() {
  const [state, setState] = useState<Game | null>(null);
  const [booted, setBooted] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [saved, setSaved] = useState<Game | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [fortifyTo, setFortifyTo] = useState<string | null>(null);
  const [lastTarget, setLastTarget] = useState<string | null>(null);
  const [dice, setDice] = useState(3);
  const [place, setPlace] = useState<PlaceAmount>(1);
  const [moveCount, setMoveCount] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [muted, setMute] = useState(false);

  useEffect(() => {
    setSaved(loadGame());
    const m = loadMute();
    setMute(m);
    setMuted(m);
    setBooted(true);
  }, []);

  useEffect(() => {
    if (booted) saveGame(state);
  }, [state, booted]);

  // AI turns: one step per tick. aiStep returns null when there is nothing to do,
  // and the same reference is kept so this effect does not loop.
  useEffect(() => {
    if (!state || state.phase === "gameover" || state.players[state.current].human) return;
    const id = window.setTimeout(() => {
      setState((current) => (current ? (aiStep(current) ?? current) : current));
    }, AI_DELAY[state.phase] ?? 300);
    return () => window.clearTimeout(id);
  }, [state]);

  // Sounds and occupy defaults follow the latest battle.
  const battle = state?.lastBattle;
  useEffect(() => {
    if (!battle) return;
    if (battle.conquered) sfxConquer();
    else sfxDice();
  }, [battle]);

  useEffect(() => {
    if (state?.phase === "occupy" && state.occupy) setMoveCount(state.occupy.max);
  }, [state?.phase, state?.occupy]);

  const resetSelection = useCallback(() => {
    setSelected(null);
    setFortifyTo(null);
    setLastTarget(null);
  }, []);

  // Human actions only run on the human's turn, when no AI tick is pending, so the
  // rendered state is the current one.
  const apply = (fn: (s: Game) => Game) => {
    if (!state) return;
    try {
      setState(fn(state));
      setNotice(null);
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const onStart = (name: string, opponents: number, faction: FactionId, difficulty: Difficulty) => {
    unlockAudio();
    setStartError(null);
    try {
      const s = GameState.create(name, opponents, faction, { difficulty });
      resetSelection();
      setSelectedCards([]);
      setPlace(1);
      setState(s);
    } catch (e) {
      setStartError((e as Error).message);
    }
  };

  const onResume = () => {
    unlockAudio();
    const s = saved ?? loadGame();
    if (s) {
      resetSelection();
      setState(s);
    } else setStartError("That save could not be read. Start a new campaign.");
  };

  const myTurn = !!state && state.players[state.current].human && state.phase !== "gameover";

  const onPick = (id: string) => {
      if (!state || !myTurn) return;
      const mine = state.owner[id] === state.current;
      switch (state.phase) {
        case "setup":
        case "draft": {
          if (!mine) return setNotice("Reinforce one of your own lands.");
          if (mustTrade(state)) return setNotice("You hold five or more cards: trade a set first.");
          const n = place === "all" ? state.reserve : place;
          sfxPlace();
          apply((s) => placeArmies(s, id, n));
          return;
        }
        case "attack": {
          if (mine) {
            if (state.armies[id] < 2) return setNotice("A land needs at least two armies to attack.");
            setSelected(id);
            setLastTarget(null);
            setNotice(null);
            return;
          }
          if (!selected) return setNotice("First pick one of your lands to attack from.");
          if (!canAttack(state, selected, id)) return setNotice("That land does not border your army.");
          setLastTarget(id);
          apply((s) => attack(s, selected, id, dice));
          return;
        }
        case "fortify": {
          if (!mine) return;
          if (selected && selected !== id && reachable(state, selected).has(id)) {
            setFortifyTo(id);
            setMoveCount(state.armies[selected] - 1);
            return;
          }
          if (state.armies[id] < 2) return setNotice("Pick a land with armies to spare.");
          setSelected(id);
          setFortifyTo(null);
          setNotice(null);
          return;
        }
      }
  };

  // Keep the attack source valid after rolls and conquests.
  useEffect(() => {
    if (!state || !selected) return;
    if (state.owner[selected] !== state.current) resetSelection();
    else if (state.phase === "attack" && state.armies[selected] < 2) resetSelection();
    else if (state.phase === "draft" || state.phase === "setup") resetSelection();
  }, [state, selected, resetSelection]);

  // After occupying, keep attacking from the newly taken land if it can.
  const onOccupy = () => {
    if (!state?.occupy) return;
    const { to } = state.occupy;
    apply((s) => occupy(s, moveCount));
    setLastTarget(null);
    setSelected(moveCount >= 2 ? to : state.occupy.from);
  };

  const onBlitz = () => {
    if (!state || !selected || !lastTarget) return;
    const from = selected;
    const to = lastTarget;
    apply((s) => {
      let cur = s;
      while (cur.phase === "attack" && canAttack(cur, from, to)) cur = attack(cur, from, to, 3);
      return cur;
    });
  };

  const targets = useMemo(() => {
    if (!state || !selected || !myTurn) return new Set<string>();
    if (state.phase === "attack")
      return new Set(TERRITORY_BY_ID[selected].neighbors.filter((n) => state.owner[n] !== state.current));
    if (state.phase === "fortify") return reachable(state, selected);
    return new Set<string>();
  }, [state, selected, myTurn]);

  if (!introDone) return <Intro onDone={() => setIntroDone(true)} />;

  if (!booted || !state) {
    return (
      <TitleScreen
        canResume={booted && !!saved}
        error={startError}
        onStart={onStart}
        onResume={onResume}
      />
    );
  }

  const current = state.players[state.current];
  const maxDice = selected && state.phase === "attack" ? maxAttackDice(state, selected) : 0;
  const status = statusLine(state, selected, fortifyTo, notice);
  const blitzTarget =
    myTurn && selected && lastTarget && canAttack(state, selected, lastTarget) ? lastTarget : null;

  return (
    <div className="campaign">
      <div className="map-cell">
        <Board state={state} selected={selected} targets={targets} onPick={onPick} />
        {!myTurn && state.phase !== "gameover" && (
          <div className="turn-banner" style={{ borderColor: current.color }}>
            <img src={portraitUrl(current.faction)} alt="" />
            <span>
              <strong>{current.name}</strong> of the {FACTION_BY_ID[current.faction].name} is moving…
            </span>
          </div>
        )}
        {state.phase === "gameover" && state.winner === 0 && <Victory state={state} onNew={() => setState(null)} />}
        {state.phase === "gameover" && state.winner !== 0 && (
          <div className="gameover">
            <div className="gameover-card">
              <img src={portraitUrl(state.players[state.winner ?? 0].faction)} alt="" />
              <h2>Your realm has fallen</h2>
              <p>
                {`${state.players[state.winner ?? 0].name} of the ${FACTION_BY_ID[state.players[state.winner ?? 0].faction].name} took your last land.`}
              </p>
              <button type="button" className="btn primary" onClick={() => setState(null)}>
                New campaign
              </button>
            </div>
          </div>
        )}
      </div>
      <Sidebar
        state={state}
        status={status}
        selected={selected}
        fortifyTo={fortifyTo}
        dice={dice}
        maxDice={maxDice}
        place={place}
        moveCount={moveCount}
        selectedCards={selectedCards}
        blitzTarget={blitzTarget}
        muted={muted}
        onDice={setDice}
        onPlace={setPlace}
        onMoveCount={setMoveCount}
        onToggleCard={(id) =>
          setSelectedCards((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id].slice(-3)))
        }
        onTrade={() => {
          const ids = selectedCards;
          apply((s) => tradeCards(s, ids));
          setSelectedCards([]);
        }}
        onBlitz={onBlitz}
        onEndAttack={() => {
          resetSelection();
          apply(endAttack);
        }}
        onOccupy={onOccupy}
        onFortify={() => {
          if (!selected || !fortifyTo) return;
          const from = selected;
          const to = fortifyTo;
          resetSelection();
          apply((s) => fortify(s, from, to, moveCount));
        }}
        onEndTurn={() => {
          resetSelection();
          apply(endTurn);
        }}
        onCancel={resetSelection}
        onMute={() => {
          const m = !muted;
          setMute(m);
          setMuted(m);
          saveMute(m);
        }}
        onAbandon={() => {
          if (window.confirm("Abandon this campaign and start a new one?")) {
            saveGame(null);
            setSaved(null);
            setState(null);
          }
        }}
      />
    </div>
  );
}

function statusLine(s: Game, selected: string | null, fortifyTo: string | null, notice: string | null): string {
  if (notice) return notice;
  const p = s.players[s.current];
  if (!p.human) return `${p.name} is taking their turn.`;
  const name = (id: string) => TERRITORY_BY_ID[id].name;
  switch (s.phase) {
    case "setup":
      return `Place ${s.reserve} reserve ${s.reserve === 1 ? "army" : "armies"} on your lands.`;
    case "draft":
      if (mustTrade(s)) return "You hold five or more cards. Pick a set of three and trade it.";
      if (s.resumeAttack) return `Place ${s.reserve} armies from the captured cards, then keep attacking.`;
      return `Place ${s.reserve} ${s.reserve === 1 ? "army" : "armies"}. Click your lands to reinforce them.`;
    case "attack":
      return selected
        ? `Attacking from ${name(selected)} (${s.armies[selected]}). Click a highlighted enemy land.`
        : "Pick one of your lands with two or more armies to attack from, or end the attack.";
    case "occupy":
      return s.occupy ? `${name(s.occupy.to)} is taken. How many armies march in?` : "";
    case "fortify":
      if (selected && fortifyTo) return `March from ${name(selected)} to ${name(fortifyTo)}.`;
      if (selected) return `From ${name(selected)}: click a highlighted land to march to.`;
      return "One march along your own lands, or end the turn.";
    default:
      return "";
  }
}
