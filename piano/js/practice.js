/**
 * Learning Mode: judging what was played.
 *
 * Judging is per measure. A measure counts as played when every pitch it asks for —
 * the melody and every note of the left-hand chord — has been heard at the same time,
 * for a few frames in a row. Playing nothing, or playing the wrong notes, simply waits.
 *
 * Two waits make it usable rather than infuriating:
 *
 *   - a note must be held for a few frames, so a passing noise cannot pass a measure;
 *   - after the page moves on, nothing is judged for a moment, so the notes still
 *     ringing from the measure just played cannot pass the next one — which matters
 *     here, because several measures in this piece share the same notes.
 */
window.App = window.App || {};

window.App.Practice = (function () {
  'use strict';

  const Config = window.App.Config;
  const Detect = window.App.PitchDetect;

  let running = false;
  let measureNumber = 1;
  let total = 0;
  let holdCount = 0;
  let settleUntil = 0;
  let smoothed = null;
  let lastFrameAt = 0;

  function now() {
    return window.performance && window.performance.now ? window.performance.now() : Date.now();
  }

  function start(number, measureTotal) {
    running = true;
    total = measureTotal || 0;
    goTo(number);
  }

  function stop() {
    running = false;
    smoothed = null;
    holdCount = 0;
  }

  /** Jump to a measure without judging it — used when a measure is clicked. */
  function goTo(number) {
    measureNumber = number;
    holdCount = 0;
    smoothed = null;
    lastFrameAt = 0;
    settleUntil = now() + Config.detect.settleMs;
  }

  /**
   * One frame.
   *
   * @param {Float64Array} chroma          what can be heard right now
   * @param {Set<number>} targetPitchClasses what this measure asks for
   */
  function tick(chroma, targetPitchClasses) {
    if (!running) return null;

    const current = now();
    const waiting = current < settleUntil;

    let result;
    if (waiting) {
      // Nothing is remembered until the moment judging starts: the notes still ringing
      // from the measure just played must not count towards this one.
      smoothed = null;
      lastFrameAt = 0;
      holdCount = 0;
      result = Detect.match(new Float64Array(12), targetPitchClasses);
    } else {
      const elapsed = lastFrameAt ? (current - lastFrameAt) / 1000 : 0;
      lastFrameAt = current;
      smoothed = Detect.accumulate(smoothed, chroma, elapsed);
      result = Detect.match(smoothed, targetPitchClasses);
    }

    let advanced = false;
    let finished = false;

    if (waiting) {
      holdCount = 0;
    } else if (result.complete) {
      holdCount++;
      if (holdCount >= Config.detect.holdFrames) {
        holdCount = 0;
        advanced = true;
        measureNumber++;
        finished = total > 0 && measureNumber > total;
        smoothed = null;
        lastFrameAt = 0;
        settleUntil = now() + Config.detect.settleMs;
      }
    } else {
      holdCount = 0;
    }

    return {
      measure: measureNumber,
      heard: result.heard,
      missing: result.missing,
      score: result.score,
      complete: result.complete,
      waiting: waiting,
      advanced: advanced,
      finished: finished
    };
  }

  return {
    start: start,
    stop: stop,
    goTo: goTo,
    tick: tick,
    isRunning: function () { return running; },
    measure: function () { return measureNumber; },
    isWaiting: function () { return now() < settleUntil; }
  };
})();
