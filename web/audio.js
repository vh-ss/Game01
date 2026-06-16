// Tiny synth — all sound generated live via Web Audio (no files needed).
(function () {
  let ac = null, master = null, musicOn = true, musicTimer = null, step = 0;

  function ctx() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.45; master.connect(ac.destination);
    }
    return ac;
  }
  function resume() { if (ac && ac.state === 'suspended') ac.resume(); }

  function tone(freq, dur, type, vol, when) {
    const a = ctx(), t = when || a.currentTime;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol || 0.2, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
    return o;
  }
  function noise(dur, vol, filt, when) {
    const a = ctx(), t = when || a.currentTime;
    const n = a.createBufferSource(), b = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = b;
    const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt || 1200;
    const g = a.createGain(); g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + dur);
  }

  const SFX = {
    shoot(p) { resume(); tone(200 + (p || 0) * 70, 0.07, 'square', 0.10); noise(0.05, 0.06, 1800); },
    eshoot(p) { resume(); tone(150 - (p || 0) * 25, 0.10, 'sawtooth', 0.08); noise(0.06, 0.05, 800); },
    coin() { resume(); const a = ctx(), t = a.currentTime; tone(880, 0.08, 'sine', 0.16, t); tone(1320, 0.10, 'sine', 0.16, t + 0.07); },
    hurt() { resume(); tone(110, 0.16, 'sawtooth', 0.18); noise(0.10, 0.10, 500); },
    zombie() { resume(); const a = ctx(), t = a.currentTime; const o = tone(280, 0.22, 'sawtooth', 0.14, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.22); },
    pickup() { resume(); const a = ctx(), t = a.currentTime;[523, 659, 784].forEach((f, i) => tone(f, 0.10, 'triangle', 0.15, t + i * 0.06)); },
    win() { resume(); const a = ctx(), t = a.currentTime;[523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.2, t + i * 0.13)); },
    lose() { resume(); const a = ctx(), t = a.currentTime;[392, 330, 262].forEach((f, i) => tone(f, 0.28, 'sawtooth', 0.18, t + i * 0.2)); },
  };

  // cheerful background loop (bass + arpeggio), scheduled every bar
  const bass = [130.81, 130.81, 174.61, 196.00];
  const arp = [523.25, 659.25, 783.99, 659.25];
  function bar() {
    if (!musicOn) return;
    const a = ctx(), t = a.currentTime;
    tone(bass[step % bass.length], 0.5, 'triangle', 0.09, t);
    tone(bass[step % bass.length] / 2, 0.5, 'sine', 0.06, t);
    for (let i = 0; i < 4; i++) tone(arp[(step + i) % arp.length], 0.16, 'sine', 0.04, t + i * 0.15);
    step++;
  }
  function startMusic() { if (musicTimer || !musicOn) return; bar(); musicTimer = setInterval(bar, 620); }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

  window.AUDIO = {
    start() { ctx(); resume(); },
    sfx: SFX,
    startMusic, stopMusic,
    toggleMusic() { musicOn = !musicOn; if (musicOn) startMusic(); else stopMusic(); return musicOn; },
    get musicOn() { return musicOn; },
  };
})();
