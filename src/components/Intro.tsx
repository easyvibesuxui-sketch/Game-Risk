import { useEffect, useState } from "react";
import { FACTIONS, atlasUrl, emblemUrl, portraitUrl } from "../game/factions";
import { Cinematic } from "./Cinematic";

const ASSETS = [
  ...FACTIONS.flatMap((f) => [portraitUrl(f.id), emblemUrl(f.id)]),
  ...["galleon.png", "serpent.png", "leviathan.png", "compass.png", "sea.jpg", "terrain.jpg", "cartouche.jpg"].map(
    atlasUrl,
  ),
];

/** Preloads the board art while the opening battle plays. */
export function Intro({ onDone }: { onDone: () => void }) {
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    let alive = true;
    for (const src of ASSETS) {
      const img = new Image();
      img.onload = img.onerror = () => alive && setLoaded((n) => n + 1);
      img.src = src;
    }
    return () => {
      alive = false;
    };
  }, []);

  const pct = Math.round((loaded / ASSETS.length) * 100);

  return (
    <Cinematic name="intro" onDone={onDone} skipLabel="Skip intro">
      <div className="intro-title">
        <p className="eyebrow light">Five realms · one crown</p>
        <h1>Sovereign</h1>
      </div>
      <div className="intro-progress" aria-label={`Loading ${pct}%`}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </Cinematic>
  );
}
