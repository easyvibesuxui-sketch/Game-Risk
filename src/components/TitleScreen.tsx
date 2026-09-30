import { useState, type FormEvent } from "react";
import { DIFFICULTIES, type Difficulty } from "../game/engine";
import { FACTIONS, FACTION_BY_ID, atlasUrl, emblemUrl, portraitUrl, type FactionId } from "../game/factions";

interface Props {
  canResume: boolean;
  error: string | null;
  onStart: (name: string, opponents: number, faction: FactionId, difficulty: Difficulty) => void;
  onResume: () => void;
}

const DIFFICULTY_NOTE: Record<Difficulty, string> = {
  easy: "Timid rivals who strike rarely and never regroup.",
  medium: "Rivals who build continents and press an advantage.",
  hard: "Ruthless rivals who break your bonuses and hunt the leader.",
};

export function TitleScreen({ canResume, error, onStart, onResume }: Props) {
  const [faction, setFaction] = useState<FactionId>("humans");
  const [opponents, setOpponents] = useState(3);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [name, setName] = useState("");
  const chosen = FACTION_BY_ID[faction];

  const submit = (e: FormEvent) => {
    e.preventDefault();
  };

  return (
    <main className="title">
      <form className="title-card" onSubmit={submit}>
        <header className="title-head">
          <p className="eyebrow">A campaign of conquest</p>
          <div className="cartouche" style={{ backgroundImage: `url(${atlasUrl("cartouche.jpg")})` }}>
            <h1>Sovereign</h1>
          </div>
          <p className="lede">Five realms, forty-two lands, one crown. Choose your people.</p>
        </header>

        <div className="factions" role="radiogroup" aria-label="Your people">
          {FACTIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={faction === f.id}
              className={`faction${faction === f.id ? " chosen" : ""}`}
              style={{ ["--c" as string]: f.color }}
              onClick={() => setFaction(f.id)}
            >
              <img src={portraitUrl(f.id)} alt="" loading="eager" />
              <span className="faction-name">
                <img src={emblemUrl(f.id)} alt="" />
                {f.name}
              </span>
            </button>
          ))}
        </div>

        <div className="chosen-line">
          <strong>{chosen.realm}</strong> — {chosen.motto}
        </div>

        <div className="title-fields">
          <label>
            <span>Your name</span>
            <input value={name} maxLength={24} placeholder={chosen.leader} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <span>Rival realms</span>
            <div className="segmented">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={opponents === n ? "on" : ""}
                  aria-pressed={opponents === n}
                  onClick={() => setOpponents(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </label>
          <label>
            <span>Difficulty</span>
            <div className="segmented">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={difficulty === d ? "on" : ""}
                  aria-pressed={difficulty === d}
                  onClick={() => setDifficulty(d)}
                >
                  {d[0].toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </label>
        </div>
        <p className="difficulty-note">{DIFFICULTY_NOTE[difficulty]}</p>

        <div className="title-actions">
          <button type="button" className="btn primary" onClick={() => onStart(name, opponents, faction, difficulty)}>
            Take command
          </button>
          {canResume && (
            <button type="button" className="btn" onClick={onResume}>
              Resume campaign
            </button>
          )}
        </div>
        {error && <p className="start-error">{error}</p>}
      </form>
    </main>
  );
}
