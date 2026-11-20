// Excerpt from Tilt Racer (source is private; available on request).
// Copyright (c) 2026 Moses Enyinnaya. All rights reserved. Not licensed for reuse.

// The levels it moves between (from quality.ts):
export const TIERS: Record<Tier, TierSettings> = {
  high: { dprMax: 2, shadowMap: 2048, sceneryShadows: true, particles: 1, lights: true, clearcoat: true },
  medium: { dprMax: 1.25, shadowMap: 1024, sceneryShadows: false, particles: 0.7, lights: true, clearcoat: true },
  low: { dprMax: 1, shadowMap: 0, sceneryShadows: false, particles: 0.4, lights: false, clearcoat: false },
};

const WINDOW_S = 2; // judge the frame rate over this long
const SETTLE_S = 2.5; // ignore frames right after a change (shaders recompile, buffers resize)
const UP_AFTER_S = 12; // smooth this long with headroom before trying a level up
const RETRY_UP_S = 90; // don't retry a level we just had to leave for this long

/**
 * Auto graphics: watches real frame times and moves the quality level (and, at the lowest level,
 * the render resolution) so frames keep up with the display. Steps down quickly when frames run
 * slow, up cautiously when there's clear headroom, and never ping-pongs between two levels.
 */
export function QualityGovernor() {
  const gl = useThree(s => s.gl);
  const st = useRef({ times: [] as number[], since: 0, smoothFor: 0, refresh: 60, leftAt: {} as Partial<Record<Tier, number>>, clock: 0 });

  // first guess (Auto), or the pinned level; and follow the player's choice
  useEffect(() => {
    const apply = () => {
      const pref = qualityPref.get();
      quality.set(pref === 'auto' ? guessTier(gl.getContext()) : pref);
      dprScale.set(1); st.current.since = 0;
    };
    apply();
    return qualityPref.subscribe(apply);
  }, [gl]);

  useFrame((_, delta) => {
    const s = st.current;
    s.clock += delta;
    if (document.hidden || delta > 0.5) return; // a background tab or a one-off stall isn't the device being slow
    s.since += delta;
    if (s.since < SETTLE_S) return;
    s.times.push(delta);
    if (s.times.reduce((a, b) => a + b, 0) < WINDOW_S) return;

    const sorted = [...s.times].sort((a, b) => a - b);
    s.times = [];
    // the display's own rate, from the quickest frames (60, 90, 120 Hz…), capped at 60 as the goal
    s.refresh = Math.min(60, Math.max(30, 1 / sorted[Math.floor(sorted.length * 0.1)]));
    const avgFps = sorted.length / sorted.reduce((a, b) => a + b, 0);
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    if (qualityPref.get() !== 'auto') return;

    const tier = quality.get(), i = TIER_ORDER.indexOf(tier);
    const slow = avgFps < s.refresh * 0.85 || p90 > (1 / s.refresh) * 1.9;
    if (slow) {
      s.smoothFor = 0;
      if (i > 0) { s.leftAt[tier] = s.clock; quality.set(TIER_ORDER[i - 1]); s.since = 0; }
      else if (dprScale.get() > 0.76) { dprScale.set(dprScale.get() - 0.12); s.since = 0; } // render a little smaller still
      return;
    }
    const roomy = avgFps > s.refresh * 0.97 && p90 < (1 / s.refresh) * 1.25;
    s.smoothFor = roomy ? s.smoothFor + WINDOW_S : 0;
    if (s.smoothFor < UP_AFTER_S) return;
    s.smoothFor = 0;
    if (dprScale.get() < 1) { dprScale.set(Math.min(1, dprScale.get() + 0.12)); s.since = 0; return; }
    const up = TIER_ORDER[i + 1];
    if (up && s.clock - (s.leftAt[up] ?? -1e9) > RETRY_UP_S) { quality.set(up); s.since = 0; }
  });

  return null;
}
