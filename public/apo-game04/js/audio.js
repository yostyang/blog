'use strict';

/* ---------------------------------------------------------------
   全程序化音效，没有外部音频文件
   --------------------------------------------------------------- */

const Sfx = (() => {
  let ac = null;
  let master = null;
  let noise = null;
  let muted = false;
  let ready = false;
  let captureDest = null;

  const MASTER = 0.5;

  function init() {
    if (ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ac = new AC();
      master = ac.createGain();
      master.gain.value = muted ? 0 : MASTER;
      master.connect(ac.destination);
      const len = Math.floor(ac.sampleRate * 0.8);
      noise = ac.createBuffer(1, len, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      ready = true;
    } catch (err) {
      ready = false;
    }
  }

  let lastResume = 0;
  function resume() {
    init();
    if (ac && ac.state === 'suspended') {
      const now = performance.now();
      if (now - lastResume > 600) {
        lastResume = now;
        ac.resume();
      }
    }
  }

  function tone(o) {
    if (!ready || muted) return;
    const t0 = ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1 && o.f1 !== o.f0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + (o.dur || 0.15));
    }
    const peak = o.gain == null ? 0.12 : o.gain;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.dur || 0.15));
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + (o.dur || 0.15) + 0.03);
  }

  function noiseBurst(o) {
    if (!ready || muted) return;
    const t0 = ac.currentTime + (o.delay || 0);
    const src = ac.createBufferSource();
    src.buffer = noise;
    const f = ac.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.Q.value = o.q == null ? 1 : o.q;
    f.frequency.setValueAtTime(o.f0 || 800, t0);
    if (o.f1 && o.f1 !== o.f0) {
      f.frequency.exponentialRampToValueAtTime(Math.max(60, o.f1), t0 + (o.dur || 0.15));
    }
    const g = ac.createGain();
    const peak = o.gain == null ? 0.1 : o.gain;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.dur || 0.15));
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + (o.dur || 0.15) + 0.03);
  }

  const api = {
    resume,
    get muted() { return muted; },
    setMuted(m) {
      muted = !!m;
      if (master && ac) {
        master.gain.cancelScheduledValues(ac.currentTime);
        master.gain.setTargetAtTime(muted ? 0 : MASTER, ac.currentTime, 0.02);
      }
      try { localStorage.setItem('paperduel.muted', muted ? '1' : '0'); } catch (e) {}
    },
    toggle() {
      api.setMuted(!muted);
      return muted;
    },
    load() {
      try {
        muted = localStorage.getItem('paperduel.muted') === '1';
      } catch (e) { muted = false; }
    },
    enableCapture() {
      init();
      if (!ac || !master) return null;
      if (!captureDest) {
        captureDest = ac.createMediaStreamDestination();
        master.connect(captureDest);
      }
      return captureDest.stream;
    },
    ui() {
      tone({ type: 'sine', f0: 680, f1: 860, dur: 0.06, gain: 0.05 });
    },
    count() {
      tone({ type: 'sine', f0: 520, f1: 560, dur: 0.12, gain: 0.06 });
      noiseBurst({ f0: 1400, f1: 900, dur: 0.08, gain: 0.025, filter: 'bandpass' });
    },
    fight() {
      tone({ type: 'sine', f0: 420, f1: 840, dur: 0.2, gain: 0.09 });
      noiseBurst({ f0: 500, f1: 2200, dur: 0.25, gain: 0.06, filter: 'bandpass' });
    },
    swing(kind) {
      const heavy = kind === 'heavy';
      noiseBurst({
        f0: heavy ? 380 : 620,
        f1: heavy ? 1300 : 1900,
        dur: heavy ? 0.16 : 0.1,
        gain: heavy ? 0.06 : 0.04,
        filter: 'bandpass',
        q: 1.4
      });
    },
    hit(power) {
      const p = clamp(power / 12, 0.35, 1.4);
      tone({ type: 'sine', f0: 190 * (1.2 - p * 0.3), f1: 48, dur: 0.2, gain: 0.12 + p * 0.09 });
      noiseBurst({ f0: 900, f1: 180, dur: 0.13, gain: 0.08 + p * 0.06, filter: 'lowpass', q: 0.8 });
      if (power >= 11) {
        tone({ type: 'triangle', f0: 90, f1: 42, dur: 0.28, gain: 0.1, delay: 0.01 });
      }
    },
    block() {
      noiseBurst({ f0: 2600, f1: 1500, dur: 0.06, gain: 0.09, filter: 'highpass' });
      tone({ type: 'square', f0: 320, f1: 260, dur: 0.05, gain: 0.04 });
    },
    jump() {
      tone({ type: 'sine', f0: 280, f1: 480, dur: 0.1, gain: 0.045 });
      noiseBurst({ f0: 500, f1: 1200, dur: 0.08, gain: 0.018 });
    },
    land() {
      tone({ type: 'sine', f0: 95, f1: 48, dur: 0.12, gain: 0.06 });
      noiseBurst({ f0: 340, f1: 120, dur: 0.1, gain: 0.03, filter: 'lowpass' });
    },
    ko() {
      tone({ type: 'sawtooth', f0: 210, f1: 38, dur: 0.9, gain: 0.13 });
      tone({ type: 'sine', f0: 105, f1: 32, dur: 1.1, gain: 0.12, delay: 0.05 });
      noiseBurst({ f0: 1200, f1: 100, dur: 0.6, gain: 0.09, filter: 'lowpass' });
    },
    super() {
      tone({ type: 'sawtooth', f0: 120, f1: 760, dur: 0.36, gain: 0.08 });
      tone({ type: 'square', f0: 60, f1: 160, dur: 0.42, gain: 0.05 });
      noiseBurst({ f0: 300, f1: 3800, dur: 0.36, gain: 0.08, filter: 'bandpass', q: 1.2 });
    },
    page() {
      noiseBurst({ f0: 600, f1: 2600, dur: 0.28, gain: 0.09, filter: 'bandpass', q: 1.1 });
      noiseBurst({ f0: 1800, f1: 500, dur: 0.18, gain: 0.035, filter: 'highpass', delay: 0.08 });
    },
    win() {
      tone({ type: 'sine', f0: 523, dur: 0.16, gain: 0.07 });
      tone({ type: 'sine', f0: 659, dur: 0.18, gain: 0.07, delay: 0.12 });
      tone({ type: 'sine', f0: 784, dur: 0.3, gain: 0.08, delay: 0.24 });
      noiseBurst({ f0: 1200, f1: 3000, dur: 0.3, gain: 0.03, filter: 'highpass', delay: 0.24 });
    }
  };

  api.load();
  return api;
})();
