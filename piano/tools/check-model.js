/**
 * Headless sanity check for the score model.
 *
 * Loads the browser modules in Node with a minimal `window` shim and prints what
 * the renderer would receive: derived key signatures, time signatures, staff
 * positions, note spacing and the beam grouping. Run it after touching
 * score-loader.js, staff-utils.js or the notation modules.
 *
 *   node tools/check-model.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const files = [
  'js/config.js',
  'js/pitch-utils.js',
  'js/notes-letter.js',
  'js/notes-number.js',
  'js/staff-utils.js',
  'music-sheet/flower-day.js',
  'js/score-loader.js',
];

const sandbox = { window: {}, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const file of files) {
  const code = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
}

const App = sandbox.window.App;
const score = App.ScoreLoader.load();

console.log(`title:    ${score.meta.title}`);
console.log(`measures: ${score.totalMeasures}  systems: ${score.systems.length}`);
console.log(`ms/measure: ${score.msPerMeasure.toFixed(0)}`);

// --- key and time signatures must change exactly where the score says ---------
const changes = [];
for (const m of score.measures) {
  if (m.changedKey) changes.push(`key -> ${m.key} at m${m.number}`);
  if (m.changedTime) changes.push(`time -> ${m.time} at m${m.number}`);
}
console.log(`signature changes: ${changes.join(', ') || 'none'}`);

// --- staff placement ---------------------------------------------------------
console.log('\nstaff placement (midi -> clef y, ledgers):');
for (const midi of [93, 88, 81, 71, 60, 59, 48, 36]) {
  const clef = midi < 60 ? 'bass' : 'treble';
  const pos = App.Staff.position(midi, clef);
  const ledgers = App.Staff.ledgerLines(pos.y, clef, App.Config.sheet);
  console.log(
    `  ${String(midi).padStart(3)} ${App.Pitch.letterName(midi).padEnd(4)} ` +
    `${clef.padEnd(6)} y=${String(pos.y).padStart(5)} ` +
    `ledgers=[${ledgers.join(', ')}]`
  );
}

// --- spacing + beams ---------------------------------------------------------
console.log('\nnotes per measure histogram:');
const histogram = {};
for (const m of score.measures) histogram[m.rightHand.length] = (histogram[m.rightHand.length] || 0) + 1;
console.log('  ' + Object.keys(histogram).sort((a, b) => a - b).map(k => `${k} notes: ${histogram[k]}`).join('   '));

// --- notation labels ---------------------------------------------------------
console.log('\nlabels for measure 4 and 46 (they exercise accidentals):');
for (const number of [4, 46]) {
  const m = score.measures[number - 1];
  const rh = m.rightHand.map(n =>
    `${App.Pitch.letterName(n.midi)}/${App.NotesNumber.label(n.midi, m.key)}/${App.NotesLetter.label(n.midi, m.key)}`
  );
  console.log(`  m${number} key=${m.key} RH: ${rh.join('  ')}`);
  console.log(`        LH: ${m.leftHand.map(x => App.NotesNumber.label(x, m.key)).join('/')}`);
}

// --- where the ink actually sits in the drawing band --------------------------
// These are the values that belong in Config.layout.inkTop / inkBottom: the
// layout needs them so that systemGapPx measures the visible gap between systems
// rather than the invisible gap between two drawing boxes.
let inkTop = Infinity;
let inkBottom = -Infinity;
const consider = (midi) => {
  const clef = midi < 60 ? 'bass' : 'treble';
  const pos = App.Staff.position(midi, clef);
  inkTop = Math.min(inkTop, pos.y - 4.2);
  inkBottom = Math.max(inkBottom, pos.y + 4.2);
  for (const ledger of App.Staff.ledgerLines(pos.y, clef, App.Config.sheet)) {
    inkTop = Math.min(inkTop, ledger);
    inkBottom = Math.max(inkBottom, ledger);
  }
};
for (const m of score.measures) {
  m.rightHand.forEach(n => consider(n.midi));
  m.leftHand.forEach(consider);
}
// Labels and stems reach past the noteheads (stems are 32 units long).
console.log(`\nink extents (noteheads + ledger lines): top ${inkTop.toFixed(1)}, bottom ${inkBottom.toFixed(1)}`);
console.log(`  with stems and written labels: top ${(inkTop - 12).toFixed(1)}, bottom ${(inkBottom + 12).toFixed(1)}`);
console.log(`  drawing band: ${App.Config.sheet.viewBox.from} .. ${App.Config.sheet.viewBox.from + App.Config.sheet.viewBox.h}`);
console.log(`  config inkTop=${App.Config.layout.inkTop} inkBottom=${App.Config.layout.inkBottom}`);

// --- anything obviously broken ----------------------------------------------
const problems = [];
for (const m of score.measures) {
  for (const n of m.rightHand) {
    if (n.midi === null || n.midi === undefined) problems.push(`m${m.number} RH has no midi`);
  }
  if (!m.rightHand.length) problems.push(`m${m.number} has no right-hand notes`);
  if (!m.leftHand.length) problems.push(`m${m.number} has no left-hand notes`);
}
console.log(`\nproblems: ${problems.length ? problems.join('; ') : 'none'}`);
