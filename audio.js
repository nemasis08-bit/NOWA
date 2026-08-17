/**
 * Procedural Web Audio Synthesizer for Iron Man HUD
 * Generates custom synthesized SFX for Repulsor, Mechanical Servos, Lightning Crackle, and Thrusters.
 */
export class AudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.masterGain = null;
    this.servoOsc = null;
    this.servoGain = null;
    this.thrusterNoise = null;
    this.thrusterGain = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
      this.enabled = true;
    } catch (e) {
      console.warn("Web Audio API not supported or blocked", e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleAudio() {
    if (!this.initialized) {
      this.init();
    }
    this.resume();
    this.enabled = !this.enabled;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.enabled ? 0.3 : 0, this.ctx.currentTime);
    }
    return this.enabled;
  }

  /**
   * Repulsor Charge & Fire FX
   * Layered oscillators (Sawtooth + Sine) passing through a BiquadFilterNode with animating frequency envelope.
   */
  playRepulsorCharge(duration = 0.8) {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;

    // Oscillators: Sine (fundamental) + Sawtooth (harmonic energy)
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sawtooth';

    // Frequency Envelope: Sweep from 120Hz up to 1800Hz
    osc1.frequency.setValueAtTime(120, now);
    osc1.frequency.exponentialRampToValueAtTime(1800, now + duration);
    osc2.frequency.setValueAtTime(240, now);
    osc2.frequency.exponentialRampToValueAtTime(3600, now + duration);

    // Filter Envelope: Dynamic Lowpass Filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(8, now);
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(8000, now + duration);

    // Gain Envelope
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.exponentialRampToValueAtTime(0.5, now + duration * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  }

  playRepulsorBlast() {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;

    // Explosive attack oscillator
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.4);

    // White noise blast layer
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1500, now);
    filter.Q.setValueAtTime(3, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    noise.start(now);
    osc.stop(now + 0.4);
    noise.stop(now + 0.4);
  }

  /**
   * Mechanical Servo "Clank" FX
   * White noise buffer passed through a high-pass filter with sharp volume decay.
   */
  playMechanicalClank() {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    // Metallic tone layer
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.4, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    noise.start(now);
    osc.start(now);
    noise.stop(now + 0.15);
    osc.stop(now + 0.15);
  }

  /**
   * High-Voltage Lightning Crackle FX
   */
  playLightningCrackle() {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const burstTime = now + i * 0.04;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(2000 + Math.random() * 3000, burstTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, burstTime);
      gain.gain.exponentialRampToValueAtTime(0.001, burstTime + 0.03);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(burstTime);
      osc.stop(burstTime + 0.03);
    }
  }

  /**
   * Continuous Servo Hum (e.g. Open Palm / Active Tracking)
   */
  startServoHum() {
    if (!this.enabled || !this.ctx || this.servoOsc) return;
    this.resume();
    const now = this.ctx.currentTime;

    this.servoOsc = this.ctx.createOscillator();
    this.servoGain = this.ctx.createGain();

    this.servoOsc.type = 'sine';
    this.servoOsc.frequency.setValueAtTime(180, now);

    this.servoGain.gain.setValueAtTime(0.01, now);
    this.servoGain.gain.linearRampToValueAtTime(0.12, now + 0.3);

    this.servoOsc.connect(this.servoGain);
    this.servoGain.connect(this.masterGain);
    this.servoOsc.start(now);
  }

  stopServoHum() {
    if (this.servoGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.servoGain.gain.linearRampToValueAtTime(0.001, now + 0.2);
      setTimeout(() => {
        if (this.servoOsc) {
          this.servoOsc.stop();
          this.servoOsc.disconnect();
          this.servoOsc = null;
        }
      }, 200);
    }
  }
}
