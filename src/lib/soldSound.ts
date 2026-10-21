/**
 * The "sold" cue on the live watch screen: a gavel knock and a short rising
 * chime, synthesised with the Web Audio API so there is no audio file to ship,
 * cache or license. Browser-only — import it from client components, and call
 * nothing here before mount.
 *
 * Browsers start an AudioContext suspended until the page gets a user gesture,
 * so `unlockSoldSound()` must be called from inside a click or key handler.
 * Until then `playSoldSound()` is a no-op rather than queueing a sound that
 * would go off late, whenever the context finally resumes.
 */

let ctx: AudioContext | null = null;
let out: AudioNode | null = null;
let noise: AudioBuffer | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  // One master level for the whole cue, set so its loudest instant stays
  // under full scale — a clipped gavel crackles on a hall's PA.
  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  out = master;
  // Half a second of white noise, reused for every knock's attack.
  noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

/**
 * Call from a user gesture. Resolves to whether audio is now running. Outside
 * a gesture it still succeeds if the page already has the user's activation —
 * arriving by an in-app link, say — and otherwise just leaves it suspended.
 */
export async function unlockSoldSound(): Promise<boolean> {
  const c = context();
  if (!c) return false;
  try { if (c.state !== 'running') await c.resume(); } catch { /* blocked */ }
  return c.state === 'running';
}

/** A wooden strike: a pitch-dropping thump for the body, filtered noise for the crack. */
function knock(c: AudioContext, dest: AudioNode, at: number, level: number) {
  const body = c.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(190, at);
  body.frequency.exponentialRampToValueAtTime(80, at + 0.12);
  const bodyGain = c.createGain();
  bodyGain.gain.setValueAtTime(0.0001, at);
  bodyGain.gain.exponentialRampToValueAtTime(level, at + 0.004);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
  body.connect(bodyGain).connect(dest);
  body.start(at);
  body.stop(at + 0.25);

  const crack = c.createBufferSource();
  crack.buffer = noise;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2400;
  band.Q.value = 0.8;
  const crackGain = c.createGain();
  crackGain.gain.setValueAtTime(level * 0.9, at);
  crackGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  crack.connect(band).connect(crackGain).connect(dest);
  crack.start(at);
  crack.stop(at + 0.06);
}

/** A bell-ish note: a sine with a quieter octave above it, struck and left to ring. */
function chime(c: AudioContext, dest: AudioNode, at: number, freq: number, level: number, ring: number) {
  for (const [mult, share] of [[1, 1], [2, 0.22]] as const) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq * mult;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level * share, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + ring);
    osc.connect(g).connect(dest);
    osc.start(at);
    osc.stop(at + ring + 0.05);
  }
}

/** Gavel, gavel, then C–E–G. About 1.8s end to end. */
export function playSoldSound(): void {
  const c = ctx;
  if (!c || !out || c.state !== 'running') return;
  const t = c.currentTime + 0.02;
  knock(c, out, t, 0.9);
  knock(c, out, t + 0.16, 0.75);
  chime(c, out, t + 0.34, 1046.5, 0.28, 0.9);
  chime(c, out, t + 0.44, 1318.5, 0.26, 0.9);
  chime(c, out, t + 0.54, 1568.0, 0.3, 1.3);
}
