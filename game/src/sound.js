// Sound — every sound in Lumenfall is made with the browser's own
// WebAudio oscillators. No sound files, no network: each effect is a
// short envelope over one or two oscillators, and the ambience is a
// quiet two-note drone that starts when a run starts.

export class SoundBank {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.drone = null;
  }

  /** Create the audio context on a user gesture (browsers demand it). */
  ensure() {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.context.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.context.currentTime, 0.02);
    }
  }

  /** One oscillator note with a pitch slide and a fading envelope. */
  tone({ type = 'sine', from = 440, to = null, duration = 0.12, volume = 0.2, delay = 0 }) {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  shoot() {
    this.tone({ type: 'square', from: 880, to: 320, duration: 0.09, volume: 0.1 });
  }

  enemyHit() {
    this.tone({ type: 'triangle', from: 220, to: 90, duration: 0.08, volume: 0.14 });
  }

  enemyDie() {
    this.tone({ type: 'sawtooth', from: 320, to: 40, duration: 0.22, volume: 0.16 });
    this.tone({ type: 'sine', from: 640, to: 120, duration: 0.16, volume: 0.1, delay: 0.02 });
  }

  playerHurt() {
    this.tone({ type: 'sawtooth', from: 160, to: 60, duration: 0.25, volume: 0.2 });
  }

  lanternHurt() {
    this.tone({ type: 'sine', from: 140, to: 70, duration: 0.3, volume: 0.22 });
    this.tone({ type: 'triangle', from: 90, to: 45, duration: 0.3, volume: 0.14, delay: 0.05 });
  }

  pickup() {
    this.tone({ type: 'sine', from: 523, duration: 0.1, volume: 0.16 });
    this.tone({ type: 'sine', from: 659, duration: 0.1, volume: 0.16, delay: 0.07 });
    this.tone({ type: 'sine', from: 784, duration: 0.16, volume: 0.18, delay: 0.14 });
  }

  waveStart() {
    this.tone({ type: 'triangle', from: 392, duration: 0.18, volume: 0.16 });
    this.tone({ type: 'triangle', from: 523, duration: 0.18, volume: 0.16, delay: 0.1 });
    this.tone({ type: 'triangle', from: 659, duration: 0.3, volume: 0.18, delay: 0.2 });
  }

  waveClear() {
    this.tone({ type: 'sine', from: 659, duration: 0.12, volume: 0.15 });
    this.tone({ type: 'sine', from: 880, duration: 0.22, volume: 0.17, delay: 0.09 });
  }

  gameOver() {
    this.tone({ type: 'triangle', from: 392, to: 370, duration: 0.4, volume: 0.18 });
    this.tone({ type: 'triangle', from: 311, to: 294, duration: 0.4, volume: 0.18, delay: 0.35 });
    this.tone({ type: 'triangle', from: 233, to: 220, duration: 0.8, volume: 0.2, delay: 0.7 });
  }

  click() {
    this.tone({ type: 'sine', from: 700, to: 500, duration: 0.06, volume: 0.12 });
  }

  /** A low, warm hum under a run: two detuned sines through a slow swell. */
  startDrone() {
    if (!this.context || !this.master || this.drone) return;
    const oscA = this.context.createOscillator();
    const oscB = this.context.createOscillator();
    const gain = this.context.createGain();
    oscA.type = 'sine';
    oscB.type = 'sine';
    oscA.frequency.value = 55;
    oscB.frequency.value = 82.4;
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.035, this.context.currentTime, 1.5);
    oscA.connect(gain);
    oscB.connect(gain);
    gain.connect(this.master);
    oscA.start();
    oscB.start();
    this.drone = { oscA, oscB, gain };
  }

  stopDrone() {
    if (!this.drone || !this.context) return;
    const { oscA, oscB, gain } = this.drone;
    gain.gain.setTargetAtTime(0, this.context.currentTime, 0.3);
    const stopAt = this.context.currentTime + 1.2;
    oscA.stop(stopAt);
    oscB.stop(stopAt);
    this.drone = null;
  }
}
