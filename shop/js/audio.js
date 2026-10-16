/**
 * audio.js — the rain, generated rather than loaded.
 *
 * There is no sound file. Rain is filtered noise, so it is synthesised: two
 * noise buffers through a lowpass and a bandpass, with a slow random walk on the
 * cutoff so the downpour breathes instead of hissing at a fixed pitch. That
 * keeps the project free of binary assets and means the rain can never be the
 * thing that fails to load.
 *
 * Two things were wrong with the first version and are fixed here:
 *
 *   - It was far too loud. The master gain was 0.34, which is not a background
 *     noise, it is a appliance. It now opens at 0.07 and the whole mix is scaled
 *     off that one number.
 *
 *   - The hiss band sat at 5.2 kHz, which is where "rain" turns into the sound
 *     of a broken television. Moved down to 3.1 kHz and narrowed, with the body
 *     lowpass down from 1.5 kHz to 950 Hz, so it reads as weather rather than as
 *     static.
 *
 * Browsers refuse to start audio without a user gesture; the first click
 * anywhere is the gesture. The level is then controlled from the small panel in
 * the corner, or with M.
 */

const FADE_SECONDS = 1.4;

/** Where the mix sits with the slider at 100. Deliberately quiet. */
const MAX_GAIN = 0.07;
const DEFAULT_LEVEL = 0.62;

function noiseBuffer(context, seconds = 4) {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);

  // Brown-ish noise: a running sum, clamped. Closer to how rain actually sounds
  // than white noise, which is far too bright on its own.
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  return buffer;
}

export function buildAudio() {
  let context = null;
  let master = null;
  let started = false;
  let enabled = true;
  let volume = DEFAULT_LEVEL;

  const gainFor = () => (enabled ? MAX_GAIN * volume : 0);

  function fadeTo(value) {
    if (!context || !master) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(value, now + FADE_SECONDS);
  }

  function start() {
    if (started) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    started = true;

    context = new AudioContextClass();
    master = context.createGain();
    // Start silent and fade in, or the first moment of audio is a click.
    master.gain.value = 0;
    master.connect(context.destination);

    const source = context.createBufferSource();
    source.buffer = noiseBuffer(context);
    source.loop = true;

    // The body of the downpour: dull, wide, and the thing that carries the
    // volume.
    const body = context.createBiquadFilter();
    body.type = 'lowpass';
    body.frequency.value = 950;
    body.Q.value = 0.5;

    // The sound of it landing. Narrow and quiet — this is the band that turns
    // into a hiss if it is left bright.
    const hiss = context.createBiquadFilter();
    hiss.type = 'bandpass';
    hiss.frequency.value = 3100;
    hiss.Q.value = 0.7;

    const hissGain = context.createGain();
    hissGain.gain.value = 0.14;

    const bodyGain = context.createGain();
    bodyGain.gain.value = 1.0;

    source.connect(body);
    source.connect(hiss);
    hiss.connect(hissGain);
    body.connect(bodyGain);
    bodyGain.connect(master);
    hissGain.connect(master);

    source.start();
    fadeTo(gainFor());

    // A slow random walk on the body cutoff, so the rain rises and falls instead
    // of sitting at one pitch for as long as anyone cares to listen.
    const walk = () => {
      if (!context || context.state === 'closed') return;
      const next = 780 + Math.random() * 520;
      body.frequency.linearRampToValueAtTime(next, context.currentTime + 7 + Math.random() * 9);
      setTimeout(walk, 8000 + Math.random() * 7000);
    };
    walk();
  }

  return {
    /** Called on the first pointer down anywhere. */
    start,

    setVolume(next) {
      volume = Math.max(0, Math.min(1, next));
      fadeTo(gainFor());
    },

    toggle() {
      enabled = !enabled;
      fadeTo(gainFor());
      return enabled;
    },

    get enabled() {
      return enabled;
    },

    get volume() {
      return volume;
    },

    get running() {
      return started;
    },
  };
}
