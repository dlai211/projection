/**
 * Every tunable number of the drawing, in one place.
 *
 * The geometry in `staff`, `header` and `mark` is lifted from test.html unchanged —
 * those values are what makes the page look the way it does, so they are recorded here
 * rather than spread through the renderer. Colours are not here: they live in
 * styles/theme.css as custom properties.
 */
window.App = window.App || {};

window.App.Config = (function () {
  'use strict';

  return {
    /** The generated data file puts the score on this global. */
    scoreGlobal: 'FLOWER_DAY_SCORE',

    /** The drawing's own coordinate window, as in test.html. */
    viewBox: { width: 1000, height: 205 },

    /** How a system is sized on the page (test.html's svg.manuscript-svg rules). */
    render: { maxWidthPx: 1360, maxHeightPx: 235 },

    staff: {
      x1: 20,                       // where the staff lines start
      x2: 985,                      // where they end
      trebleLines: [35, 45, 55, 65, 75],
      bassLines: [130, 140, 150, 160, 170],
      /** Barlines: five strokes make four measures, the same four in every system. */
      barlineX: [20, 305, 530, 770, 985],
      /** Drawing units between two staff lines, and between two staff steps. */
      staffSpace: 10,
      step: 5,
      /** The pitch each clef is anchored to: B4 on the middle line of the treble
       *  staff, G2 on the bottom line of the bass staff. */
      trebleAnchor: { step: 6, y: 55 },
      bassAnchor: { step: -10, y: 170 }
    },

    header: {
      trebleClef: { x: 27, y: 69, size: 40 },
      bassClef: { x: 27, y: 160, size: 29 },
      /** Sharps sit a little above the line or space they belong to. */
      sharp: { x: 56, y: 43, size: 19, gap: 10, baselineLift: 8 },
      /** Mid-system key changes are drawn tighter, right after the barline. */
      inlineSharp: { offset: 5, gap: 8 }
    },

    /** Key signatures, written in the order the sharps are added (circle of fifths). */
    keySignatures: {
      '0': [],
      '1#': [{ letter: 'F', octave: 5 }],
      '3#': [{ letter: 'F', octave: 5 }, { letter: 'C', octave: 5 }, { letter: 'G', octave: 5 }]
    },

    layout: {
      measuresPerSystem: 4,

      /** The melody's box inside a measure slot. */
      firstSlotLeftPad: 85,         // clears the clef and key signature (test.html: 105 = 20 + 85)
      slotLeftPad: 32,
      rightPad: 26,
      /**
       * One eighth note's worth of space never grows past this, so a measure with only
       * two long notes stays compact instead of being stretched across the whole slot.
       * The value is test.html's own measure 7: two notes 105 units apart, which is
       * 52.5 units per eighth.
       */
      maxUnit: 52,

      /** Durations, in eighths: a plain note, and one carrying a "." */
      plainUnits: 1,
      dottedUnits: 3,
      /**
       * How much room a long note takes when the notes are spread out. Its real length
       * is three eighths, but test.html gives it about twice an eighth's room, so the
       * spacing follows test.html and only the beat grouping follows the music.
       */
      dottedSpacing: 2,
      /** Beams and left-hand alignment follow the 6/8 pulse: three eighths to a beat. */
      beatGroup: 3,

      /** The mark of a note, as in test.html. */
      stemOffset: 5,
      stemLength: 26,
      note: { rx: 6.2, ry: 4.4, tilt: -20 },
      bassNote: { rx: 6.4, ry: 4.6, tilt: -18 },

      /** Where the handwritten labels sit, and how big they start. */
      rhLabel: { dy: -12, size: 23 },
      lhLabel: { dx: 4, dy: 23, size: 19 },
      measureNumber: { dx: 6, dy: 27, size: 18 },

      /** The pencil smudge behind the measure being practised. */
      highlight: { y: 15, height: 172 },
      /** The measure number of a system's first measure clears the clef. */
      measureNumberShift: 55,

      /** Labels shrink only in measures too crowded for the normal size. */
      denseLabel: { minSize: 12, charWidth: 0.4, staggerBelow: 14, staggerDy: 9 },

      /** Ledger strokes are this wide, centred on the note. */
      ledgerHalfWidth: 9
    },

    piano: {
      /** test.html's keyboard, and the full range. */
      defaultOctaves: [2, 6],
      fullRange: { low: 21, high: 108 },
      blackKeyWidthPct: 1.45,
      blackKeyLeftAdjust: 0.725
    },

    /** Vertical gap between two systems, per compactness setting, in CSS pixels. */
    systemGapPx: { tight: 2, normal: 22, loose: 60 },
    defaultCompact: 'normal',

    /** Six-eight at a dotted quarter = 50: one eighth lasts 0.4 s. */
    tempo: { dottedQuarterPerMinute: 50, eighthSeconds: 0.4 },

    /**
     * Listening.
     *
     * The window size is not a free choice: it decides whether two notes a semitone
     * apart can be told apart at all. Measure 12 asks for D3 and C#3 together, which are
     * 8 Hz apart — at FFT 4096 (a bin every 11.7 Hz) they land in the same bin and the
     * measure can never be heard complete. At 8192 they are three bins apart and every
     * one of the 64 measures passes; tools/check_detect.js prints the comparison.
     *
     * The price is latency: an 8192 window is 171 ms long, so the readout trails the
     * playing by about a fifth of a second. At this tempo that is not noticeable.
     */
    audio: {
      fftSize: 8192,
      smoothing: 0.4,             // the analyser's own smoothing between frames
      minFrequency: 60,           // below this the bins are too wide to name a note
      maxFrequency: 4300,         // above the top key of an 88-key piano
      peakFloorDb: -78,           // a peak must be above this to count at all
      peakRatio: 0.03,            // ...and above this share of the loudest peak
      harmonicTolerance: 0.03,    // how close to a whole multiple counts as a harmonic
      harmonicMax: 8,             // harmonics past the eighth are not worth chasing
      harmonicStrength: 0.22,     // the lower peak must be at least this strong
      /**
       * What a harmonic still contributes to the chroma. It is quietened rather than
       * dropped, because a note played on purpose can sit exactly on another note's
       * harmonic — see markHarmonics in js/pitch-detect.js.
       */
      harmonicFold: 0.45
    },

    /** Judging what was played. */
    detect: {
      /**
       * A pitch class counts as heard at this share of the strongest one. Set it too
       * high and a left hand played softly stops counting; too low and a note's own
       * harmonics start passing measures on their own. At 0.25 the left hand has to be
       * at least a quarter as loud as the melody, and a note's third harmonic — the
       * loudest one that lands on a different note — stays quiet enough not to count.
       */
      matchThreshold: 0.25,
      holdFrames: 3,              // frames in a row before the measure counts as played
      /**
       * How long a note keeps counting after it stops sounding — long enough to cover
       * the slowest measure here (twelve notes take about four seconds to play), and
       * cleared outright whenever the page moves on to the next measure.
       */
      measureMemorySeconds: 6,
      settleMs: 600               // everything is ignored for this long after advancing
    },

    /** Playing the score back. */
    playback: {
      leadInSeconds: 0.12,
      releaseSeconds: 0.4,
      lookaheadMs: 60
    },

    /** The sample set: one file per key, named with flats. */
    samples: {
      folder: 'piano-mp3/',
      fileNames: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    }
  };
})();
