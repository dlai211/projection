/**
 * The score file, turned into something the drawing code can use.
 *
 * Two shapes are accepted, so the score can be moved over to the full arrangement one
 * measure at a time without ever leaving the page broken:
 *
 *   the old, simplified entry — one note, no written length
 *     "rh": [["7","B4",71], ["7.","B4.",71], ...]
 *     "lh": ["3/7,", "E3/B2", 52]
 *
 *   the full entry — a beat holding one or more notes, with its written length
 *     "rh": [{ "dur": "8", "notes": ["7'", "2''"] },
 *            { "dur": "16", "notes": ["7'"] },
 *            { "dur": "4.", "notes": ["3''"], "tie": true },
 *            { "dur": "8", "rest": true },
 *            { "dur": "grace", "notes": ["1''"] }]
 *     "lhClef": "treble"
 *
 * Either way everything ends up in one model, and every pitch is *derived* from the
 * number notation — which names the letter, the accidental and the octave — so a note
 * can never be drawn on the wrong line. The letter string and MIDI number that travel
 * with the old entries are treated as a second opinion, and tools/check_score.js prints
 * every disagreement it finds.
 */
window.App = window.App || {};

window.App.ScoreLoader = (function () {
  'use strict';

  const Number = window.App.NotesNumber;
  const Letter = window.App.NotesLetter;
  const Pitch = window.App.Pitch;
  const Config = window.App.Config;
  const DURATIONS = Config.durations;

  /** "B4." is a name plus a duration dot; for reading a pitch the dot is noise. */
  function withoutDot(text) {
    return String(text).replace(/\.+$/, '');
  }

  /** A letter-notation string starts with a letter; number notation with a digit,
   *  a sharp or a natural sign. */
  function isLetterNotation(text) {
    return /^\s*[A-Ga-g]/.test(String(text));
  }

  /** Is this a list of the new beat objects, or of the old flat entries? */
  function isEventList(list) {
    return !!list && list.length > 0 && typeof list[0] === 'object' && !Array.isArray(list[0]);
  }

  /** An empty hand counts as either shape. */
  function isTimedHand(list) {
    return !list || !list.length || isEventList(list);
  }

  // ------------------------------------------------------------------ loading

  function load(raw) {
    if (!raw || !raw.measures) throw new Error('score file has no measures');

    const report = { warnings: [], quirks: [] };
    let key = '0';
    let time = (raw.meta && raw.meta.timeSignature) || '6/8';
    let lhClef = 'bass';

    const measures = raw.measures.map(function (rawMeasure) {
      // Key, time and clef carry over from the measure before until something changes
      // them, which is how a score is actually read.
      if (rawMeasure.key) key = rawMeasure.key;
      if (rawMeasure.time) time = rawMeasure.time;
      if (rawMeasure.lhClef) lhClef = rawMeasure.lhClef;
      return loadMeasure(rawMeasure, key, time, lhClef, report);
    });

    return {
      meta: raw.meta || {},
      measures: measures,
      warnings: report.warnings,
      quirks: report.quirks,
      title: (raw.meta && raw.meta.title) || '',
      subtitle: (raw.meta && raw.meta.subtitle) || ''
    };
  }

  function loadMeasure(raw, key, time, lhClef, report) {
    const measure = {
      m: raw.m,
      key: key,
      time: time,
      lhClef: lhClef,
      /**
       * True when both hands carry written lengths, which puts the measure on the real
       * time axis. A measure still written in the old shape keeps the spacing that was
       * calibrated against test.html, so the two can sit side by side while the score is
       * moved over a measure at a time.
       */
      timed: isTimedHand(raw.rh) && isTimedHand(raw.lh),
      /** 12 when the measure is written under an 8va line and sounds an octave higher. */
      octaveShift: octaveShiftOf(raw.octave),
      rh: loadHand(raw.rh, 'melody', raw.m, report),
      lh: loadHand(raw.lh, 'bass', raw.m, report),
      slurs: raw.slurs || []
    };

    layOutTime(measure.rh);
    layOutTime(measure.lh);
    decideHollow(measure);
    return measure;
  }

  function octaveShiftOf(mark) {
    if (!mark) return 0;
    const text = String(mark).toLowerCase();
    if (text.indexOf('8va') === 0 || text === '8') return 12;
    if (text.indexOf('8vb') === 0) return -12;
    return 0;
  }

  /** One hand of one measure, in whichever of the two shapes it is written. */
  function loadHand(list, hand, measureNumber, report) {
    if (!list || !list.length) return [];
    if (isEventList(list)) {
      return list.map(function (rawEvent) { return loadEvent(rawEvent, hand, measureNumber, report); });
    }
    if (Array.isArray(list[0])) {
      return list.map(function (entry) { return loadLegacyNote(entry, hand, measureNumber, report); });
    }
    return loadLegacyBass(list, measureNumber, report);
  }

  /** A beat of the full arrangement: a length, one or more notes, and its marks. */
  function loadEvent(raw, hand, measureNumber, report) {
    const duration = String(raw.dur === undefined ? raw.duration === undefined ? '8' : raw.duration : raw.dur);
    const grace = duration === 'grace';
    const rest = !!raw.rest || duration === 'rest' || !raw.notes || !raw.notes.length;
    const units = grace || rest && duration === 'rest' ? 0 : lengthOf(duration, measureNumber, report);

    const notes = rest ? [] : notesFrom(raw.notes, measureNumber, hand, report);
    const event = eventFrom(notes);

    event.duration = duration;
    event.units = grace ? 0 : units;
    event.spacing = event.units;
    event.grace = grace;
    event.rest = rest;
    event.tie = !!raw.tie;
    return event;
  }

  function lengthOf(text, measureNumber, report) {
    if (Object.prototype.hasOwnProperty.call(DURATIONS, text)) return DURATIONS[text];
    report.warnings.push('measure ' + measureNumber + ': "' + text +
      '" is not a note length I know — read as an eighth');
    return DURATIONS['8'];
  }

  /** The notes of a beat: an array of tokens, one token, or tokens joined with "/". */
  function notesFrom(rawNotes, measureNumber, hand, report) {
    const list = Array.isArray(rawNotes) ? rawNotes : [rawNotes];
    const notes = [];

    list.forEach(function (entry) {
      Number.chordToTokens(String(entry)).forEach(function (token) {
        const note = noteFrom(token, measureNumber, hand, report);
        if (note) notes.push(note);
      });
    });

    notes.sort(function (a, b) { return a.midi - b.midi; });
    return notes;
  }

  function noteFrom(token, measureNumber, hand, report) {
    const parsed = Number.parseToken(token);
    if (!parsed) {
      report.warnings.push('measure ' + measureNumber + ' ' + hand + ': "' + token + '" is not number notation');
      return null;
    }
    const midi = Pitch.midiOf(parsed.letter, parsed.accidental, 4 + parsed.octaveOffset);
    return {
      num: token,
      let: Pitch.letterName(midi),
      midi: midi,
      letter: parsed.letter,
      accidental: parsed.accidental,
      octave: 4 + parsed.octaveOffset
    };
  }

  /** An old entry: a note with no written length, and no chord. */
  function loadLegacyNote(entry, hand, measureNumber, report) {
    const numText = String(entry[0]);
    const letterText = entry[1] === undefined ? null : String(entry[1]);
    const statedMidi = typeof entry[entry.length - 1] === 'number' ? entry[entry.length - 1] : null;

    const token = Number.chordToTokens(numText)[0];
    const parsed = Number.parseToken(token);
    if (!parsed) report.warnings.push('measure ' + measureNumber + ' ' + hand + ': "' + numText + '" is not number notation');

    let note = noteFrom(token, measureNumber, hand, report);
    if (!note) {
      return eventFrom([]);
    }

    // Two spellings that agree with each other outvote the notation, which is how
    // measure 1's bass — written "3/7," without its octave commas — is settled.
    const statedPairs = agreesWithItself(statedMidi, letterText);
    if (statedMidi !== null && statedMidi !== note.midi && statedPairs) {
      report.quirks.push('measure ' + measureNumber + ' ' + hand + ': ' + numText + ' (' + letterText +
        ') — notation gives MIDI ' + note.midi + ', the file says ' + statedMidi + ' — kept the file\'s');
      note = noteFrom(Letter.midiToToken(statedMidi), measureNumber, hand, report) || note;
      note.num = numText;
      note.let = letterText || note.let;
    } else if (statedMidi !== null && statedMidi !== note.midi) {
      report.warnings.push('measure ' + measureNumber + ' ' + hand + ': ' + numText +
        ' — notation gives MIDI ' + note.midi + ', the file says ' + statedMidi);
    }
    if (letterText && withoutDot(letterText) !== note.let) {
      report.warnings.push('measure ' + measureNumber + ' ' + hand + ': ' + numText +
        ' — notation gives ' + note.let + ', the file says ' + letterText);
    }

    const dotted = !!(parsed && parsed.dotted);
    const event = eventFrom([note]);
    event.num = numText;
    event.let = letterText || note.let;
    event.dotted = dotted;
    event.duration = dotted ? Config.legacyDurations.dotted : Config.legacyDurations.plain;
    event.units = DURATIONS[event.duration];
    // The old entries carry no lengths, so the spacing stays at the proportion that
    // was calibrated against test.html: a long note takes twice an eighth's room.
    event.spacing = dotted ? 16 : 8;
    return event;
  }

  /**
   * An old left-hand array. Usually one chord; measure 4 holds two, with a single MIDI
   * number belonging to the first of them.
   */
  function loadLegacyBass(entries, measureNumber, report) {
    const parts = entries.slice();
    const statedMidi = typeof parts[parts.length - 1] === 'number' ? parts.pop() : null;

    let statedLetters = null;
    const chordTexts = [];
    parts.forEach(function (text) {
      if (isLetterNotation(text)) statedLetters = String(text);
      else chordTexts.push(String(text));
    });

    return chordTexts.map(function (text, index) {
      const tokens = Number.chordToTokens(text);
      const notes = tokens.map(function (token) { return noteFrom(token, measureNumber, 'bass', report); })
        .filter(Boolean);
      if (!notes.length) return eventFrom([]);

      const derivedLetters = notes.map(function (note) { return note.let; }).join('/');
      const top = notes.reduce(function (highest, note) {
        return note.midi > highest.midi ? note : highest;
      }, notes[0]);

      if (index === 0 && statedMidi !== null && statedMidi !== top.midi) {
        if (agreesWithItself(statedMidi, statedLetters)) {
          report.quirks.push('measure ' + measureNumber + ' bass: ' + text + ' — notation gives ' +
            derivedLetters + ' (MIDI ' + top.midi + '), the file says ' + statedLetters +
            ' (MIDI ' + statedMidi + ') — kept the file\'s');
        } else {
          report.warnings.push('measure ' + measureNumber + ' bass: ' + text + ' — notation gives ' +
            derivedLetters + ' (MIDI ' + top.midi + '), the file says ' + statedLetters +
            ' (MIDI ' + statedMidi + ')');
        }
      } else if (index === 0 && statedLetters && statedLetters !== derivedLetters) {
        report.warnings.push('measure ' + measureNumber + ' bass: ' + text +
          ' — notation gives ' + derivedLetters + ', the file says ' + statedLetters);
      }

      const event = eventFrom(notes);
      event.num = Number.formatChord(text);
      event.let = index === 0 && statedLetters ? statedLetters : derivedLetters;
      // The old entries carry no lengths, so the measure is shared out between them:
      // one chord is held through the bar and drawn open, two are moving notes and are
      // filled — which is exactly how test.html draws its moving bass in measure 4.
      event.duration = chordTexts.length > 1 ? '4.' : '2.';
      event.units = chordTexts.length > 1 ? 24 : 48;
      event.spacing = 8;
      return event;
    });
  }

  /**
   * True when the letter name and the MIDI number stored beside a note agree with each
   * other. When they do, but the number notation disagrees, the notation is the one
   * carrying the typo, so the pair wins and the fault is recorded rather than hidden.
   */
  function agreesWithItself(statedMidi, letterText) {
    if (statedMidi === null || !letterText) return false;
    const fromLetters = Letter.chordToMidis(withoutDot(letterText));
    return fromLetters.length > 0 && Math.max.apply(null, fromLetters) === statedMidi;
  }

  /**
   * One beat's worth of the model. The notes keep the order they were written in, so a
   * label reads the way the score spells it, but the beat's own pitch is its highest
   * note — that is where the oval is drawn and what a click plays.
   */
  function eventFrom(notes) {
    const top = notes.reduce(function (highest, note) {
      return !highest || note.midi > highest.midi ? note : highest;
    }, null);
    return {
      notes: notes,
      num: labelFrom(notes, 'num'),
      let: labelFrom(notes, 'let'),
      topNum: top ? top.num : '',
      topLet: top ? top.let : '',
      midi: top ? top.midi : null,
      letter: top ? top.letter : 'B',
      accidental: top ? top.accidental : '',
      octave: top ? top.octave : 4,
      start: 0,
      units: 8,
      spacing: 8,
      duration: '8',
      grace: false,
      rest: notes.length === 0,
      tie: false,
      dotted: false,
      hollow: false
    };
  }

  /** "7/5" for a dyad, the single name for one note. */
  function labelFrom(notes, key) {
    if (!notes.length) return '';
    return notes.map(function (note) { return note[key]; }).join('/');
  }

  /** Where each beat falls in the measure, counted in 64th notes from the barline. */
  function layOutTime(events) {
    let at = 0;
    events.forEach(function (event) {
      event.start = at;
      at += event.units;
    });
  }

  /**
   * Which noteheads are drawn open, which is test.html's own rule rather than a
   * musical one: a long note is open when nothing shorter shares its measure, a held
   * bass note is open when it is the measure's only bass event.
   */
  function decideHollow(measure) {
    const hasPlainNote = measure.rh.some(function (event) {
      return !event.rest && event.units <= DURATIONS['8'];
    });

    measure.rh.forEach(function (event) {
      event.hollow = !event.rest && (event.units >= DURATIONS['2'] || (event.dotted && !hasPlainNote));
    });
    measure.lh.forEach(function (event) {
      event.hollow = !event.rest && (event.units >= DURATIONS['2'] || measure.lh.length === 1);
    });
  }

  // ------------------------------------------------------------------ questions

  /** Every pitch class the measure asks for, melody and bass together. */
  function targetPitchClasses(measure) {
    const classes = new Set();
    soundingMidis(measure).forEach(function (midi) { classes.add(Pitch.pitchClassOf(midi)); });
    return classes;
  }

  /** Every note the measure asks for, as it will sound, without repeats. */
  function targetMidis(measure) {
    const midis = [];
    soundingMidis(measure).forEach(function (midi) {
      if (midis.indexOf(midi) === -1) midis.push(midi);
    });
    return midis;
  }

  function soundingMidis(measure) {
    const shift = measure.octaveShift || 0;
    const midis = [];
    measure.rh.concat(measure.lh).forEach(function (event) {
      event.notes.forEach(function (note) {
        if (Pitch.isValidMidi(note.midi)) midis.push(note.midi + shift);
      });
    });
    return midis;
  }

  /** Everything a measure holds, in the order it is played — used to play it back. */
  function eventsInOrder(measure) {
    return measure.rh.map(function (event) { return { when: event.start, event: event, hand: 'rh' }; })
      .concat(measure.lh.map(function (event) { return { when: event.start, event: event, hand: 'lh' }; }))
      .sort(function (a, b) { return a.when - b.when; });
  }

  return {
    load: load,
    targetPitchClasses: targetPitchClasses,
    targetMidis: targetMidis,
    soundingMidis: soundingMidis,
    eventsInOrder: eventsInOrder,
    octaveShiftOf: octaveShiftOf
  };
})();
