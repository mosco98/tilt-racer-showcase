// Excerpt from Tilt Racer (source is private; available on request).
// Copyright (c) 2026 Moses Enyinnaya. All rights reserved. Not licensed for reuse.

import { VOICE_FRAME } from '@/lib/voiceCodec';

const FRAMES_PER_SEND = 3; // 60 ms a message
const HANG_FRAMES = 15; // keep sending 300 ms after the last loud frame (don't clip word endings)
const PRE_FRAMES = 3; // and include 60 ms from just before speech started (don't clip the onset)
const MIN_LEVEL = 0.012; // ≈ −38 dBFS: a voice held ~40 cm from the phone, not a TV across the room
const OVER_FLOOR = 3.5; // and ≈ 11 dB above the background noise
const MAKEUP = 2; // phone mics are quiet; a soft limiter keeps loud words from clipping

/**
 * Voice activity gate for the phone mic: sends only while the player is actually talking, so a
 * quiet room costs nothing and background noise isn't broadcast. Tracks the noise floor (falls
 * fast, rises slowly so speech doesn't drag it up).
 */
export class VoiceGate {
  private floor = 0.004;
  private hang = 0;
  private pre: Float32Array[] = [];
  private batch: Float32Array[] = [];
  open = false;

  /** feed one 20 ms frame; returns 60 ms of audio to send, or null */
  push(frame: Float32Array): Float32Array | null {
    let sum = 0;
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    const rms = Math.sqrt(sum / frame.length);
    this.floor = rms < this.floor ? this.floor * 0.9 + rms * 0.1 : this.floor * 0.998 + rms * 0.002;
    const loud = rms > Math.max(MIN_LEVEL, this.floor * OVER_FLOOR);

    if (loud) {
      if (!this.open) { this.open = true; this.batch.push(...this.pre); this.pre = []; }
      this.hang = HANG_FRAMES;
    } else if (this.open && --this.hang <= 0) {
      this.open = false;
      this.batch.push(frame);
      return this.flush();
    }
    if (!this.open) {
      this.pre.push(frame);
      if (this.pre.length > PRE_FRAMES) this.pre.shift();
      return null;
    }
    this.batch.push(frame);
    return this.batch.length >= FRAMES_PER_SEND ? this.flush() : null;
  }

  private flush() {
    const out = new Float32Array(this.batch.length * VOICE_FRAME);
    this.batch.forEach((f, i) => out.set(f, i * VOICE_FRAME));
    this.batch = [];
    for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * MAKEUP);
    return out;
  }
}
