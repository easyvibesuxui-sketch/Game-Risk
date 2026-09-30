import { memo } from "react";
import type { GameState } from "../game/engine";
import { atlasUrl } from "../game/factions";
import { TERRITORIES, TERRITORY_BY_ID } from "../game/map";
import { ATLAS_VIEWBOX, LABEL_POINTS, SEA_LANES, TERRITORY_PATHS } from "../game/map-shapes";

const { w: W, h: H } = ATLAS_VIEWBOX;

// Label nudges where the pole of inaccessibility sits awkwardly for a seal.
const LABEL_NUDGE: Record<string, [number, number]> = {
  central_america: [4, -18],
  great_britain: [-6, 2],
  japan: [8, -6],
  indonesia: [-14, 4],
  iceland: [4, 0],
};

export function labelPoint(id: string): [number, number] {
  const [x, y] = LABEL_POINTS[id];
  const [dx, dy] = LABEL_NUDGE[id] ?? [0, 0];
  return [x + dx, y + dy];
}

function lanePath(lane: (typeof SEA_LANES)[number]): string[] {
  if (lane.wrap) {
    // Alaska–Kamchatka runs off both edges of the board.
    const [ax, ay] = lane.from;
    const [kx, ky] = lane.to;
    return [`M${ax},${ay} L4,${ay - 6}`, `M${kx},${ky} L${W - 4},${ky - 6}`];
  }
  const [x1, y1] = lane.from;
  const [x2, y2] = lane.to;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - Math.min(24, Math.hypot(x2 - x1, y2 - y1) * 0.12);
  return [`M${x1},${y1} Q${mx},${my} ${x2},${y2}`];
}

// Latitude lines at 60N, tropic, equator, tropic, 35S projected the same way as the land.
const LAT_LINES = [
  { y: 186, label: "" },
  { y: 464.7, label: "Tropicus Cancri" },
  { y: 592, label: "Aequator" },
  { y: 725, label: "Tropicus Capricorni" },
];

interface Ornament {
  file: string;
  x: number;
  y: number;
  w: number;
  h: number;
  flip?: boolean;
}

const ORNAMENTS: Ornament[] = [
  { file: "galleon.png", x: 424, y: 392, w: 112, h: 64 },
  { file: "serpent.png", x: 40, y: 640, w: 150, h: 64 },
  { file: "leviathan.png", x: 880, y: 770, w: 150, h: 68, flip: true },
  { file: "compass.png", x: 1288, y: 456, w: 96, h: 96 },
];

const OCEAN_NAMES = [
  { text: "OCEANVS", x: 112, y: 548, size: 17 },
  { text: "PACIFICVS", x: 112, y: 570, size: 17 },
  { text: "MARE ATLANTICVM", x: 545, y: 700, size: 13 },
  { text: "OCEANVS INDICVS", x: 1000, y: 690, size: 17 },
  { text: "MARE AVSTRALE", x: 640, y: 836, size: 14 },
  { text: "MARE SEPTENTRIONALE", x: 700, y: 30, size: 12 },
];

interface BoardProps {
  state: GameState;
  selected: string | null;
  targets: Set<string>;
  onPick: (id: string) => void;
}

