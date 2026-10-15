/**
 * Listening Mode: playing the score back.
 *
 * A measure is scheduled all at once — every melody note and every note of the
 * left-hand chord — then a timer moves on to the next one. Timing comes from the same
 * note lengths the layout uses, so what you hear and what you see agree: at a dotted
 * quarter = 50 one eighth lasts 0.4 s, which is half of the 6/8 bar.
 *
 * Pausing stops the sound and remembers the measure; carrying on plays that measure
 * again from its start. Nothing is scheduled more than a bar ahead, so stopping is
 * immediate rather than leaving a queue of notes to ring out.
 */
window.App = window.App || {};

window.App.Playback = (function () {
  'use strict';

  const Config = window.App.Config;
  const Sound = window.App.PianoSound;

  let context = null;
  let destination = null;
  let handles = [];
  let timer = null;
  let running = false;
  let where = null;              // { measure, toEnd }
  let hooks = {};

  function noop() {}

  /** How long a measure lasts, from the melody's own note lengths. */
  function secondsOf(measure) {
    const units = measure.rh.reduce(function (total, note) { return total + note.units; }, 0);
    return Math.max(1, units) * Config.tempo.eighthSeconds;
  }

  /** Start playing. `options.measureAt(n)` must return the laid-out measure. */
  function play(options) {
    stop();

    context = options.context;
    destination = options.destination;
    hooks = {
      measureAt: options.measureAt,
      total: options.total,
      onMeasure: options.onMeasure || noop,
      onFinish: options.onFinish || noop
    };
    where = { measure: options.measure, toEnd: !!options.toEnd };
    running = true;
    startMeasure();
  }

  function startMeasure() {
    const measure = hooks.measureAt(where.measure);
    if (!measure) return finish();

    clearHandles();
    const at = context.currentTime + Config.playback.leadInSeconds;
    schedule(measure, at);
    hooks.onMeasure(where.measure, at);

    clearTimeout(timer);
    timer = setTimeout(advance, secondsOf(measure) * 1000);
  }

  function advance() {
    if (!running) return;
    if (!where.toEnd || where.measure >= hooks.total) return finish();
    where.measure++;
    startMeasure();
  }

  /** Lay every note of one measure onto the audio clock. */
  function schedule(measure, at) {
    const eighth = Config.tempo.eighthSeconds;
    const starts = [];
    let elapsed = 0;

    measure.rh.forEach(function (note) {
      starts.push(elapsed);
      elapsed += note.units;
    });

    const wholeBar = Math.max(1, elapsed) * eighth;

    measure.rh.forEach(function (note, index) {
      const when = at + starts[index] * eighth;
      const length = Math.max(0.25, note.units * eighth * 0.95);
      note.notes.forEach(function (midi) {
        handles.push(Sound.play(context, destination, midi, when, length, 0.7));
      });
    });

    measure.lh.forEach(function (chord) {
      const when = at + (starts[chord.beatIndex] || 0) * eighth;
      // A held bass note lasts the bar; a moving one lasts until its next entry.
      const held = chord.beatIndex === 0 ? wholeBar * 0.95 : wholeBar * 0.5;
      chord.notes.forEach(function (midi) {
        handles.push(Sound.play(context, destination, midi, when, held, 0.55));
      });
    });
  }

  function clearHandles() {
    handles.forEach(function (handle) { handle.stop(); });
    handles = [];
  }

  function pause() {
    if (!running) return;
    clearTimeout(timer);
    clearHandles();
    running = false;
  }

  function resume() {
    if (where) play({
      context: context,
      destination: destination,
      measureAt: hooks.measureAt,
      total: hooks.total,
      onMeasure: hooks.onMeasure,
      onFinish: hooks.onFinish,
      measure: where.measure,
      toEnd: where.toEnd
    });
  }

  function stop() {
    clearTimeout(timer);
    clearHandles();
    running = false;
    where = null;
  }

  function finish() {
    stop();
    hooks.onFinish();
  }

  return {
    play: play,
    pause: pause,
    resume: resume,
    stop: stop,
    isPlaying: function () { return running; },
    isPaused: function () { return !running && !!where; },
    measure: function () { return where ? where.measure : null; },
    secondsOf: secondsOf
  };
})();
