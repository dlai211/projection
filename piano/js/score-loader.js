/**
 * The score file, turned into something the drawing code can use.
 *
 * The number notation is complete: it names the letter, the accidental and the octave
 * of every note, so every pitch in this file is *derived* from it. The letter string
 * and the MIDI number that travel with it are treated as a second opinion — when the
 * three disagree the loader keeps the derived pitch and records a warning, which
 * tools/check_score.js prints.
 *
 * Two shapes need care:
 *
 *   rh: [["7","B4",71], ["7.","B4.",71], ...]      always [number, letter, MIDI]
 *   lh: ["3/7,", "E3/B2", 52]                      one chord
 *       ["2,/7,,", "#1,/6,,", 50]                  two chords (measure 4), the MIDI
 *                                                  number belonging to the first
 */
window.App = window.App || {};

window.App.ScoreLoader = (function () {
  'use strict';

  const Number = window.App.NotesNumber;
  const Letter = window.App.NotesLetter;
  const Pitch = window.App.Pitch;
  const Config = window.App.Config;

  /** "B4." is the name plus a duration dot; for reading a pitch the dot is noise. */
  function withoutDot(text) {
    return String(text).replace(/\.+$/, '');
  }

  /** A letter-notation string starts with a letter; number notation starts with
   *  a digit, a sharp or a natural sign. */
  function isLetterNotation(text) {
    return /^\s*[A-Ga-g]/.test(String(text));
  }

  /** Load the whole file. Returns the model plus everything that did not add up. */
  function load(raw) {
    if (!raw || !raw.measures) throw new Error('score file has no measures');

    const report = { warnings: [], quirks: [] };
    let key = '0';

    const measures = raw.measures.map(function (rawMeasure) {
      if (rawMeasure.key) key = rawMeasure.key;
      return loadMeasure(rawMeasure, key, report);
    });

    return {
      meta: raw.meta || {},
      measures: measures,
      /** Disagreements the loader could not settle — these change what is drawn. */
      warnings: report.warnings,
      /** Known faults in the file that the loader settles from the file itself. */
      quirks: report.quirks,
      title: (raw.meta && raw.meta.title) || '',
      subtitle: (raw.meta && raw.meta.subtitle) || ''
    };
  }

  function loadMeasure(raw, key, report) {
    const measure = {
      m: raw.m,
      key: key,
      time: raw.time || '6/8',
      rh: (raw.rh || []).map(function (entry) {
        return loadRhEntry(entry, raw.m, report);
      }),
      lh: []
    };

    loadLhEntries(raw.lh, raw.m, report).forEach(function (chord) {
      measure.lh.push(chord);
    });

    // A bass note held through the whole measure is drawn open; a bass that moves
    // gets filled noteheads. That is exactly what test.html does.
    measure.lh.forEach(function (chord) {
      chord.hollow = measure.lh.length === 1;
    });

    // A long melody note is drawn open only when the measure has no short note at
    // all (test.html's measure 7); otherwise the measure is filled in as usual.
    const hasPlainNote = measure.rh.some(function (note) { return !note.dotted; });
    measure.rh.forEach(function (note) {
      note.hollow = note.dotted && !hasPlainNote;
    });

    return measure;
  }

  /** One melody entry: [numberNotation, letterNotation, midi]. */
  function loadRhEntry(entry, measureNumber, report) {
    const numText = String(entry[0]);
    const letterText = entry[1] === undefined ? null : String(entry[1]);
    const statedMidi = typeof entry[entry.length - 1] === 'number' ? entry[entry.length - 1] : null;

    const tokens = Number.chordToTokens(numText);
    const parsed = Number.parseToken(tokens[0]);
    if (!parsed) report.warnings.push(describe(measureNumber, 'melody', numText, 'is not number notation'));

    // A melody entry carries one note; if a packed chord ever appears, the top note
    // is the one that is drawn and labelled.
    const midis = Number.chordToMidis(numText);
    if (!midis.length) {
      return {
        num: numText, let: letterText || '', midi: null, notes: [], dotted: false,
        units: Config.layout.plainUnits, spacing: Config.layout.plainUnits,
        letter: 'B', accidental: '', octave: 4
      };
    }
    const midi = Math.max.apply(null, midis);
    const statedPairs = agreesWithItself(statedMidi, letterText);
    const pitch = statedPairs && statedMidi !== midi ? statedMidi : midi;

    if (statedMidi !== null && statedMidi !== midi) {
      const detail = 'notation gives MIDI ' + midi + ', the file says ' + statedMidi;
      if (statedPairs) report.quirks.push(describe(measureNumber, 'melody', numText + ' (' + letterText + ')',
        detail + ' — kept the file\'s, both of its spellings agree'));
      else report.warnings.push(describe(measureNumber, 'melody', numText + ' (' + letterText + ')', detail));
    }
    if (letterText && withoutDot(letterText) !== Pitch.letterName(pitch)) {
      report.warnings.push(describe(measureNumber, 'melody', numText,
        'notation gives ' + Pitch.letterName(pitch) + ', the file says ' + letterText));
    }

    // The staff position follows the sounded pitch, so a note can never be drawn on
    // the wrong line however it was spelled.
    const spelling = Pitch.letterAndOctaveOf(pitch);

    return {
      num: numText,
      let: letterText || Pitch.letterName(pitch),
      midi: pitch,
      notes: midis,
      dotted: parsed ? parsed.dotted : false,
      units: parsed && parsed.dotted ? Config.layout.dottedUnits : Config.layout.plainUnits,
      spacing: parsed && parsed.dotted ? Config.layout.dottedSpacing : Config.layout.plainUnits,
      letter: spelling.letter,
      accidental: spelling.accidental,
      octave: spelling.octave
    };
  }

  /**
   * A measure's whole left-hand array. Usually one chord; measure 4 holds two, with a
   * single MIDI number that belongs to the first of them.
   */
  function loadLhEntries(entries, measureNumber, report) {
    if (!entries || !entries.length) return [];

    const parts = (Array.isArray(entries[0]) ? entries[0] : entries).slice();
    const statedMidi = typeof parts[parts.length - 1] === 'number' ? parts.pop() : null;

    let statedLetters = null;
    const chordTexts = [];
    parts.forEach(function (text) {
      if (isLetterNotation(text)) statedLetters = String(text);
      else chordTexts.push(String(text));
    });

    return chordTexts.map(function (text, index) {
      const derivedMidis = Number.chordToMidis(text);
      if (!derivedMidis.length) {
        report.warnings.push(describe(measureNumber, 'bass', text, 'is not number notation'));
        return { num: text, let: '', midi: null, notes: [], hollow: true, letter: 'G', accidental: '', octave: 2 };
      }

      const derivedLetters = derivedMidis.map(Pitch.letterName).join('/');
      const derivedTop = Math.max.apply(null, derivedMidis);

      // The letter name and the MIDI number agree with each other but not with the
      // notation: the notation is the one with the mistake (see agreesWithItself).
      const pairWins = index === 0 && statedMidi !== derivedTop && agreesWithItself(statedMidi, statedLetters);
      const notes = pairWins ? Letter.chordToMidis(withoutDot(statedLetters)) : derivedMidis;
      const midi = Math.max.apply(null, notes);

      if (index === 0 && statedMidi !== null && statedMidi !== derivedTop) {
        const detail = 'notation gives ' + derivedLetters + ' (MIDI ' + derivedTop + '), the file says ' +
          (statedLetters || '') + ' (MIDI ' + statedMidi + ')';
        if (pairWins) report.quirks.push(describe(measureNumber, 'bass', text, detail + ' — kept the file\'s'));
        else report.warnings.push(describe(measureNumber, 'bass', text, detail));
      } else if (index === 0 && statedLetters && statedLetters !== derivedLetters) {
        report.warnings.push(describe(measureNumber, 'bass', text,
          'notation gives ' + derivedLetters + ', the file says ' + statedLetters));
      }

      // The oval is drawn at the chord's top note, which is the note the score's own
      // MIDI number names.
      const spelling = Pitch.letterAndOctaveOf(midi);

      return {
        num: text,
        let: index === 0 && statedLetters ? statedLetters : derivedLetters,
        midi: midi,
        notes: notes,
        hollow: true,
        letter: spelling.letter,
        accidental: spelling.accidental,
        octave: spelling.octave
      };
    });
  }

  /**
   * True when the letter name and the MIDI number stored beside a note agree with each
   * other. When they do, but the number notation disagrees, the notation is the one
   * carrying the typo — measure 1's bass reads "3/7," where every other measure writes
   * "3,/7,," — so the pair wins and a warning is recorded.
   */
  function agreesWithItself(statedMidi, letterText) {
    if (statedMidi === null || !letterText) return false;
    const fromLetters = Letter.chordToMidis(withoutDot(letterText));
    return fromLetters.length > 0 && Math.max.apply(null, fromLetters) === statedMidi;
  }

  function describe(measureNumber, hand, what, detail) {
    return 'measure ' + measureNumber + ' ' + hand + ': ' + what + ' — ' + detail;
  }

  /** Every pitch class the measure asks for, melody and bass together. */
  function targetPitchClasses(measure) {
    const classes = new Set();
    measure.rh.concat(measure.lh).forEach(function (note) {
      (note.notes && note.notes.length ? note.notes : [note.midi]).forEach(function (midi) {
        if (Pitch.isValidMidi(midi)) classes.add(Pitch.pitchClassOf(midi));
      });
    });
    return classes;
  }

  /** Every MIDI note the measure asks for, including every note of a packed chord. */
  function targetMidis(measure) {
    const midis = [];
    measure.rh.concat(measure.lh).forEach(function (note) {
      (note.notes && note.notes.length ? note.notes : [note.midi]).forEach(function (midi) {
        if (Pitch.isValidMidi(midi) && midis.indexOf(midi) === -1) midis.push(midi);
      });
    });
    return midis;
  }

  return {
    load: load,
    targetPitchClasses: targetPitchClasses,
    targetMidis: targetMidis
  };
})();
