import { useState, type FormEvent } from "react";
import { FACTIONS, FACTION_BY_ID, emblemUrl, portraitUrl, type FactionId } from "../game/factions";

interface Props {
  canResume: boolean;
  error: string | null;
  onStart: (name: string, opponents: number, faction: FactionId) => void;
  onResume: () => void;
}

export function TitleScreen({ canResume, error, onStart, onResume }: Props) {
  const [faction, setFaction] = useState<FactionId>("humans");
  const [opponents, setOpponents] = useState(3);
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
          <h1>Sovereign</h1>
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
        </div>

        <div className="title-actions">
          <button type="button" className="btn primary" onClick={() => onStart(name, opponents, faction)}>
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
