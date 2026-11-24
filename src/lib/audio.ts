/* ------------------------------------------------------------------ */
/*  Lille WebAudio-motor – ingen eksterne assets, alt syntetiseret     */
/* ------------------------------------------------------------------ */

type SoundName =
  | "chirp"
  | "eat"
  | "happy"
  | "clean"
  | "sleep"
  | "train"
  | "levelup"
  | "error"
  | "unlock"
  | "blip"
  | "flap";

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  resume() {
    this.ensure();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.32, this.ctx.currentTime, 0.02);
    }
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    when = 0,
    gain = 0.5,
    bendTo?: number,
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (bendTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, bendTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private hiss(dur: number, when = 0, gain = 0.25, hp = 900) {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    if (!this.noise) {
      const len = Math.floor(ctx.sampleRate * 1.2);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  play(name: SoundName) {
    if (this.muted) return;
    switch (name) {
      case "chirp":
        this.tone(1180, 0.1, "triangle", 0, 0.4, 1900);
        this.tone(1560, 0.09, "triangle", 0.1, 0.32, 2300);
        break;
      case "flap":
        this.hiss(0.12, 0, 0.16, 500);
        this.hiss(0.1, 0.14, 0.12, 420);
        break;
      case "eat":
        this.tone(320, 0.06, "square", 0, 0.22, 190);
        this.tone(300, 0.06, "square", 0.09, 0.2, 170);
        this.tone(280, 0.07, "square", 0.18, 0.18, 150);
        break;
      case "happy":
        this.tone(880, 0.1, "sine", 0, 0.35, 1320);
        this.tone(1320, 0.14, "sine", 0.09, 0.3, 1760);
        break;
      case "clean":
        this.hiss(0.5, 0, 0.16, 2200);
        this.tone(660, 0.3, "sine", 0.05, 0.12, 990);
        break;
      case "sleep":
        this.tone(420, 0.35, "sine", 0, 0.25, 190);
        this.tone(280, 0.4, "sine", 0.18, 0.18, 130);
        break;
      case "train":
        this.tone(520, 0.07, "square", 0, 0.18);
        this.tone(700, 0.07, "square", 0.08, 0.18);
        this.tone(940, 0.12, "square", 0.16, 0.2);
        break;
      case "levelup":
        [523, 659, 784, 1046, 1318].forEach((f, i) =>
          this.tone(f, 0.22, "triangle", i * 0.085, 0.32),
        );
        this.hiss(0.4, 0.35, 0.08, 3000);
        break;
      case "error":
        this.tone(200, 0.18, "sawtooth", 0, 0.28, 110);
        this.tone(150, 0.24, "sawtooth", 0.12, 0.24, 80);
        break;
      case "unlock":
        this.tone(300, 0.1, "square", 0, 0.2, 620);
        this.tone(620, 0.1, "square", 0.1, 0.2, 900);
        this.tone(1240, 0.25, "triangle", 0.2, 0.26, 1560);
        break;
      case "blip":
        this.tone(1500, 0.035, "square", 0, 0.09);
        break;
    }
  }
}

export const audio = new AudioEngine();
export type { SoundName };