// Short menu sounds made with Web Audio: no files to load. Off with one switch in Options.
// The choice is a per-browser convenience, so storage failures only mean "sound on".

const KEY = 'design-the-arki:sound';
export type Blip = 'hover' | 'select' | 'play';

export function soundOn(): boolean {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setSoundOn(on: boolean): void {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* the choice lasts until the tab closes */ }
}

let ctx: AudioContext | null = null;

export function blip(kind: Blip): void {
  // Browsers only allow sound after the player has clicked or pressed a key.
  if (!soundOn() || typeof AudioContext === 'undefined' || !navigator.userActivation?.hasBeenActive) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
    const length = kind === 'play' ? 0.18 : 0.06;
    osc.type = 'square';
    osc.frequency.setValueAtTime(kind === 'hover' ? 660 : kind === 'select' ? 880 : 520, now);
    if (kind === 'play') osc.frequency.exponentialRampToValueAtTime(1040, now + 0.12);
    gain.gain.setValueAtTime(kind === 'hover' ? 0.012 : 0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + length + 0.02);
  } catch { /* no sound is fine */ }
}
