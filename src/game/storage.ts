import type { GameState } from "./engine";
import { TERRITORIES } from "./map";

export const SAVE_KEY = "sovereign-campaign-v1";
export const MUTE_KEY = "sovereign-mute";

export function saveGame(s: GameState | null): void {
  try {
    if (!s || s.phase === "gameover") localStorage.removeItem(SAVE_KEY);
    else localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: play without saves */
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    const ok =
      s?.version === 1 &&
      Object.keys(s.owner ?? {}).length === TERRITORIES.length &&
      TERRITORIES.every((t) => t.id in s.owner && t.id in s.armies);
    if (!ok) {
      localStorage.removeItem(SAVE_KEY);
      return null;
    }
    return { ...s, difficulty: s.difficulty ?? "medium", captures: s.captures ?? 0 };
  } catch {
    return null;
  }
}

export function loadMute(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveMute(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}
