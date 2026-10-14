/**
 * Turns the raw flower_day.json data into the internal score model.
 *
 * The source data is compact and slightly irregular (the left hand is sometimes a
 * 2-element array, sometimes 3; chords are packed into a single "3,/1,/6,," string).
 * Everything downstream should be able to assume a clean, uniform structure, so
 * all of that parsing happens here and nowhere else.
 */
window.App = window.App || {};

window.App.ScoreLoader = (function () {
  'use strict';

  var Config = window.App.Config;
  var Pitch = window.App.Pitch;

  var SHARP_CHARS = /[#♯]/;
  var NATURAL_CHARS = /[♮]/;
  var FLAT_CHARS = /[b♭]/;

  /**
   * Work out the source notation for one hand entry.
   *
   * The score writes the left hand either as ["3/7,", "E3/B2", 52] or as
   * ["2,/7,,", "#1,/6,,", 50]; the notation string is always first and the MIDI
   * number always last, but the middle element is only present sometimes.
   */
  function splitEntry(entry) {
    if (!entry) return { notation: '', letters: '', midis: [] };

    if (Array.isArray(entry)) {
      var notation = typeof entry[0] === 'string' ? entry[0] : '';
      var letters = entry.length >= 3 && typeof entry[1] === 'string' ? entry[1] : '';
      var last = entry[entry.length - 1];
      var midis = [];

      if (Array.isArray(last)) {
        // e.g. ["3,/7,", "E3/B3", [52, 59]]
        midis = last.slice();
      } else if (typeof last === 'number') {
        midis = [last];
      }

      return { notation: notation, letters: letters, midis: midis };
    }

    if (typeof entry === 'number') return { notation: '', letters: '', midis: [entry] };
    return { notation: String(entry), letters: '', midis: [] };
  }

  /**
   * The last element of a left-hand entry carries the notes. When the notation
   * packs several notes into one string ("3,/7,") the MIDI list holds them all.
   */
  function leftHandMidis(entry) {
    var parsed = splitEntry(entry);
    if (parsed.midis.length) return parsed.midis;

    // Fall back to the letter spelling ("E3/B2") when no numbers were given.
    if (parsed.letters) {
      return parsed.letters.split('/').map(function (name) {
        var note = Pitch.parseLetterName(name);
        return note ? note.midi : null;
      }).filter(function (m) { return m !== null; });
    }
    return [];
  }

  /** Every right-hand note of a measure, in order. */
  function rightHandNotes(measure) {
    var notes = [];
    (measure.rh || []).forEach(function (entry) {
      var parsed = splitEntry(entry);
      var notation = parsed.notation;
      var midi = parsed.midis.length ? parsed.midis[0] : null;

      if (midi === null && parsed.letters) {
        var note = Pitch.parseLetterName(parsed.letters);
        if (note) midi = note.midi;
      }
      if (midi === null) return;

      notes.push({
        notation: notation,
        letters: parsed.letters,
        midi: midi,
        dotted: notation.indexOf('.') !== -1,
        numDegree: numberDegreeOf(notation),
      });
    });
    return notes;
  }

  /** The bare degree digit in a notation string ("#1'" -> 1). */
  function numberDegreeOf(notation) {
    var match = /(\d)/.exec(notation || '');
    return match ? parseInt(match[1], 10) : null;
  }

  /** Accidental symbol found in a notation string, normalised. */
  function accidentalOf(notation) {
    if (SHARP_CHARS.test(notation)) return 'sharp';
    if (NATURAL_CHARS.test(notation)) return 'natural';
    if (FLAT_CHARS.test(notation)) return 'flat';
    return 'none';
  }

  /**
   * Build the model.
   * @param {object} raw the parsed flower_day.json contents
   */
  function build(raw) {
    if (!raw || !Array.isArray(raw.measures)) {
      throw new Error('Score data is missing a "measures" array.');
    }

    var meta = raw.meta || {};
    var key = '0';
    var time = meta.timeSignature || '4/4';

    var measures = raw.measures.map(function (source, index) {
      // Key and time signature carry over until the score changes them.
      if (source.key) key = source.key;
      if (source.time) time = source.time;

      var rh = rightHandNotes(source);
      var lhMidis = leftHandMidis(source.lh);

      return {
        number: source.m ? source.m : index + 1,
        key: key,
        time: time,
        sourceKey: source.key || null,
        sourceTime: source.time || null,
        changedKey: Boolean(source.key) && index > 0 && source.key !== raw.measures[index - 1].key,
        changedTime: Boolean(source.time) && index > 0 && source.time !== raw.measures[index - 1].time,
        rightHand: rh,
        leftHand: lhMidis.slice().sort(function (a, b) { return a - b; }),
        targetMidis: rh.map(function (n) { return n.midi; })
          .concat(lhMidis)
          .sort(function (a, b) { return a - b; }),
      };
    });

    var score = {
      meta: {
        title: meta.title || '',
        subtitle: meta.subtitle || '',
        composer: meta.composer || '',
        arranger: meta.arranger || '',
        timeSignature: meta.timeSignature || time,
        tempoDottedQuarter: meta.tempoDottedQuarter || 0,
      },
      measures: measures,
      systems: groupIntoSystems(measures),
      totalMeasures: measures.length,
    };

    score.msPerMeasure = measureDurationMs(score);
    return score;
  }

  /** Measures are laid out in fixed-size rows ("systems") of 4. */
  function groupIntoSystems(measures) {
    var perSystem = Config.score.measuresPerSystem;
    var systems = [];
    for (var i = 0; i < measures.length; i += perSystem) {
      systems.push({
        index: systems.length,
        measures: measures.slice(i, i + perSystem),
      });
    }
    return systems;
  }

  /**
   * Duration of the piece's usual measure, from the tempo marking.
   * 6/8 at a dotted-quarter = 50 means each measure is 2 dotted quarters.
   */
  function measureDurationMs(score) {
    var bpm = score.meta.tempoDottedQuarter;
    if (!bpm) return Config.timing.msPerMeasureFallback;

    var parts = String(score.meta.timeSignature).split('/');
    var beatsPerMeasure = parseInt(parts[0], 10);
    var beatUnit = parseInt(parts[1], 10);
    if (!beatsPerMeasure || !beatUnit) return Config.timing.msPerMeasureFallback;

    // A dotted-quarter beat is 1.5 quarter notes.
    var quarterNotesPerMeasure = beatsPerMeasure * (4 / beatUnit);
    var msPerQuarter = 60000 / bpm / 1.5;
    return quarterNotesPerMeasure * msPerQuarter;
  }

  /** Load the score from the global that music-sheet/flower-day.js defines. */
  function load() {
    var raw = window[Config.score.dataGlobal];
    if (!raw) {
      throw new Error(
        'Score data not found. Expected the global "' + Config.score.dataGlobal +
        '" from music-sheet/flower-day.js.'
      );
    }
    return build(raw);
  }

  return {
    load: load,
    build: build,
    splitEntry: splitEntry,
    accidentalOf: accidentalOf,
  };
})();
