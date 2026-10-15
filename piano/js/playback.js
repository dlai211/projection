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

  /**
   * How long one unit lasts. Note lengths are counted in sixty-fourth notes, and an
   * eighth is 0.4 s at this tempo, so a unit is 0.05 s — the figure every position and
   * every length below is multiplied by.
   */
  function unitSeconds() {
    return Config.tempo.eighthSeconds / Config.durations['8'];
  }

  /**
   * How long a measure lasts. The time signature decides, not the number of notes that
   * happened to be written in it — so a bar whose melody is an eighth short still takes
   * its full two and a half seconds, and playback keeps a steady pulse.
   */
  function secondsOf(measure) {
    const units = measure.measureUnits || measure.rh.reduce(function (total, event) {
      return total + event.units;
    }, 0);
    return Math.max(1, units) * unitSeconds();
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

  /**
   * Lay every note of one measure onto the audio clock.
   *
   * Both hands are placed the same way, from the beat's own position on the time axis,
   * so a bass note sounds when the melody note above it does. A rest sounds nothing; a
   * grace note leans in just before the beat it belongs to. Notes are played at their
   * *sounding* pitch, which is an octave above what is written under an 8va.
   */
  function schedule(measure, at) {
    const unit = unitSeconds();
    const shift = measure.octaveShift || 0;

    const place = function (event, loudness) {
      if (event.rest || !event.notes.length) return;

      const lead = event.grace ? Config.playback.graceLeadSeconds : 0;
      const when = at + event.start * unit - lead;
      const length = Math.max(Config.playback.minimumSeconds, event.units * unit) + lead;

      event.notes.forEach(function (note) {
        handles.push(Sound.play(context, destination, note.midi + shift, when, length, loudness));
      });
    };

    measure.rh.forEach(function (event) { place(event, 0.7); });
    measure.lh.forEach(function (event) { place(event, 0.55); });
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
