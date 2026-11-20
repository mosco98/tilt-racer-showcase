// Excerpt from Tilt Racer (source is private; available on request).
// Copyright (c) 2026 Moses Enyinnaya. All rights reserved. Not licensed for reuse.

const STATE_MS = 1000 / 30; // the host sends 30 states a second
const MARGIN_MS = 8;
const MIN_DELAY_MS = 40, MAX_DELAY_MS = 220;
const SLEW = 0.08; // the playback clock may run up to 8 % fast or slow to drift onto its target
const JUMP_MS = 400; // further off than this (tab was hidden, host restarted): jump straight there

/**
 * A remote screen's playback clock, on the host's time, running a little behind live.
 *
 *  - offset: host time → local time, from the fastest deliveries (the true one-way trip, plus
 *    clock difference).
 *  - lateness: how much later than that updates usually arrive (an envelope that follows spikes
 *    up quickly and relaxes slowly), i.e. how uneven this connection is.
 *  - delay: one update interval + lateness + a margin, so a state on each side of the playback
 *    moment has nearly always arrived.
 *
 * The clock moves at real-time speed and only speeds up or slows down slightly to follow changes,
 * so the race on screen never steps or stutters, even as the network does.
 */
export class PlayoutClock {
  private offset = Infinity;
  private lateness = 20;
  private t = NaN;

  /** the playback moment, host time (ms) */
  get time() {
    return this.t;
  }

  get delay() {
    return Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, STATE_MS + this.lateness + MARGIN_MS));
  }

  /** a state stamped `hostAt` arrived at local time `arrived` */
  sample(hostAt: number, arrived: number) {
    const s = arrived - hostAt;
    if (!Number.isFinite(this.offset)) this.offset = s;
    // toward a faster delivery quickly; drift up very slowly (clocks drift a little)
    else this.offset += (s - this.offset) * (s < this.offset ? 0.2 : 0.002);
    const late = Math.max(0, s - this.offset);
    this.lateness += (late - this.lateness) * (late > this.lateness ? 0.3 : 0.01);
  }

  /** move on by a frame; returns the playback moment */
  advance(now: number, frameMs: number) {
    if (!Number.isFinite(this.offset)) return this.t;
    const target = now - this.offset - this.delay;
    if (!Number.isFinite(this.t) || Math.abs(target - this.t) > JUMP_MS) this.t = target;
    else this.t += frameMs * (1 + Math.max(-SLEW, Math.min(SLEW, (target - this.t) / 500)));
    return this.t;
  }
}
