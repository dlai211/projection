# 꽃날 (Flower Day) — a page that listens while you practise

Sixty-four measures of pencil-on-paper score, a piano keyboard along the bottom, and a
listener that can hear several notes at once — so the page can tell whether the measure
being practised has actually been played, and move on by itself.

The look is `test.html`'s, unchanged: the same paper, the same graphite, the same
handwritten notes. `test.html` is the visual reference and is never edited. What this
page adds is all sixty-four measures, laid out by code, and the listening.

---

## Running it

Double-clicking `index.html` works: the score is stored as a `.js` file rather than a
`.json` one precisely so that it can be read from disk.

Two things need the local server instead, because browsers refuse to open local files
for these:

- the **test recording** (`test-music/flower_day.mp3`) — the Web Audio graph will not
  take a file loaded from disk;
- the **piano samples** (`piano-mp3/*.mp3`) — the page falls back to a plain tone.

So for anything beyond looking at the score:

```
cd projection/piano
python -m http.server 8080
```

then open <http://localhost:8080/>.

---

## Using it

**Listening Mode** (microphone off) — click any measure. A small pencil menu offers to
play just that measure, or to play from there to the end of the piece. The play and stop
buttons sit in the top bar; the sheet and the keyboard follow along, and the page
scrolls itself.

**Learning Mode** (press the microphone) — the measure to practise is shaded, its keys
are lit, and the page waits. Play it, and when every note it asks for has been heard —
the melody and the left-hand chord together — the page moves on and scrolls if it needs
to. Clicking a measure jumps straight there.

**Everything else in the top bar**

| Control | What it does |
|---|---|
| `123 / ABC` | Switches every written label: on the notes and on the keys |
| The spacing icon | Cycles the gap between systems: normal, tight (2 px), loose |
| The two keyboard icons | Octaves 2–6, or the full 88 keys |
| The bars icon | Opens the listening panel (§below) |
| The play and stop icons | Play from the current measure to the end, and stop |
| The microphone | Learning Mode on and off |
| The arrow | Back to measure 1 |

**The listening panel** shows what the detector can hear: the twelve pitch classes as
bars, the notes it has recognised, what the current measure asks for, and how much of it
has been played. At the bottom is the test recording — play it and the page will follow
it, measure by measure, exactly as it would follow you.

**The ruler** down the right margin is the scrollbar, which is hidden so the paper looks
like paper. Drag it to move through the piece.

---

## Tuning it

Everything adjustable is a number in `js/config.js`, with a comment saying what it is
for. The three worth knowing about first:

| Setting | When to change it |
|---|---|
| `detect.matchThreshold` (0.25) | The page hears the piano but will not move on. Lower it — the left hand is being played too softly to count |
| `detect.settleMs` (600) | The page moves on too eagerly, before you have played the next measure |
| `detect.holdFrames` (3) | A single stray noise passes a measure. Raise it |

`js/config.js` also holds the drawing's own measurements — the staff geometry and the
bar lines — which are `test.html`'s and should not be touched without looking at it.

---

## Checking it

Four tools, none of which need a browser. They run the real modules, not copies of them,
so what they report is what the page does.

```
node tools/check_score.js     # every note: notation, letter name and MIDI number agree
node tools/check_layout.js    # the drawn positions against test.html's hand-placed ones
node tools/check_detect.js    # the listener, against synthesised chords and all 64 measures
node tools/check_render.js    # the whole page, headless, with the controls driven
```

`check_detect.js` is the interesting one: it builds the spectrum a piano *would* produce
— a peak for each note plus its partials — and checks what the detector makes of it.

---

## Changing the score

`music-sheet/flower_day.json` is the score, and it accepts two shapes at once, so it can
be moved over to the full arrangement a measure at a time.

**A beat of the full arrangement** — a length, one or more notes, and any marks:

```jsonc
{ "dur": "8",  "notes": ["5", "7"] }        // G4 and B4 together, on one stem
{ "dur": "16", "notes": ["7"] }
{ "dur": "4.", "notes": ["3''"], "tie": true }   // tied into the next beat
{ "dur": "8",  "rest": true }
{ "dur": "grace", "notes": ["1''"] }
```

`dur` is one of `1 2 2. 4 4. 8 8. 16 16. 32 64`, or `grace`. Notes are written in the
same number notation the sheet prints, so `1` is C, `7` is B, `#4` is F♯, `♮4` is F, and
`'` / `,` move by octaves. A slash string works too: `"notes": ["1,/5,,"]`.

**The old simplified entries** — `["7","B4",71]` for a melody note and
`["3/7,", "E3/B2", 52]` for a bass chord — still work, and keep the spacing that was
matched to `test.html`.

Measured-level fields: `key`, `time`, `lhClef` (`"treble"` or `"bass"`) and
`octave` (`"8va"`). The first three carry over from the measure before until they change.

After editing, rebuild the file the page actually loads:

```
python tools/build_score.py music-sheet/flower_day.json music-sheet/flower-day.js
node tools/check_score.js
```

The check is worth running: it re-derives every pitch from the number notation and
compares it with the letter name and MIDI number stored beside it, so a typo shows up
immediately. It is how measure 1's bass — written `3/7,` where every comparable measure
writes `3,/7,,` — was found.

---

## How it is put together

HTML, CSS and JavaScript are kept apart, and the scripts are plain `<script>` tags on a
`window.App` namespace rather than modules, so the page also opens straight from disk.

```
index.html          structure and script tags only
styles/             theme.css (paper and pencil), layout.css, components.css
js/                 config, pitch helpers, both notation systems, the score loader,
                    the layout engine, the sheet and keyboard renderers, the ruler,
                    the detector, the sound, the audio engine, the two modes, and app.js
music-sheet/        the score: .json to edit, .js to load
piano-mp3/          one recording per key
tools/              the build script and the four checks
PRD.md              the specification and the changelog
```

`PRD.md` is the place to look for *why* something is the way it is — every decision that
was not obvious, and everything known to be a limitation, is written down there.
