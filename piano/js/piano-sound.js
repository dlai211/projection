/**
 * Making the sound: the recorded piano, with a plain tone standing in for anything the
 * recordings cannot cover.
 *
 * The 88 samples in piano-mp3/ are one file per key, named with flats (Db, Eb, Gb, Ab,
 * Bb) rather than sharps. They are fetched the first time a key is played and kept, so
 * a long practice session fetches each key once. Fetching fails when the page is opened
 * straight from disk — browsers refuse it — and anything that fails falls back to the
 * synthesised tone, which is also what covers a note with no recording at all.
 */
window.App = window.App || {};

window.App.PianoSound = (function () {
  'use strict';

  const Config = window.App.Config;
  const Pitch = window.App.Pitch;

  const buffers = Object.create(null);
  const pending = Object.create(null);
  let samplesUsable = true;

  /** "A4", "Bb3", "Db5" — the spelling the files on disk use. */
  function fileNameFor(midi) {
    const letter = Config.samples.fileNames[Pitch.pitchClassOf(midi)];
    return letter + Pitch.octaveOf(midi) + '.mp3';
  }

  function urlFor(midi) {
    return Config.samples.folder + fileNameFor(midi);
  }

  /** Fetch and decode one sample. Resolves to null when it cannot be had. */
  function load(context, midi) {
    const key = fileNameFor(midi);
    if (buffers[key]) return Promise.resolve(buffers[key]);
    if (pending[key]) return pending[key];
    if (!samplesUsable) return Promise.resolve(null);

    pending[key] = fetch(urlFor(midi))
      .then(function (response) {
        if (!response.ok) throw new Error(response.status + ' for ' + key);
        return response.arrayBuffer();
      })
      .then(function (bytes) { return context.decodeAudioData(bytes); })
      .then(function (buffer) {
        buffers[key] = buffer;
        delete pending[key];
        return buffer;
      })
      .catch(function () {
        // Opened from disk, or a file that is not there: stop asking, use the tone.
        samplesUsable = false;
        delete pending[key];
        return null;
      });

    return pending[key];
  }

  /** Warm the keys a measure needs, so the first play is not the one that stutters. */
  function preload(context, midis) {
    midis.forEach(function (midi) { load(context, midi); });
  }

  /**
   * Play one note.
   *
   * @param {AudioContext} context
   * @param {AudioNode} destination
   * @param {number} midi
   * @param {number} when       audio-clock time to start
   * @param {number} duration   seconds to hold it
   * @param {number} [loudness] 0..1
   */
  function play(context, destination, midi, when, duration, loudness) {
    const handle = { nodes: [], stopped: false };
    handle.stop = function () {
      handle.stopped = true;
      handle.nodes.forEach(function (node) {
        try { node.stop(); } catch (error) { /* already finished */ }
      });
      handle.nodes.length = 0;
    };

    if (!Pitch.isValidMidi(midi)) return handle;
    const level = loudness === undefined ? 0.75 : loudness;
    const key = fileNameFor(midi);

    if (buffers[key]) {
      handle.nodes.push(playBuffer(context, destination, buffers[key], when, duration, level));
      return handle;
    }

    // Not loaded yet (or unobtainable): sound the note now, and if the recording
    // arrives while it is still ringing, let it take over.
    handle.nodes.push.apply(handle.nodes, playSynth(context, destination, midi, when, duration, level));
    load(context, midi).then(function (buffer) {
      if (!buffer || handle.stopped) return;
      if (context.currentTime < when + duration * 0.5) {
        handle.nodes.push(playBuffer(context, destination, buffer,
          Math.max(when, context.currentTime), duration, level));
      }
    });

    return handle;
  }

  function playBuffer(context, destination, buffer, when, duration, level) {
    const source = context.createBufferSource();
    const gain = context.createGain();
    const start = Math.max(when, context.currentTime);
    const release = Config.playback.releaseSeconds;
    const held = Math.max(0.1, duration);

    source.buffer = buffer;
    // The recordings are short; hold the note with a gentle fade rather than a click.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(level, start + 0.008);
    gain.gain.setValueAtTime(level, start + held);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + held + release);

    source.connect(gain);
    gain.connect(destination);
    source.start(start);
    source.stop(start + held + release + 0.02);
    return source;
  }

  /** A struck-string-ish tone, for notes the recordings cannot reach. */
  function playSynth(context, destination, midi, when, duration, level) {
    const frequency = Pitch.frequency(midi);
    const start = Math.max(when, context.currentTime);
    const held = Math.max(0.15, duration);
    const release = Config.playback.releaseSeconds;

    const partials = [
      { ratio: 1, gain: 1, type: 'triangle' },
      { ratio: 2, gain: 0.28, type: 'sine' },
      { ratio: 3, gain: 0.12, type: 'sine' }
    ];

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(level * 0.5, start + 0.006);
    envelope.gain.exponentialRampToValueAtTime(level * 0.18, start + Math.min(0.5, held));
    envelope.gain.setValueAtTime(level * 0.18, start + held);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + held + release);
    envelope.connect(destination);

    return partials.map(function (partial) {
      const oscillator = context.createOscillator();
      const mix = context.createGain();
      oscillator.type = partial.type;
      oscillator.frequency.value = frequency * partial.ratio;
      mix.gain.value = partial.gain;
      oscillator.connect(mix);
      mix.connect(envelope);
      oscillator.start(start);
      oscillator.stop(start + held + release + 0.05);
      return oscillator;
    });
  }

  return {
    play: play,
    load: load,
    preload: preload,
    fileNameFor: fileNameFor,
    urlFor: urlFor,
    samplesUsable: function () { return samplesUsable; }
  };
})();
