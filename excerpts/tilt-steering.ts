// Excerpt from Tilt Racer (source is private; available on request).
// Copyright (c) 2026 Moses Enyinnaya. All rights reserved. Not licensed for reuse.

// Turns raw phone motion into a steering-wheel angle that feels like holding a real wheel.
//
// Works however the phone is held: upright like a steering wheel, tipped back, or flat.
// - The wheel angle is how far the phone's long edge is tilted from horizontal (one end raised),
//   which is what turning a wheel does in every grip: atan2(side · s, √(up² + out²)), where
//   "side" is gravity along the long edge, "up" along the screen's top edge and "out" along the
//   screen normal. (An earlier version measured rotation in the screen's plane only, which fades
//   out as the phone lies flat.)
// - s = sign(up) fixes both the readings' sign convention (iOS vs Android vs spec) and which way
//   round the phone is held. A flat phone reads the same gravity either way round, so s is
//   remembered from whenever the phone isn't flat; if it starts flat, it comes from the screen's
//   landscape direction (hint) and the sign of the screen-normal reading.
// - The controller is landscape-only, so the long edge is always the device's y axis. (Guessing
//   the grip from gravity broke when the phone lay flat, where neither edge carries gravity.)
// - The gyroscope gives instant, jitter-free response. It is projected onto the actual steering
//   axis (perpendicular to gravity and the long edge), and since its sign, units and even axis
//   naming vary by platform it is only used once it has proven to agree with the accelerometer,
//   and dropped the moment they disagree. Until then a One Euro filter smooths the accelerometer.
//
// No imports on purpose: this file is pure maths and runs under plain Node for testing.
// …

/** One Euro filter: little smoothing when moving fast, lots when still. */
class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  constructor(minCutoff: number, beta: number, dCutoff = 1) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }
  private static alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(value: number, dt: number) {
    if (this.x == null) { this.x = value; return value; }
    const rawDx = (value - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
  reset(value?: number) { this.x = value ?? null; this.dx = 0; }
}

// …the wheel angle from gravity (inside TiltSensor.push):
  const up = s.gx, side = s.gy; // landscape: screen-top edge = device x, long edge = device y
  const out = s.gz;
  const mag = Math.hypot(s.gx, s.gy, s.gz);
  const across = Math.hypot(up, out); // gravity in the plane across the long edge
  if (Math.abs(up) > 0.25 * G) this.holdSign = Math.sign(up);
  else if (this.holdSign == null && s.hold != null && Math.abs(out) > 0.5 * G) this.holdSign = Math.sign(out) * s.hold;
  // Trust the accelerometer at ~1 g, with the long edge turned < ~70°, once the grip is known.
  const accOk = this.holdSign != null && Math.abs(mag - G) < 0.15 * G && across > 0.35 * G;
  const acc = accOk ? Math.atan2(side * this.holdSign!, across) * DEG : null;
