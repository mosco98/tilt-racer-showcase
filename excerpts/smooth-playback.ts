// Excerpt from Tilt Racer (source is private; available on request).
// Copyright (c) 2026 Moses Enyinnaya. All rights reserved. Not licensed for reuse.

// From the remote screen's race view: how a car is placed between two host states.

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Where a car is `dt` seconds after a state, along the arc it's turning on. */
function predict(row: CarRow, dt: number) {
  const [, x, y, a, u, vy, r] = row;
  const mid = a + (r * dt) / 2, ca = Math.cos(mid), sa = Math.sin(mid);
  return { x: x + (u * ca - vy * sa) * M * dt, y: y + (u * sa + vy * ca) * M * dt, a: a + r * dt };
}

/** velocity in world units/s from a state */
function velocity(row: CarRow) {
  const [, , , a, u, vy] = row, ca = Math.cos(a), sa = Math.sin(a);
  return { vx: (u * ca - vy * sa) * M, vy: (u * sa + vy * ca) * M };
}

/**
 * Between two states: a cubic Hermite curve through both positions that also matches both
 * velocities (and the same for heading with turn rate), so the car moves exactly as smoothly as
 * it did on the host, with no kinks at the updates.
 */
function between(a: CarRow, b: CarRow, f: number, T: number) {
  const f2 = f * f, f3 = f2 * f;
  const h00 = 2 * f3 - 3 * f2 + 1, h10 = f3 - 2 * f2 + f, h01 = -2 * f3 + 3 * f2, h11 = f3 - f2;
  const va = velocity(a), vb = velocity(b);
  const a1 = a[3] + wrap(b[3] - a[3]);
  return {
    x: h00 * a[1] + h10 * T * va.vx + h01 * b[1] + h11 * T * vb.vx,
    y: h00 * a[2] + h10 * T * va.vy + h01 * b[2] + h11 * T * vb.vy,
    a: h00 * a[3] + h10 * T * a[6] + h01 * a1 + h11 * T * b[6],
  };
}

