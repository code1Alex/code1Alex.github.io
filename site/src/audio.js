const MUSIC_SCALE = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33];
const MUSIC_PATTERN = [0, 2, 4, 3, 2, 1, 3, 2, 0, 2, 4, 5, 4, 3, 2, 1];

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.music = null;
    this.noiseBuffer = null;
    this.musicStarted = false;
    this.musicStep = 0;
    this.nextMusicAt = 0;
    this.muted = false;
    try {
      this.muted = localStorage.getItem('qitian-muted') === '1';
    } catch {
      this.muted = false;
    }
  }

  init() {
    if (this.ctx) {
      this.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;

    const ctx = new AudioCtor();
    const master = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.22;
    master.gain.value = this.muted ? 0 : 0.72;
    master.connect(compressor);
    compressor.connect(ctx.destination);

    const sfx = ctx.createGain();
    sfx.gain.value = 0.82;
    sfx.connect(master);

    const music = ctx.createGain();
    music.gain.value = 0.32;
    music.connect(master);

    const delay = ctx.createDelay(1.2);
    delay.delayTime.value = 0.28;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    music.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(master);

    const length = Math.floor(ctx.sampleRate * 1.5);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;

    this.ctx = ctx;
    this.master = master;
    this.sfx = sfx;
    this.music = music;
    this.noiseBuffer = buffer;
    this.resume();
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setMuted(value) {
    this.muted = value;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(value ? 0 : 0.72, this.ctx.currentTime, 0.03);
    }
    try {
      localStorage.setItem('qitian-muted', value ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  startMusic() {
    this.init();
    if (!this.ctx) return;
    this.musicStarted = true;
    this.nextMusicAt = Math.max(this.ctx.currentTime + 0.1, this.nextMusicAt);
  }

  tone(freq, duration, type = 'sine', volume = 0.2, slideTo = null, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.sfx);
    osc.start(t);
    osc.stop(t + duration + 0.04);
  }

  noise(duration = 0.15, filter = 'lowpass', startFreq = 1200, endFreq = 400, volume = 0.2, when = 0, q = 0.8) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const biquad = this.ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.Q.value = q;
    biquad.frequency.setValueAtTime(Math.max(40, startFreq), t);
    biquad.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(biquad);
    biquad.connect(gain);
    gain.connect(this.sfx);
    src.start(t);
    src.stop(t + duration + 0.03);
  }

  play(name, intensity = 1) {
    if (!this.ctx || this.muted) return;
    const v = Math.min(1.5, intensity);
    switch (name) {
      case 'swing':
        this.noise(0.1, 'bandpass', 900, 2600, 0.09 * v, 0, 1.4);
        this.tone(210, 0.07, 'sine', 0.035 * v, 90);
        break;
      case 'swingHeavy':
        this.noise(0.24, 'bandpass', 320, 1500, 0.18 * v, 0, 1.1);
        this.tone(120, 0.16, 'sine', 0.1 * v, 55);
        break;
      case 'hit':
        this.noise(0.07, 'lowpass', 2600, 500, 0.14 * v, 0, 0.7);
        this.tone(150, 0.11, 'sine', 0.22 * v, 52);
        break;
      case 'crit':
        this.noise(0.09, 'highpass', 1800, 900, 0.1 * v, 0, 0.7);
        this.tone(880, 0.16, 'triangle', 0.12 * v, 1320);
        this.tone(1320, 0.12, 'sine', 0.06 * v, 1760);
        break;
      case 'jump':
        this.noise(0.13, 'bandpass', 420, 1350, 0.075 * v, 0, 1.3);
        break;
      case 'dash':
        this.noise(0.2, 'highpass', 1600, 320, 0.11 * v, 0, 0.6);
        break;
      case 'fire':
        this.noise(0.42, 'bandpass', 600, 180, 0.2 * v, 0, 0.8);
        this.tone(240, 0.3, 'sawtooth', 0.09 * v, 70);
        break;
      case 'explode':
        this.noise(0.32, 'lowpass', 1200, 80, 0.25 * v, 0, 0.7);
        this.tone(80, 0.32, 'sine', 0.22 * v, 34);
        break;
      case 'ult':
        [110, 164.81, 220, 329.63, 440].forEach((f, i) => {
          this.tone(f, 2.1, 'sine', 0.085 * v, f * 0.98, i * 0.02);
        });
        this.noise(0.8, 'bandpass', 220, 2400, 0.12 * v, 0, 0.6);
        break;
      case 'hurt':
        this.tone(130, 0.2, 'square', 0.1 * v, 60);
        this.noise(0.14, 'lowpass', 800, 150, 0.15 * v);
        break;
      case 'death':
        this.noise(0.3, 'lowpass', 900, 60, 0.2 * v);
        this.tone(90, 0.34, 'sine', 0.16 * v, 35);
        break;
      case 'coin':
        this.tone(1180, 0.08, 'sine', 0.055 * v);
        this.tone(1760, 0.14, 'sine', 0.045 * v, 1880, 0.04);
        break;
      case 'equip':
        [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.07 * v, f, i * 0.055));
        break;
      case 'levelup':
        [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          this.tone(f, 0.45, 'triangle', 0.075 * v, f, i * 0.09);
        });
        break;
      case 'heal':
        this.tone(523.25, 0.28, 'sine', 0.06 * v, 784);
        this.tone(784, 0.3, 'sine', 0.04 * v, 1046, 0.08);
        break;
      case 'ui':
        this.tone(520, 0.07, 'triangle', 0.045 * v, 690);
        break;
      case 'wave':
        this.tone(72, 0.55, 'sine', 0.25 * v, 48);
        this.noise(0.32, 'lowpass', 500, 90, 0.16 * v);
        break;
      case 'boss':
        [55, 82.41, 110, 220].forEach((f, i) => this.tone(f, 1.9, 'sine', 0.09 * v, f, i * 0.02));
        break;
      case 'miss':
        this.noise(0.08, 'highpass', 2000, 3200, 0.05 * v);
        break;
      default:
        break;
    }
  }

  pluck(freq, duration, volume, when = 0, type = 'triangle') {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.music);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  updateMusic() {
    if (!this.ctx || !this.musicStarted || this.muted) return;
    const now = this.ctx.currentTime;
    // Don't schedule a burst of missed notes after the tab has been in the background.
    if (this.nextMusicAt < now - 0.4) this.nextMusicAt = now + 0.1;
    while (this.nextMusicAt < now + 0.35) {
      const step = this.musicStep % MUSIC_PATTERN.length;
      const noteIndex = MUSIC_PATTERN[step];
      const freq = MUSIC_SCALE[noteIndex];
      const when = Math.max(0, this.nextMusicAt - now);
      this.pluck(freq, 1.1, 0.045, when, 'triangle');
      if (step % 4 === 0) this.pluck(freq / 2, 2.4, 0.05, when, 'sine');
      if (step % 8 === 4) this.pluck(freq * 2, 0.7, 0.015, when + 0.12, 'sine');
      this.nextMusicAt += 0.44;
      this.musicStep += 1;
    }
  }
}
