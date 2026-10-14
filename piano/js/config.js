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
         * Horizontal placement, in drawing units (= pixels), following the
         * reference design.
         *
         * There is no curly brace and no time signature on the staves — the
         * reference has neither. A single pencil barline closes the grand staff on
         * the left, and the clefs and key signature sit inside it:
         * barline 20, treble/bass clefs 24..52, sharps 58..90, first note at 100.
         */
        leftBarX: 18,       // the vertical line closing both staves on the left
        gClefX: 21,         // left edge of the treble clef box
        fClefX: 21,
        clefSize: 58,       // font size of the clef glyphs, in drawing units
        sharpX: 56,         // centre of the first key-signature accidental
        sharpStep: 13,      // horizontal distance between successive sharps
        sharpSize: 30,      // font size of the sharp glyphs
        musicStart: 120,    // first note column of measure 1
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
       * The score is 1200 drawing units wide (sheet.viewBox.w) and is drawn at
       * 1200 px, so one drawing unit is exactly one CSS pixel. That makes every
       * measurement in `sheet` a plain pixel figure: a 10 px staff space, a 40 px
       * staff, noteheads 12 px wide, and annotation type sized in the same units
       * the reference design uses.
       *
       * This is the single control for the size of the score on screen. The
       * drawing is centred when the window is wider, and only a narrower window
       * shrinks it.
       */
      maxSystemWidth: 1200,

      /**
       * The three vertical distances, all in plain CSS pixels.
       *
       * `pagePaddingTop` and `pagePaddingBottom` are the margins above the first
       * system and below the last. `systemGapPx` (below, in density) is the empty
       * air between two systems. None of them can change the size of the music —
       * that is maxSystemWidth's job alone.
       */
      pagePaddingTop: 150,
      pagePaddingBottom: 100,

      /**
       * Where the actual ink sits inside the drawing band, in drawing units.
       *
       * The band is `sheet.viewBox.h` tall but nothing is drawn all the way to its
       * edges: the topmost ink (the measure numbers above the treble staff) sits
       * at 12 and the lowest (the left-hand note labels under the bass staff) at
       * 177. The layout uses these to place the boxes, so that `systemGapPx`
       * measures the gap you actually see between one system's last ink and the
       * next system's first ink.
       *
       * These are measured values, from every drawn element — not just the notes.
       * Re-measure if the score's range, the clefs or the label positions change;
       * `node tools/check-model.js` prints the note-based extents as a starting
       * point.
       */
      inkTop: 12,
      inkBottom: 192,

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
        // The empty space between one system and the next, in CSS pixels. It is
        // exact: height left over at the bottom of the scroll range stays blank
        // instead of widening the gaps.
        //
        // Note the gap is between the two drawing bands. A couple of pixels of a
        // text line box (the written labels and measure numbers) fall outside its
        // band, so the *visible* gap measures about 0.7 px less than the value
        // here — `tight: 2.7` renders as 2 px on screen. The two systems that
        // measure 1.5 are the pair straddling a whole-pixel boundary.
        tight: { systemGapPx: 2.7 },
        normal: { systemGapPx: 60 },
        loose: { systemGapPx: 200 },
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
