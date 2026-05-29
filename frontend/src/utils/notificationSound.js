/**
 * Plays a two-tone notification chime using the Web Audio API.
 * No external audio file needed — synthesised in the browser.
 */
export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    const playTone = (freq, startAt, duration, gain = 0.35) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();

      osc.connect(vol);
      vol.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);

      // Soft attack + decay envelope
      vol.gain.setValueAtTime(0, ctx.currentTime + startAt);
      vol.gain.linearRampToValueAtTime(gain, ctx.currentTime + startAt + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);

      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration);
    };

    // Two-tone chime: G5 then B5
    playTone(784, 0,    0.35);
    playTone(988, 0.18, 0.45);

    // Close context after chime finishes
    setTimeout(() => ctx.close(), 800);
  } catch (_) {
    // AudioContext not available (SSR, locked browser, etc.) — silent fallback
  }
}