function BoardImpl({ state, selected, targets, onPick }: BoardProps) {
  const battle = state.lastBattle;
  const hot = new Set(battle ? [battle.from, battle.to] : []);
  return (
    <svg
      className="board"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="World map"
    >
      <defs>
        <pattern id="stipple" width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.7" fill="var(--ink)" opacity="0.22" />
          <circle cx="5" cy="5" r="0.55" fill="var(--ink)" opacity="0.14" />
        </pattern>
        <filter id="paper" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.1  0 0 0 0.16 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <mask id="open-sea">
          <rect width={W} height={H} fill="white" />
          <g fill="black" stroke="black" strokeWidth="10" strokeLinejoin="round">
            {TERRITORIES.map((t) => (
              <path key={t.id} d={TERRITORY_PATHS[t.id]} fillRule="evenodd" />
            ))}
          </g>
        </mask>
        <mask id="land-only">
          <rect width={W} height={H} fill="black" />
          <g fill="white">
            {TERRITORIES.map((t) => (
              <path key={t.id} d={TERRITORY_PATHS[t.id]} fillRule="evenodd" />
            ))}
          </g>
        </mask>
        {TERRITORIES.map((t) => (
          <clipPath key={t.id} id={`clip-${t.id}`}>
            <path d={TERRITORY_PATHS[t.id]} fillRule="evenodd" />
          </clipPath>
        ))}
      </defs>

      {/* Sea */}
      <rect width={W} height={H} fill="var(--sea)" />
      <image
        href={atlasUrl("sea.jpg")}
        width={W}
        height={H}
        preserveAspectRatio="xMidYMid slice"
        opacity="0.36"
        pointerEvents="none"
      />
      <rect width={W} height={H} fill="url(#stipple)" opacity="0.6" />

      <g mask="url(#open-sea)">
        {LAT_LINES.map((l) => (
          <g key={l.y}>
            <line x1="0" x2={W} y1={l.y} y2={l.y} stroke="var(--ink)" strokeOpacity="0.28" strokeWidth="0.8" strokeDasharray={l.label ? "0" : "2 5"} />
            {l.label && (
              <text x={318} y={l.y - 4} className="lat-label">
                {l.label}
              </text>
            )}
          </g>
        ))}
        {OCEAN_NAMES.map((o) => (
          <text key={o.text} x={o.x} y={o.y} className="ocean-name" fontSize={o.size} textAnchor="middle">
            {o.text}
          </text>
        ))}
        {ORNAMENTS.map((o) => (
          <image
            key={o.file}
            href={atlasUrl(o.file)}
            x={o.x}
            y={o.y}
            width={o.w}
            height={o.h}
            preserveAspectRatio="xMidYMid meet"
            transform={o.flip ? `translate(${o.x * 2 + o.w} 0) scale(-1 1)` : undefined}
            opacity="0.92"
          />
        ))}
      </g>

      {/* Engraved coast halo */}
      <g fill="none" stroke="var(--ink)" strokeLinejoin="round" pointerEvents="none">
        {TERRITORIES.map((t) => (
          <path key={t.id} d={TERRITORY_PATHS[t.id]} strokeWidth="9" strokeOpacity="0.07" />
        ))}
        {TERRITORIES.map((t) => (
          <path key={t.id} d={TERRITORY_PATHS[t.id]} strokeWidth="4" strokeOpacity="0.1" />
        ))}
      </g>

      {/* Sea lanes */}
      <g fill="none" stroke="var(--ink)" strokeWidth="1.3" strokeDasharray="4 4" strokeOpacity="0.6" pointerEvents="none">
        {SEA_LANES.flatMap((lane) =>
          lanePath(lane).map((d, i) => <path key={`${lane.a}-${lane.b}-${i}`} d={d} />),
        )}
      </g>

      {/* Land */}
      <g>
        {TERRITORIES.map((t) => {
          const owner = state.players[state.owner[t.id]];
          const isSel = selected === t.id;
          const isTarget = targets.has(t.id);
          return (
            <g
              key={t.id}
              className={`territory${isSel ? " selected" : ""}${isTarget ? " target" : ""}`}
              data-territory={t.id}
              data-owner={state.owner[t.id]}
              data-armies={state.armies[t.id]}
              onClick={() => onPick(t.id)}
            >
              <path d={TERRITORY_PATHS[t.id]} fillRule="evenodd" className={`land land-${t.continent}`} />
              <path
                d={TERRITORY_PATHS[t.id]}
                clipPath={`url(#clip-${t.id})`}
                fill="none"
                stroke={owner.color}
                strokeWidth="7"
                strokeOpacity="0.85"
                strokeLinejoin="round"
              />
              <path d={TERRITORY_PATHS[t.id]} fillRule="evenodd" className="land-edge" />
            </g>
          );
        })}
        {/* Engraved terrain printed over the washes, like hills and woods on an atlas plate */}
        <image
          href={atlasUrl("terrain.jpg")}
          width={W}
          height={H}
          preserveAspectRatio="xMidYMid slice"
          mask="url(#land-only)"
          opacity="0.62"
          pointerEvents="none"
          style={{ mixBlendMode: "multiply" }}
        />
        <rect width={W} height={H} filter="url(#paper)" pointerEvents="none" opacity="0.6" style={{ mixBlendMode: "multiply" }} mask="url(#land-only)" />
      </g>

      {/* Labels and army seals */}
      <g pointerEvents="none">
        {TERRITORIES.map((t) => {
          const [x, y] = labelPoint(t.id);
          const owner = state.players[state.owner[t.id]];
          const n = state.armies[t.id];
          const r = n >= 100 ? 13 : 11;
          return (
            <g key={t.id} className={hot.has(t.id) ? "seal hot" : "seal"}>
              <text x={x} y={y - r - 3} className="terr-name" textAnchor="middle">
                {TERRITORY_BY_ID[t.id].name}
              </text>
              <circle cx={x} cy={y} r={r + 2} fill="var(--paper-hi)" stroke="var(--ink)" strokeWidth="0.8" />
              <circle cx={x} cy={y} r={r} fill={owner.color} />
              <text x={x} y={y + 4} className="army" textAnchor="middle">
                {n}
              </text>
            </g>
          );
        })}
      </g>

      {/* Neat-line border like an engraved plate */}
      <rect x="2" y="2" width={W - 4} height={H - 4} fill="none" stroke="var(--ink)" strokeWidth="3" />
      <rect x="7" y="7" width={W - 14} height={H - 14} fill="none" stroke="var(--crimson)" strokeWidth="4" strokeDasharray="14 14" />
      <rect x="10" y="10" width={W - 20} height={H - 20} fill="none" stroke="var(--ink)" strokeWidth="1" />
    </svg>
  );
}

export const Board = memo(BoardImpl);
