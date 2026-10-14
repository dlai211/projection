/**
 * Global configuration — every tunable number in one place.
 *
 * This file is loaded first; every other module reaches it through
 * `window.App.Config`. Nothing here depends on the DOM.
 */
window.App = window.App || {};

window.App.Config = (function () {
  'use strict';

  return {
    /** Score file. Loaded as a plain <script> so the page also works from file://. */
    score: {
      dataGlobal: 'FLOWER_DAY_SCORE', // the global that music-sheet/flower-day.js defines
      measuresPerSystem: 4,           // 64 measures / 4 = 16 systems
    },

    /**
     * Sheet-music geometry, in SVG user units (the viewBox coordinate system).
     *
     * The grand staff is two 4-space staves with one space of 10 units, so a staff
     * is 40 units tall and the staves sit 40 units apart — the standard grand-staff
     * proportion, which puts middle C (y=100) exactly halfway between them.
     *
     * The clef/key-signature x positions below are derived from the Bravura glyph
     * bounding boxes so nothing ever collides: the brace spans 16.5..25, the G and F
     * clefs 25..52, up to three key-signature sharps 56..86, the time signature
     * 96..114, and the music starts at 118.
     */
    sheet: {
      // The drawing's own coordinate space, copied from the reference design:
      // 1000 units wide by 205 tall, with a staff space of 10 units. Everything
      // below (clef positions, note spacing, stem lengths) is expressed in these
      // units, and layout.maxSystemWidth decides how many pixels one unit becomes.
      viewBox: { w: 1200, h: 205, from: 0, to: 205 },
      staff: {
        space: 10,
        trebleTop: 42,   // y of the top line of the treble staff
        bassTop: 122,    // y of the top line of the bass staff
        lines: 5,
        marginLeft: 0,  // where the staff lines start, just left of the brace
        marginRight: 1200, // where the staff lines end
      },
      header: {
        /**
         * Horizontal placement, in drawing units, matching the reference design's
         * proportions. The music spans x=12 to x=985 of the 1000-unit window
         * (97% of the width, as the reference does), so a measure comes out
         * 224 units — the reference's 241 units at the same visual density.
         *
         * Reading left to right: brace 12..17, clefs 15..42, up to three sharps
         * 48..78, time signature 82..100, first note at 112.
         */
        braceX: 12,         // left edge of the grand-staff brace
        braceTop: 80,       // the brace spans the gap between the two staves
        braceHeight: 75,    // 80 + 75 = 155, the bottom line of the bass staff
        gClefX: 15,         // the clef's own origin; its ink starts a little right of this
        fClefX: 15,
        sharpX: 48,         // centre of the first key-signature accidental
        sharpStep: 11,      // horizontal distance between successive sharps
        timeSigX: 91,       // centre of the time signature
        musicStart: 112,    // first note column of measure 1, clear of the signature
      },
      note: {
        rx: 6.2,           // notehead half-width
        ry: 4.2,           // notehead half-height
        tiltDegrees: -20,
        stemLength: 32,
        stemGap: 5.6,      // stem sits just right/left of the notehead
        ledgerHalfWidth: 12,
        labelGap: 4,       // clearance between a notehead and its written label
      },
      measureNumberY: 26,  // above the treble staff
    },

    /**
     * Vertical layout of the systems inside the sheet area.
     *
     * The music is drawn at a fixed *screen* size — one staff space is always
     * `preferredScale` CSS pixels — so noteheads, labels and ledger lines stay
     * equally readable on a 1080p laptop and a 4K desktop. What changes between
     * screens is only the space between systems, so a denser view fits more
     * systems instead of shrinking them.
     */
    layout: {
      /**
       * The size of the music on screen, in one number.
       *
       * The score is 1000 drawing units wide (sheet.viewBox.w) and is drawn at
       * 1360 px — the reference design's display width. That makes one drawing
       * unit 1.36 px and puts the staff space at 13.6 px, matching the reference
       * exactly: a 54 px staff and noteheads about 17 px wide.
       *
       * This is the single control for the size of the score on screen. The
       * drawing is centred when the window is wider, and only a narrower window
       * shrinks it.
       */
      maxSystemWidth: 1000,

      /**
       * The three vertical distances, all in plain CSS pixels.
       *
       * `pagePaddingTop` and `pagePaddingBottom` are the margins above the first
       * system and below the last. `systemGapPx` (below, in density) is the empty
       * air between two systems. None of them can change the size of the music —
       * that is maxSystemWidth's job alone.
       */
      pagePaddingTop: 100,
      pagePaddingBottom: 100,

      /**
       * How much empty air sits between two systems, in CSS pixels, for each of
       * the three settings the spacing button cycles through. Bigger numbers mean
       * more air and so fewer systems on screen.
       *
       * The number is a *minimum*: if the window still has room left over after
       * fitting the systems, that leftover is shared out between them, so the gap
       * you see is often larger than the value here.
       */
      density: {
        tight: { systemGapPx: 40 },
        normal: { systemGapPx: 120 },
        loose: { systemGapPx: 280 },
      },
      defaultDensity: 'normal',
    },

    /**
     * Icon buttons are the only UI chrome. Icons are outline-only strokes with a
     * transparent background and a hand-drawn pencil ring; the glyph itself stays
     * clean so it never looks lopsided.
     */
    icons: {
      size: 40,
      glyphStroke: 1.9,
      ringRoughness: 1.15, // displacement scale for the hand-drawn ring filter
    },

    /** Bottom piano keyboard. */
    keyboard: {
      // Screen-adaptive range. On a 2560px-wide window this yields octaves 2-6.
      targetOctaveWidth: 200,
      minOctaves: 2,
      maxOctaves: 7,
      defaultCenterMidi: 60, // C4 — the adaptive range stays centred near middle C

      fullRange: { lowestMidi: 21, highestMidi: 108 }, // A0 .. C8, 88 keys
      blackKeyWidthRatio: 0.62,
      labelMidiLow: 24,  // below this, only label C notes to avoid clutter
    },

    /**
     * Polyphonic pitch detection (used from Phase 3 on, declared here so the
     * tuning knobs live with the rest of the configuration).
     */
    detection: {
      fftSize: 4096,
      smoothingTimeConstant: 0.6,
      minPeakDb: -78,
      peakProminenceDb: 7,
      maxPeaks: 14,
      harmonicTolerance: 0.035, // cents-ish tolerance when folding harmonics away
      maxHarmonic: 5,
      frameRate: 15,
      requiredFrames: 4,     // consecutive matching frames before "correct"
      matchThreshold: 0.72,
      chromaFloor: 0.08,
      mp3DetectDriven: true, // advance only when notes are actually heard
    },

    /** Measure duration, derived from meta (6/8, dotted quarter = 50). */
    timing: {
      msPerMeasureFallback: 1200,
    },

    /** Numeric-notation octave marks (Jianpu bases on C4 = 1). */
    numberNotation: {
      baseOctave: 4,
      sharpSymbol: '#',
      naturalSymbol: '♮', // ♮
      dotSymbol: '.',
      highMark: "'",
      lowMark: ',',
    },
  };
})();
