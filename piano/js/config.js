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
      // The vertical window a system is drawn through, in user units. It reaches
      // from just above the highest note of the piece (A6, which needs four ledger
      // lines) down to the lowest (C2 on the bass staff).
      viewBox: { w: 1000, h: 188, from: 0, to: 188 },
      staff: {
        space: 10,
        trebleTop: 42,   // y of the top line of the treble staff
        bassTop: 122,    // y of the top line of the bass staff
        lines: 5,
        marginLeft: 18,  // where the staff lines start (left of the brace)
        marginRight: 985, // where the staff lines end
      },
      header: {
        braceX: 16.5,       // left edge of the grand-staff brace
        braceTop: 80,       // the brace spans the gap between the two staves
        braceHeight: 75,    // 80 + 75 = 155, the bottom line of the bass staff
        gClefX: 25,         // the clef's own origin; its ink starts a little right of this
        fClefX: 25,
        sharpX: 56,         // centre of the first key-signature accidental
        sharpStep: 12.5,    // horizontal distance between successive sharps
        timeSigX: 105,      // centre of the time signature
        musicStart: 118,    // first note column of measure 1
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
      // CSS pixels per drawing unit (one staff space is 10 units, so a scale of
      // 1.0 gives a 10px staff space — the reference engraving's size).
      // The music is drawn as large as the page width allows, up to preferredScale
      // (1.0 = a 10px staff space, the size of the reference engraving). On a 2K
      // window that yields three systems at the normal density, which is the
      // screen full without crowding.
      preferredScale: 1.2,
      minScale: 0.5,         // below this the annotations stop being readable
      pagePadding: 14,
      // How much empty air sits between two systems, as a fraction of a system's
      // own height. Bigger ratios mean fewer, airier systems on screen.
      density: {
        tight: { ratio: 0.26 },
        normal: { ratio: 0.62 },
        loose: { ratio: 1.15 },
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
