/**
 * Hearing several notes at once.
 *
 * ml5/CREPE cannot do this — it answers "what one note is this?" and a piano chord is
 * not one note. So the page does its own analysis on the FFT the analyser hands over:
 *
 *   spectrum → peaks → drop the peaks that are harmonics of a lower peak
 *            → fold what is left into twelve pitch classes (a chroma vector)
 *
 * `analyse` is a plain function of the spectrum: it takes decibels and the width of a
 * bin in hertz, and returns the chroma. Nothing in it touches the browser, which is
 * what lets tools/check_detect.js feed it a synthesised chord and check the answer.
 *
 * Two things are deliberate:
 *
 *   - Matching is by pitch class, so an octave slip on a real piano is not punished.
 *   - When judging, a wrong extra note is harmless — the question asked is only
 *     whether the notes being practised are present. Missing one is what hurts, so
 *     the harmonic rejection is written to keep a note rather than drop it.
 */
window.App = window.App || {};

window.App.PitchDetect = (function () {
  'use strict';

  const Config = window.App.Config;
  const Pitch = window.App.Pitch;

  /** An empty answer, for silence or a spectrum that holds no peaks. */
  function nothing() {
    return { chroma: new Float64Array(12), notes: [], peaks: [], loudest: 0 };
  }

  /**
   * @param {ArrayLike<number>} decibels  the analyser's output, one value per bin
   * @param {number} binHz                hertz between two bins
   */
  function analyse(decibels, binHz) {
    const audio = Config.audio;
    const count = decibels.length;
    const magnitudes = new Float64Array(count);
    let loudest = 0;

    for (let i = 0; i < count; i++) {
      const value = decibels[i];
      const magnitude = value > -200 ? Math.pow(10, value / 20) : 0;
      magnitudes[i] = magnitude;
      if (magnitude > loudest) loudest = magnitude;
    }
    if (loudest <= 0) return nothing();

    const peaks = findPeaks(magnitudes, binHz, loudest);
    markHarmonics(peaks);
    return {
      chroma: foldToChroma(peaks),
      notes: peaks.filter(function (peak) { return !peak.harmonic; })
        .map(function (peak) { return Math.round(peak.midi); }),
      peaks: peaks,
      loudest: loudest
    };
  }

  /** Local maxima that stand above the noise, with their frequency refined. */
  function findPeaks(magnitudes, binHz, loudest) {
    const audio = Config.audio;
    const lastBin = Math.min(magnitudes.length - 1, Math.ceil(audio.maxFrequency / binHz));
    const firstBin = Math.max(1, Math.floor(audio.minFrequency / binHz));
    const floor = Math.max(Math.pow(10, audio.peakFloorDb / 20), loudest * audio.peakRatio);
    const peaks = [];

    for (let i = firstBin; i < lastBin; i++) {
      const value = magnitudes[i];
      if (value < floor) continue;
      if (value <= magnitudes[i - 1] || value < magnitudes[i + 1]) continue;

      // Parabolic interpolation: a peak rarely lands exactly on a bin, and half a bin
      // at the bottom of the piano is most of a semitone.
      const left = magnitudes[i - 1];
      const right = magnitudes[i + 1];
      const denominator = left - 2 * value + right;
      const offset = denominator === 0 ? 0 : 0.5 * (left - right) / denominator;
      const frequency = (i + Math.max(-1, Math.min(1, offset))) * binHz;
      if (frequency < audio.minFrequency || frequency > audio.maxFrequency) continue;

      peaks.push({ frequency: frequency, midi: frequencyToMidi(frequency), level: value });
    }
    return peaks;
  }

  function frequencyToMidi(frequency) {
    return 69 + 12 * Math.log2(frequency / 440);
  }

  /**
   * Mark the peaks that a lower one explains.
   *
   * A piano note is a stack of partials, and the third and fifth of those are a fifth
   * and a third above the note — the classic way an analyser hears a chord that is not
   * being played. A peak is marked when it sits close to a whole multiple of a lower
   * peak that is not far weaker.
   *
   * Marked peaks are *quietened*, not deleted, and that distinction matters. A played
   * note can land exactly on another note's harmonic — measure 37 asks for B2 in the
   * bass and F#4 in the melody, and F#4 is B2's third harmonic to within a tenth of a
   * hertz. Nothing in the sound can tell those two apart, so the detector keeps what it
   * hears: a note wrongly left out would block a measure the player played correctly,
   * which is far worse than a note wrongly included.
   */
  function markHarmonics(peaks) {
    const audio = Config.audio;
    const sorted = peaks.slice().sort(function (a, b) { return a.frequency - b.frequency; });
    const kept = [];

    sorted.forEach(function (peak) {
      peak.harmonic = kept.some(function (lower) {
        const ratio = peak.frequency / lower.frequency;
        if (ratio < 1.5 || ratio > audio.harmonicMax + 0.5) return false;
        if (lower.level < peak.level * audio.harmonicStrength) return false;
        const nearest = Math.round(ratio);
        return Math.abs(ratio - nearest) / nearest <= audio.harmonicTolerance;
      });
      if (!peak.harmonic) kept.push(peak);
    });

    return peaks;
  }

  /** Twelve bins, each holding the strongest peak that belongs to it, scaled to 0..1. */
  function foldToChroma(peaks) {
    const audio = Config.audio;
    const chroma = new Float64Array(12);
    peaks.forEach(function (peak) {
      const pitchClass = ((Math.round(peak.midi) % 12) + 12) % 12;
      const weight = peak.harmonic ? peak.level * audio.harmonicFold : peak.level;
      if (weight > chroma[pitchClass]) chroma[pitchClass] = weight;
    });

    let strongest = 0;
    for (let i = 0; i < 12; i++) strongest = Math.max(strongest, chroma[i]);
    if (strongest > 0) {
      for (let i = 0; i < 12; i++) chroma[i] = chroma[i] / strongest;
    }
    return chroma;
  }

  /**
   * Remember what has been played since the measure began.
   *
   * A measure is judged as a whole, and a melody is played one note at a time: the note
   * played four seconds ago still has to count when the last one of a twelve-note run
   * arrives. So each pitch class holds its strongest recent value and fades only slowly
   * — a level meter's peak hold, not an average. An average would be wrong here: it
   * would leave every note of a long measure below the threshold at the moment the
   * measure is finally complete.
   *
   * The memory is long enough to cover the slowest measure in the piece and is cleared
   * outright whenever the page moves on, so nothing carries over into the next measure.
   */
  function accumulate(previous, next, elapsedSeconds) {
    const memory = Config.detect.measureMemorySeconds;
    if (!previous) return next;

    const keep = Math.exp(-Math.max(0, elapsedSeconds) / memory);
    const out = new Float64Array(12);
    for (let i = 0; i < 12; i++) {
      const held = previous[i] * keep;
      out[i] = held > next[i] ? held : next[i];
    }
    return out;
  }

  /**
   * Which of the wanted pitch classes can be heard, and which are still missing.
   * A class counts as heard when it is at least `matchThreshold` of the strongest.
   */
  function match(chroma, wantedPitchClasses) {
    const threshold = Config.detect.matchThreshold;
    const heard = [];
    const missing = [];

    wantedPitchClasses.forEach(function (pitchClass) {
      if (chroma[pitchClass] >= threshold) heard.push(pitchClass);
      else missing.push(pitchClass);
    });

    const score = wantedPitchClasses.size ? heard.length / wantedPitchClasses.size : 0;
    return { heard: heard, missing: missing, score: score, complete: missing.length === 0 };
  }

  /** The detected notes, named, for the diagnostics readout. */
  function describeNotes(notes) {
    return notes.slice().sort(function (a, b) { return a - b; }).map(Pitch.letterName);
  }

  return {
    analyse: analyse,
    accumulate: accumulate,
    match: match,
    describeNotes: describeNotes,
    frequencyToMidi: frequencyToMidi
  };
})();
