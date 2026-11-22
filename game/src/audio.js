// Tiny WebAudio synth for the heist game. No audio files, no network.
const AudioSys = {
  ctx: null, muted: false, alarmOsc: null, alarmGain: null,

  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  tone(freq, dur, type, vol, when) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(vol || 0.08, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  },

  pickup() { this.tone(880, 0.09, 'sine', 0.07); this.tone(1318, 0.12, 'sine', 0.06, 0.07); },
  keycard() { this.tone(660, 0.08, 'square', 0.04); this.tone(990, 0.14, 'square', 0.04, 0.08); },
  tick() { this.tone(1200, 0.03, 'square', 0.03); },
  denied() { this.tone(180, 0.18, 'sawtooth', 0.06); },
  coin() { this.tone(1568, 0.07, 'triangle', 0.06); },
  smoke() { this.tone(300, 0.25, 'sine', 0.05); },
  crackDone() { this.tone(523, 0.1, 'sine', 0.08); this.tone(659, 0.1, 'sine', 0.08, 0.09); this.tone(784, 0.18, 'sine', 0.08, 0.18); },
  levelClear() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'sine', 0.08, i * 0.1)); },
  caught() { [392, 311, 233, 175].forEach((f, i) => this.tone(f, 0.22, 'sawtooth', 0.06, i * 0.14)); },
  win() { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.08, i * 0.11)); },

  setAlarmLevel(level) {
    if (this.muted) { this.stopAlarm(); return; }
    const ctx = this.ensure();
    if (!ctx) return;
    if (level <= 0.5) { this.stopAlarm(); return; }
    if (!this.alarmOsc) {
      this.alarmOsc = ctx.createOscillator();
      this.alarmGain = ctx.createGain();
      this.alarmOsc.type = 'sawtooth';
      this.alarmOsc.frequency.value = 110;
      this.alarmGain.gain.value = 0;
      this.alarmOsc.connect(this.alarmGain).connect(ctx.destination);
      this.alarmOsc.start();
    }
    const target = 0.012 + level * 0.03;
    this.alarmGain.gain.setTargetAtTime(target, ctx.currentTime, 0.2);
    this.alarmOsc.frequency.setTargetAtTime(110 + level * 90, ctx.currentTime, 0.2);
  },

  stopAlarm() {
    if (this.alarmOsc) {
      try { this.alarmOsc.stop(); } catch (e) {}
      this.alarmOsc = null;
      this.alarmGain = null;
    }
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stopAlarm();
    return this.muted;
  },
};
