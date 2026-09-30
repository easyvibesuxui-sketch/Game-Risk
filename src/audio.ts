let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
}

export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function blip(freq: number, duration: number, type: OscillatorType, gain: number, delay = 0) {
  if (muted || !ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + duration);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration);
}

export function sfxDice() {
  for (let i = 0; i < 4; i++) blip(900 + Math.random() * 700, 0.04, "square", 0.03, i * 0.045);
}

export function sfxConquer() {
  blip(110, 0.35, "triangle", 0.18);
  blip(165, 0.4, "triangle", 0.12, 0.12);
}

export function sfxPlace() {
  blip(520, 0.06, "sine", 0.05);
}
