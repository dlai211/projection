# 꽃날 (Flower Day) — Piano Listener & Trainer

A single-page web app for **reading, listening to and practising** a piano piece:
the score is drawn in pencil on coarse watercolour paper, a microphone follows what
you play, and the keyboard below shows you where to put your fingers.

- Requirements and design decisions: [PRD.md](PRD.md)
- Music font attribution: [NOTICE-BRAVURA.md](NOTICE-BRAVURA.md)

## Running it

The page loads its score from `music-sheet/flower-day.js`, a plain script, so it
also works when opened directly. A local server is still the better way to run it
(the browser caches less aggressively and relative paths behave exactly as they do
in production):

```bash
cd projection/piano
python -m http.server 8080
```

Then open <http://localhost:8080/>. On the **piano** folder you can also just
double-click `index.html`.

## Current state

Phase 1 (sheet rendering) is complete: the whole 64-measure score renders with
correct clefs, key and time signatures, the grand-staff brace, beamed groups,
ledger lines and handwritten annotations; the notation toggles between 123 and ABC;
the number of systems adapts to the window height; and the staff-spacing control
cycles normal → tight → loose.

Later phases (see PRD §10) add the keyboard, the audio engine, the polyphonic
detector and the practice/listening modes.

## Controls

| Control | What it does |
|---|---|
| `123` / `ABC` | Switch every annotation between number notation and letter names |
| Microphone | Turn the listening mode on or off (wired up in phase 3) |
| Circular arrow | Back to measure 1 |
| Three lines (badge `N`/`T`/`L`) | Cycle the staff spacing: normal → tight → loose |

Clicking any measure moves the practice position there. The sheet scrolls when the
piece is longer than the window.

## Editing the score

`music-sheet/flower_day.json` is the source of truth. After editing it, rebuild the
loadable script:

```bash
python tools/build_score.py music-sheet/flower_day.json music-sheet/flower-day.js
```

## Layout of the code

| File | Responsibility |
|---|---|
| `js/config.js` | every tunable number — colours live in CSS instead |
| `js/pitch-utils.js` | MIDI, note names, octaves, frequencies |
| `js/notes-letter.js` | the ABC notation system |
| `js/notes-number.js` | the 123 (Jianpu) notation system |
| `js/staff-utils.js` | pitch → position on the treble/bass staff |
| `js/glyphs-bravura.js` | generated musical glyph outlines |
| `js/score-loader.js` | turns the source JSON into the score model |
| `js/sheet-render.js` | draws the systems |
| `js/app.js` | wiring: controls, resize, redraw |

## Tools

| Script | Purpose |
|---|---|
| `tools/build_score.py` | JSON → loadable `.js` score |
| `tools/extract_bravura_glyphs.py` | font → `js/glyphs-bravura.js` |
| `tools/check-model.js` | headless sanity check of parsing and placement (`node tools/check-model.js`) |
