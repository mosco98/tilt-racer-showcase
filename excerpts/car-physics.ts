// Excerpt from Tilt Racer (source is private; available on request).
// Copyright (c) 2026 Moses Enyinnaya. All rights reserved. Not licensed for reuse.

// Car physics (real units, 1350 kg RWD coupe): tyre model and speed-sensitive steering.

// Simplified Pacejka "magic formula": side force vs. slip angle, rising then saturating past the
// peak, so cars can slide and drift. Scaled by each axle's grip after the friction circle.
function tyreCurve(alpha: number, stiffness: number) {
  return Math.sin(1.45 * Math.atan(stiffness * alpha));
}
const STIFF_FRONT = 9, STIFF_REAR = 11.5;

export function steeringLock(u: number) {
  // geometric angle for a limit-speed corner, plus the slip angle a front tyre works at near its
  // peak (~10°): without that headroom full tilt couldn't reach the grip limit at speed
  const gripLock = (LOCK_MARGIN * WHEELBASE * SURFACE.asphalt.mu * G) / Math.max(u * u, 1) + PEAK_SLIP_HEADROOM;
  return Math.min(MAX_WHEEL / (1 + Math.abs(u) / STEER_SPEED_REF), gripLock);
}

// Boost ("beast mode"): cover ground 1.5x faster than the tyres think, so speed is 1.5x at any
// pace while grip and the cornering line stay the same (inside stepCar):
const warpTo = boosted ? BOOST_WARP : 1;
p.warp = (p.warp ?? 1) + (warpTo - (p.warp ?? 1)) * Math.min(1, dt * WARP_RATE);
if (Math.abs(p.warp - warpTo) < 0.002) p.warp = warpTo;
const warp = p.warp;
