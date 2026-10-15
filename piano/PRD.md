# PRD — Piano Listener & Trainer (Flower Day, 64 measures)

> This file is the specification **and** the changelog for `projection/piano/`.
> After each phase, add a "Phase N complete" entry at the bottom, then commit.

- Drafted: 2026-10-14
- Status: **requirements being confirmed (v1.0) — no application code written yet**
- User: the author (no coding background; practises on a real piano with a computer
  and a microphone)

---

## 1. Goal

One web page that turns a computer (screen + microphone) into three things:

1. **Read the score** — all 64 measures of `music-sheet/flower_day.json`, drawn in the
   exact pencil-on-coarse-paper style of `test.html`, 4 measures per system, 16 systems
   scrolling continuously downward behind a keyboard fixed at the bottom of the screen.
2. **Listen** — detect several pitches at once (melody + left-hand chord) with the Web
   Audio API, from either a live microphone or the test recording `flower_day.mp3`.
3. **Practise** — Learning Mode (microphone on) highlights the measure to play and moves
   on when it has been played; Listening Mode (microphone off) plays a chosen measure, or
   from a chosen measure to the end.

---

## 2. Starting point

| Path | What it is | How it is used |
|---|---|---|
| `piano/test.html` | **The visual, theme and code baseline** (measures 1–8 only, hand-placed) | **Read-only. Never modified.** Its CSS, SVG filters and drawing functions are lifted into the new files |
| `piano/music-sheet/flower_day.json` | The score, 64 measures | Read-only source of truth for notes |
| `piano/test-music/flower_day.mp3` | Test recording | Drives Test Audio Mode for the detector |
| `piano/piano-mp3/*.mp3` | 88 piano samples, A0–C8 (verified: real, distinct recordings, ~10 KB each) | Playback sound (synth fallback for anything missing) |
| `piano/pitch-detection/crepe/` | An ml5 CREPE model (**monophonic**) | **Not used.** CREPE cannot hear chords |
| `piano/target_reference.jpg` | A screenshot of `test.html` | Reference for comparing the new page |

### 2.1 What happened to the previous attempt

An earlier version of this app exists in git (`f5cfb00`, 2026-10-13). **It was rejected
and its files have been deleted from the working tree.** It is worth recording why, so
the same mistakes are not repeated:

- It replaced the baseline's handwritten look with **Bravura music-font outlines**,
  drew a **curly brace `{`** at the left of every system, and drew **time signatures on
  the staves** — all three are forbidden here.
- It **changed the theme**: paper `#ece6da` → `#f8f4ea`, paper opacity `0.78` → `0.58`,
  graphite `#282624` → `#312d29`.
- It only ever reached **phase 1 (the drawing)**. The keyboard, the listener, the
  notation modules for the keyboard, and both modes were never built, so there is no
  working code to inherit for those parts.
- Its `notes-number.js` used **movable-do** numbering (1 = the key's tonic), which
  contradicts the score data (see §5.3).

**Only two small pieces are worth carrying over**, rewritten to fit this plan:
`tools/build_score.py` (JSON → `<script>`-loadable JS) and the pitch helpers in
`pitch-utils.js` (MIDI ↔ name ↔ frequency). Everything else is built fresh.
`NOTICE-BRAVURA.md` does **not** come back: no Bravura glyph is used anywhere.

---

## 3. The golden rule: visuals are frozen

The new page must look **100 % identical** to `test.html`. Everything below is copied
verbatim, not re-designed:

- **Theme tokens** — `--paper-base: #ece6da`, `--graphite-2b: #282624`,
  `--graphite-hb: #595550`, `--graphite-faint: #8c867e`,
  `--pencil-highlight: rgba(40,38,36,0.09)`, `--modern-border`, `--modern-surface`.
- **Paper** — the fixed full-screen SVG layer with `<feTurbulence
  baseFrequency="0.045 0.05" numOctaves="5" seed="11">` + `<feDiffuseLighting
  lighting-color="#f2ece1" surfaceScale="2.6">`, `mix-blend-mode: multiply`,
  `opacity: 0.78`.
- **Pencil edge** — the `#graphite-edge` filter (`feTurbulence baseFrequency="0.6"` +
  `feDisplacementMap scale="1.9"`) on every stroke, note, label and icon.
- **Type** — `Caveat` for everything handwritten, `Inter` for the controls.
- **The drawing itself** — staff geometry, barlines, hand-drawn Unicode clefs `𝄞 𝄢`,
  handwritten `♯`, noteheads (tilted ellipses), stems (always down, 26 units), beams
  (4.2-wide strokes), open-oval left-hand notes, treble labels **above** the note,
  bass labels **below**, measure numbers above the top line, and the graphite smudge
  behind the active measure — all at `test.html`'s exact coordinates.
- **The keyboard** — pencil-outlined white keys, black keys filled with the
  procedurally scraped graphite canvas texture (5 variants), the same label style.
- **The top bar** — handwritten title, `♩. = 50 • 6/8`, the `123 / ABC` pill and the
  round controls.

**Nothing new is drawn on the staves.** In particular: no brace, no time signature, no
new symbol types. Two additions are *unavoidable* because `test.html` never needed them,
and both are drawn in its existing style:

1. **Ledger lines** for notes that fall outside the two staves (§6.4).
2. **Per-measure label sizing** so the busiest measures (9–12 notes) do not collide (§6.5).

---

## 4. File layout

```
piano/
├─ index.html                 # structure + <script> tags only
├─ styles/
│  ├─ theme.css               # paper, graphite, type, filters (copied from test.html)
│  ├─ layout.css              # top bar, scrolling sheet, fixed keyboard, ruler
│  └─ components.css          # pill switch, icon buttons, keys, bubble menu, ruler
├─ js/
│  ├─ config.js               # every tunable number for the drawing
│  ├─ pitch-utils.js          # MIDI ↔ name ↔ frequency ↔ staff step
│  ├─ notes-number.js         # "123" notation (fixed-do, see §5.3)
│  ├─ notes-letter.js         # "ABC" notation
│  ├─ score-loader.js         # JSON → model (parse, derive, cross-check)
│  ├─ layout.js               # the layout engine (§6): slots, x-positions, beams
│  ├─ sheet-render.js         # test.html's drawing code, ported, N systems
│  ├─ keyboard-render.js      # bottom keyboard, both ranges
│  ├─ ruler.js                # the pencil ruler down the right margin
│  ├─ audio-engine.js         # microphone + test audio into one AnalyserNode
│  ├─ pitch-detect.js         # polyphonic detection (FFT peaks → chroma)
│  ├─ piano-sound.js          # samples + synth fallback
│  ├─ practice.js             # Learning Mode state machine
│  ├─ playback.js             # Listening Mode
│  └─ app.js                  # wiring: controls, scroll, redraw
├─ music-sheet/
│  ├─ flower_day.json         # the score (read-only)
│  └─ flower-day.js           # generated by tools/build_score.py
├─ tools/
│  ├─ build_score.py          # JSON → window.FLOWER_DAY_SCORE
│  ├─ check_score.js          # notation ↔ letter ↔ MIDI, ranges, drawn positions
│  ├─ check_layout.js         # the layout engine vs test.html's hand-placed notes
│  └─ check_render.js         # runs the whole page headless and drives the controls
└─ PRD.md
```

**Constraints**

- HTML, CSS and JS strictly separated; **no styling or logic inside `index.html`**.
- Classic `<script>` tags attaching to `window.App` (no ES modules, no bundler), so the
  page works from `file://` **and** from `http://localhost:8080`.
- The score is loaded from the generated `music-sheet/flower-day.js`, never fetched,
  because browsers refuse `fetch()` on `file://`.
- All text (interface, comments, docs) in English, except the song's own Korean title
  and subtitle.
- Dev server: `cd projection/piano` → `python -m http.server 8080`.
  Node 20 and Python 3.11 are both available; the tools use Python.

---

## 5. The score data

### 5.1 Shape

Two shapes are accepted, so the score can be moved over to the full arrangement a measure
at a time without ever leaving the page broken.

**The full arrangement** — a beat holds one or more notes and carries its written length:

```jsonc
{ "m": 1, "key": "1#", "lhClef": "treble", "octave": "8va", "time": "3/8",
  "rh": [
    { "dur": "8",  "notes": ["5", "7"] },        // a chord: G4 + B4 on one stem
    { "dur": "16", "notes": ["7"] },
    { "dur": "4.", "notes": ["3''"], "tie": true },
    { "dur": "8",  "rest": true },
    { "dur": "grace", "notes": ["1''"] }
  ],
  "lh": [ { "dur": "8", "notes": ["1,", "5,,"] } ] }
```

| Field | Meaning |
|---|---|
| `dur` | `1 2 2. 4 4. 8 8. 16 16. 32 64`, or `grace` |
| `notes` | one token, or several — a slash string like `"1,/5,,"` works too |
| `rest` | true for a rest (its `dur` is still its length) |
| `tie` | the note is tied to the next beat of the same hand |
| `lhClef` | `"treble"` or `"bass"` — carries over until it changes |
| `octave` | `"8va"` — written as it looks, sounding an octave higher |
| `time` | carries over until it changes; a change is drawn on the staves |

**The old, simplified entries** — one note with no written length:

```jsonc
  "rh": [["7","B4",71], ["7.","B4.",71], ...],
  "lh": ["3/7,", "E3/B2", 52]
```

Both end up in the same model. A measure whose two hands both carry written lengths is
placed on the real time axis; a measure still in the old shape keeps the spacing that was
calibrated against `test.html`, so the two can sit side by side.

`key` runs `1#` for measures 1–41 and `3#` for 42–64; `time` is `3/8` for measure 32
only. Both carry over from the previous measure until changed.

### 5.2 Number notation is complete — everything is derived from it

A number token has the form `[#|♮] degree ['… | ,…] [.]`, e.g. `#1'`, `♮4`, `6,,`, `3''.`
and a packed chord joins them with `/`, e.g. `3,/1,/6,,`.

| Part | Meaning |
|---|---|
| degree | `1 2 3 4 5 6 7` = **C D E F G A B** (fixed-do, see §5.3) |
| `#` / `♮` | sharp / natural before the degree |
| `'` / `,` | one octave up / down, relative to the octave of middle C |
| `.` | a long note (a dotted quarter in 6/8) |

Deriving pitch from the token is exact, so the loader treats the **number notation as
the source of truth** and uses the letter string and MIDI number as a cross-check.
Measured against the whole file, everything agrees except the one case in §5.4.

### 5.3 The `123` system is fixed-do (1 = C, always)

The score writes B as `7` in `1#` **and** in `3#`; A as `6` in both; F♮ as `♮4` and F♯ as
`#4`. So `1` is always C, in every key — which is also exactly what `test.html`'s
keyboard labels do. (The rejected version used movable-do, where `1` would be G in
measures 1–41 and A in 42–64; that is why its labels disagreed with the score file.)

Octave marks: `1` = middle C (C4), `1'` = C5, `1''` = C6, `1,` = C3, `1,,` = C2.

### 5.4 Known data quirks (handled, not "fixed")

1. **Measure 4 packs two chords into one entry**:
   `["2,/7,,", "#1,/6,,", 50]` — two notation strings and one MIDI number. `test.html`
   draws two bass notes there, so the loader splits it into two entries: `2,/7,,`
   (D3 + B2, top note D3 = 50, which matches the trailing MIDI) and `#1,/6,,`
   (C#3 + A2, derived).
2. **Measures do not always fill 6/8** (measure 1 has seven eighths, measure 45 has
   twelve). Durations are reconstructed for spacing and playback timing only; nothing
   depends on them being musically exact.
3. **`m32` is 3/8.** Since no time signature is ever drawn on the staff, this only
   affects the beat-grouping used for left-hand alignment and playback timing.

### 5.5 Checks — run before believing the page

Three tools, all of them running the real modules rather than a copy of their logic:

| Tool | What it proves |
|---|---|
| `node tools/check_score.js` | Every note's number notation agrees with the letter name and MIDI number beside it; every pitch is inside A0–C8; the systems and the crowded measures come out as expected |
| `node tools/check_layout.js` | Prints the engine's x and y for measures 1–8 against test.html's hand-placed ones, note by note, with the difference — so any drift is visible as a number |
| `node tools/check_render.js` | Builds the whole page in a headless DOM and drives the controls: switch notation, cycle the spacing, swap the keyboard range, click a note, drag the ruler, resize |

`check_score.js` found one real fault in the score file the day it was written:
**measure 1's bass reads `3/7,` where every comparable measure writes `3,/7,,`** — the
number notation is missing its octave commas. The letter name and the MIDI number
disagree with it but agree with each other, so the loader keeps the file's own pitch
(E3/B2) and prints the fault. Fixing it is a one-character edit to the JSON; until then
the bass of measure 1 is drawn and played correctly but its handwritten label reads the
way the file spells it.

---

## 6. The layout engine

`test.html` places every one of its 8 measures by hand. The 64-measure score has no
coordinates, so positions are **computed**, using `test.html`'s own coordinate system.

### 6.1 Geometry — copied unchanged

| Thing | Value |
|---|---|
| Drawing window (`viewBox`) | `0 0 1000 205` |
| Staff lines, x | 20 → 985 |
| Treble lines, y | 35, 45, 55, 65, 75 (bottom line = E4) |
| Bass lines, y | 130, 140, 150, 160, 170 (bottom line = G2) |
| Barlines, x | 20, 305, 530, 770, 985 — the same four slots in every system |
| Measures per system | 4 → 16 systems for 64 measures |
| Rendered size | `width:100%; max-width:1360px; max-height:235px`, centred |

Pitch → y is the same 5 units per staff step `test.html` implies: B4 = 55 (middle line
of the treble staff), G2 = 170 (bottom line of the bass staff).

### 6.2 Horizontal placement of the melody

Within a measure's slot, the melody occupies a content box:

- left pad **85** in the first slot of a system (clears the clef and key signature —
  this is `test.html`'s 105 = 20 + 85), otherwise **32**;
- right pad **26**.

Notes are then spread by duration weight — a long note (`.`) counts 3, any other note
counts 1 — so that the last note lands exactly on the right edge of the box, with the
per-eighth step capped at 44 units and the line re-centred when the cap bites (so short
measures do not spread out thinly, as `test.html`'s measure 7 does not).

Checked against `test.html`'s hand-placed measures 1, 2, 3 and 8, this reproduces every
note to within about 7 units at the 1000-unit scale — most of one notehead width, and
the comparison is machine-checked by `tools/check_layout.js` (§5.5).

### 6.3 Beams, stems, left hand

- **Stems**: every melody note gets one, from the note down 26 units (unchanged).
- **Beams**: consecutive plain notes form a run, broken every 3 (the 6/8 pulse), with a
  leftover single note merged into the previous group (7 eighths → 3 + 4). A long note
  ends a run. A beam is one straight stroke from the first stem end to the last.
- **Left hand**: one open oval per entry, at its top note's pitch, with the compound
  label below it. Ovals are **open** when the measure has one entry (held through the
  measure) and **filled** when it has two (moving bass) — which is exactly what
  `test.html` does.
- **Left-hand x**: entry *k* lines up under the melody note that starts beat group *k*
  (groups of three eighths), as in measures 4 and 7 of `test.html`.
- **Melody open ovals**: a long note is drawn open when its measure has no plain note at
  all (measure 7's two notes), and filled when it has any (measures 2, 4, 8) — again
  matching `test.html`.

### 6.4 Ledger lines (new, drawn in the existing style)

A note outside its staff gets short ledger strokes (18 units wide, the `staff-line`
class, so they carry the same pencil filter):

- treble above: 25, 15, 5 …; treble below: 85, 95, 105 …
- bass above: 120, 110 …; bass below: 180, 190 …

### 6.5 Label sizing (new)

Melody labels stay at 23, bass labels at 19, measure numbers at 18 — the baseline sizes.
When a measure's notes are closer together than a label is wide (the twelve-note measures
45–49, and measures 24, 37, 41, 46–48, 54), only **that measure's** labels shrink, down
to 13 if needed, and if that is still not enough they alternate between two heights.
No other measure changes size.

---

## 7. Systems, scrolling and the ruler

### 7.1 Systems taller than the standard window

A system containing a note that would push its handwritten label out of the top of the
drawing gets a taller `viewBox` (`0 -Y 1000 205+Y`) with its CSS `max-height` raised by
the same proportion, so **the music keeps exactly the same size** and the staff keeps the
same position — only empty paper appears above it. Only measures 30, 31 and 64 need this
(the systems holding measures 29–32 and 61–64). Every other system is untouched.

- **All 16 systems are drawn** — no virtual hiding, no window-height adaptation. The
  sheet scrolls; it never rescales.
- The sheet area scrolls vertically with **no visible scrollbar** (`overflow-y:auto;
  scrollbar-width:none` + `::-webkit-scrollbar{display:none}`).
- **The keyboard is fixed at the bottom** and the sheet scrolls *behind* it. To keep the
  paper look intact where the two overlap, a paper cap (a clipped copy of the same
  paper SVG, so the grain lines up exactly) sits above the sheet and below the keys.
  The scroll area gets bottom padding equal to the keyboard height, so measure 64 can be
  scrolled clear of the keys.
- **Compactness control**: one pencil-outlined icon cycling **Normal → Tight → Loose**,
  implemented purely as the CSS margin between the system SVGs — Tight is exactly the
  **2 px** you asked for. `Normal` is the default.
- **The ruler** is a ~20 px hand-drawn pencil SVG fixed down the right margin: a drawn
  body, a major tick per system, a minor tick between each pair, and a pencil-hatched
  block marking the systems currently on screen. Clicking or dragging scrolls there. It
  is drawn as an **SVG** element, not styled HTML, because the graphite filter only
  applies to SVG.

---

## 8. The keyboard

| Mode | Behaviour |
|---|---|
| **Default** | Exactly `test.html`'s keyboard: octaves 2–6 (35 white keys), same key order, same scraped-texture black keys, same labels |
| **Full 88 keys** | A0–C8 (52 white + 36 black) scaled to the screen width, for range training |

- Black-key positions use `test.html`'s formula
  `((whiteIndexBelow + 1) / whiteKeyCount) * 100 − 0.725` (%), which generalises to 88.
- Labels follow the `123 / ABC` switch, exactly as `test.html` writes them (white keys
  carry octave marks: `1`, `1'`, `1,`; black keys are bare: `#1`, `C#`). In the 88-key
  view the label size drops so five-character labels like `1,,,` still fit.
- Clicking a key plays it, highlights it, and marks the matching note on the staff.
- Active keys use `test.html`'s own active styling (graphite wash on white keys, the
  2 px drop + darkening on black keys).

---

## 9. Audio

### 9.1 One analysis path, two sources

```
source ──▶ AnalyserNode (FFT 4096) ──▶ detector ──▶ highlight / advance
```

- **Microphone**: `getUserMedia({audio:{echoCancellation:false, noiseSuppression:false,
  autoGainControl:false}})` — all three must stay off, or the browser eats the piano's
  overtones.
- **Test audio**: `flower_day.mp3` played through the same analyser, with transport
  controls and a small diagnostics readout (detected notes, target notes, match score).

### 9.2 Polyphonic detection (no ml5, no CREPE)

Frames → spectral peaks above a moving threshold → mark the peaks a lower one explains
as harmonics → fold into a 12-bin pitch-class (chroma) vector → accumulate what has been
played since the measure began → compare with the measure's pitch classes.

- Matching is by **pitch class**, so an octave slip is not punished.
- **A measure is judged as a whole and remembered.** The melody is played one note at a
  time, so each pitch class holds its strongest recent value (a level meter's peak hold,
  not an average) and is cleared outright when the page moves on. Judging a measure by
  the notes sounding *at one instant* would be wrong: by the time the last note of a
  twelve-note measure arrives, the first has stopped sounding.
- **Harmonics are quietened, not discarded.** A note played on purpose can sit exactly
  on another note's harmonic — measure 37 asks for B2 and F#4, and F#4 is B2's third
  harmonic to within a tenth of a hertz. Nothing in the sound can separate them, so the
  detector keeps what it hears: a note wrongly left out blocks a measure that was played
  correctly, which is far worse than one wrongly included.
- **The window is 8192, not 4096.** It is not a free choice: measure 12 asks for D3 and
  C#3 together, 8 Hz apart, and at 4096 (a bin every 11.7 Hz) they land in the same bin,
  so that measure can never be heard complete. `tools/check_detect.js` plays all 64
  measures through the detector and prints what each window size would cost.

**What the detector assumes.** Matching asks whether a note is present, not whether it
is the loudest, so it tolerates wrong extra notes. What it cannot tolerate is a note
played far softer than the rest: `detect.matchThreshold` (0.25) means the left hand has
to be at least about a quarter as loud as the melody. If a real piano is being heard but
not recognised, that is the first number to lower.

### 9.3 Sound

- Notes are played from the 88 samples in `piano-mp3/`, loaded lazily and cached; a
  synthesised tone covers anything the samples do not.
- Timing comes from the derived durations: `♩. = 50` → a dotted quarter is 1.2 s, so an
  eighth is **0.4 s** — used for "play this measure" and for the note-by-note highlight
  during playback.

---

## 10. The two modes

### 10.1 Learning Mode (microphone on)

- The current measure is shaded with the graphite smudge and its notes and keys are
  highlighted.
- The highlight advances when the measure's target pitches have been heard.
- Clicking any measure jumps straight there.
- Progress reads `Measure N / 64`.
- The sheet scrolls only when the target measure is off screen, so the page does not
  jump on every advance.

### 10.2 Listening Mode (microphone off)

- Clicking a measure opens a small pencil-styled bubble with two choices:
  1. **Play just this measure**
  2. **Play from this measure to the end**
- The staff and keyboard highlights follow the playback; transport controls sit in the
  top bar.

---

## 11. Controls

| Control | Kind | Function |
|---|---|---|
| Title + subtitle | text | `꽃날 (Flower Day)` — 드라마 '황진이' OST, and `♩. = 50 • 6/8` |
| `123 / ABC` | pill switch | Switches every annotation: staff labels and key labels |
| Microphone | outline icon | Learning Mode on/off (also the Listening Mode switch) |
| Reset | outline icon | Back to measure 1, clear all state |
| Compactness | outline icon | Cycle Normal → Tight → Loose |
| Keyboard range | outline icon ×2 | Default octaves 2–6 / full 88 keys |
| Transport | outline icons | Play / pause / stop (Listening Mode) |
| Test audio | panel | Load the MP3, scrub, toggle the diagnostics display |

All icons are clean outline strokes on a transparent background with a hand-drawn pencil
border, matching `test.html`.

---

## 12. Phases

| Phase | Content | Acceptance |
|---|---|---|
| **1** Score | Data layer (build + check tools, loader, notation modules), layout engine, all 16 systems, scrolling, ruler, compactness, `123/ABC` | The page opens from disk and from localhost; all 64 measures draw; measures 1–8 sit where `test.html` puts them; the toggle and the three gaps work |
| **2** Keyboard | `keyboard-render.js`, both ranges, scraped black keys, labels, click-to-play | Both icons switch range; the 88-key view fills the width; labels follow the toggle |
| **3** Audio | `audio-engine.js`, `pitch-detect.js`, `piano-sound.js`, MP3 through the analyser, diagnostics | Playing the MP3 shows detected notes matching the target measure |
| **4** Modes | `practice.js`, `playback.js`, mic judging, measure jumping, the bubble menu | Playing correctly on a real piano advances the highlight; clicking a measure jumps there; both playback choices work |
| **5** Polish | Tuning, performance, edge cases, usage notes in the README | Thirty minutes of practice without a glitch or a false pass |

---

## 13. Decisions

### 13.1 Confirmed 2026-10-14 (this round)

| # | Question | **Decision** |
|---|---|---|
| Q1 | Layout of busy measures (9–12 notes) | **Keep `test.html`'s exact bar widths in every system.** Only the crowded measures' labels shrink (§6.5). No bar line ever moves |
| Q2 | Is `123` fixed-do or movable-do? | **Fixed-do — 1 = C in every key**, matching the JSON's own labels and `test.html`'s keyboard (§5.3) |
| Q3 | What must be played in Learning Mode? | **The melody and the left hand** — every target pitch in the measure, bass chord included |
| Q4 | Very high notes (D6/E6/A6 in measures 30, 31, 64) | **Those systems' drawing window grows upward** (§7.1); the music keeps its size and the other systems are untouched |

### 13.2 Carried over from the previous round

What counts as "played correctly" is judged **per measure**; clicking a measure opens a
**bubble menu**; the page plays the **`piano-mp3` samples**; in MP3 test mode the score
advances **only when notes are actually detected**; progress reads `Measure N / 64`; the
sheet scrolls only when the target measure is off screen; the interface is English only.

---

## 14. Changelog

- **2026-10-14** v1.0 — rewritten from scratch against `test.html` as the frozen visual
  baseline, after the previous attempt (git `f5cfb00`) was rejected and removed. Records
  the layout engine that replaces `test.html`'s hand-placed coordinates, the fixed-do
  correction to the `123` notation, the derived-duration rules, and the two unavoidable
  new drawing elements (ledger lines, per-measure label sizing).
- **2026-10-14** v1.1 — the four open questions answered (§13); the layout calibrated
  against `test.html`; phases 1 and 2 built (below).

### Phases 1 and 2 complete — the score and the keyboard (2026-10-14)

Built: the file layout of §4; the data layer (build script, loader, both notation
modules, pitch helpers); the layout engine; all sixteen systems; the scrolling sheet
with the paper cap behind the fixed keyboard; the pencil ruler; the compactness cycle;
the notation switch; and the keyboard in both ranges.

**What the checks say**

- `check_score.js`: **no unresolved problem in 64 measures**. One fault found and
  settled — measure 1's bass notation is missing its octave commas (§5.5).
- `check_layout.js`: the melody's **vertical position is exact** (0 units of difference
  on every measured note) and its **horizontal position is within 8 units of 1000**
  everywhere except one note, where it is 16 — test.html's two-note measure 7, which is
  hand-placed off-centre. A notehead is 12.4 units wide.
- `check_render.js`: the page builds headless with 16 systems, 160 staff lines, 80
  barlines, 111 beams, 64 smudges, 457 noteheads and 521 handwritten labels; every
  control was driven without an error.

**Decisions taken while building, and why**

1. **A long note is spaced at twice an eighth, not three times.** Its real length is
   three eighths, but test.html gives it about twice the room; the spacing follows
   test.html while the beaming and left-hand alignment follow the music
   (`dottedSpacing` and `dottedUnits` in `config.js`).
2. **Beams group in threes with a lone leftover joining the group before it** — which
   reproduces test.html's beaming in measures 2, 4, 6 and 8 exactly. In measures 1 and 3
   test.html breaks its seven eighths 4 + 3 where the engine breaks them 3 + 4; the beam
   covers the same seven notes either way.
3. **The busiest measures' labels shrink; nothing else moves.** Bar lines stay exactly
   where test.html has them in every system (Q1).
4. **A system grows upward only when it has to** — measures 29–32 (+30 units) and
   61–64 (+45), plus a bare 5 units for measures 45–48 where one label reaches the top
   of the window. The other systems keep test.html's window exactly (Q4).
5. **The keyboard's second button shows the full A0–C8**, 52 white and 36 black keys,
   with the labels shrunk so five-character marks like `1,,,` still fit.

### Phases 3 and 4 complete — the listener and the two modes (2026-10-14)

Built: `audio-engine.js` (microphone and test recording into one analyser),
`pitch-detect.js` (peaks, harmonics, chroma, matching), `piano-sound.js` (the 88
samples, with a synthesised tone for anything they cannot reach), `practice.js`
(Learning Mode) and `playback.js` (Listening Mode), plus the measure menu, the transport
and the listening panel.

**What the checks say**

- `check_detect.js`: single notes are named correctly from E2 to E6; the E3/B2 chord of
  measure 1 comes back as exactly `B2 E3`; a low C does **not** also report the G a
  fifth above, while a real G played above it **is** heard; the wrong notes do not pass a
  measure. Then the test that matters: **all 64 measures, played as written — melody one
  note at a time over the held bass chord, frames arriving twenty times a second — are
  heard complete**, at FFT 8192 and at 16384. At 4096 measure 12 fails.
- `check_render.js`: the whole page runs headless and the listening path is exercised
  end to end with a synthesised spectrum — click a measure and the menu opens, play from
  it and the transport follows, turn the microphone on and **playing measure 1 correctly
  advances the page to measure 2**, while holding the notes that are already ringing does
  not advance it, and playing measure 2 advances again.

**Decisions taken while building, and why**

1. **FFT 8192 instead of the 4096 first asked for** — the reason is in §9.2, and it is
   measured rather than guessed: 4096 cannot separate the two notes of measure 12's bass
   chord. The cost is a 171 ms window, which at this tempo is not noticeable.
2. **The measure is remembered, not sampled** — see §9.2. This was found by testing:
   judging each frame on its own failed 33 of the 64 measures.
3. **Harmonics are quietened rather than removed** — see §9.2. This was found by testing
   too: removing them made measure 37 impossible to pass.
4. **Pause replays the measure it stopped in.** Nothing is scheduled more than a bar
   ahead, so stopping is immediate; resuming starts that bar again rather than trying to
   land mid-bar.
5. **The test recording only plays over `http://localhost`.** A page opened from disk
   cannot feed a local file through the Web Audio graph — the browser refuses it — and
   the panel says so when it happens. Everything else works from disk.

**Known limits, recorded rather than hidden**

- Two notes a semitone apart in the bottom octave are beyond any window this size, so
  the bass is heard by its third and fifth harmonics as much as by its fundamental.
- The left hand has to be played at least about a quarter as loud as the melody (§9.2).
- Playing back a measure schedules the notes at the score's own note values, which are
  reconstructed from the notation (§5.4) — the timing is musically right but not
  identical to the recording.

### Phase 5 — polish (not started)

Tuning on a real piano, performance, and the usage notes in `README.md`.

### The full arrangement — the machinery (2026-10-14)

Built, in `score-loader.js`, `layout.js` and `sheet-render.js`:

1. **A left hand that changes clef.** `lhClef` per measure, carried over until it
   changes; the bottom staff's clef at the head of every system follows the first measure
   of that system; key-signature sharps are drawn on the proper lines for whichever clef
   the staff is in; and a smaller cue clef is drawn at the end of the measure before a
   change, as the reference score does. The same written pitch now lands on a different
   line depending on the clef — E4 is the bottom line of a treble bottom staff and sits
   two ledger lines above a bass one.
2. **Chords.** A beat holds one or more notes, drawn on their own staff steps sharing a
   single stem, with the label showing the whole stack where there is room and the top
   note where there is not.
3. **Moving left-hand accompaniments.** The left hand is on the same time axis as the
   melody, so its eighth notes line up under the melody's beats, carry their own stems and
   are beamed in threes.
4. **Double and triple beams, grace notes, rests, ties, 8va and mid-score time changes.**
   A run of sixteenths gets a second stroke under the beam, thirty-seconds a third, and a
   lone short note gets a stub rather than a full stroke; grace notes are smaller heads
   with a slash; rests are a pencil squiggle; a tie is one pencil arc; an 8va measure gets
   its dashed line and label; `3/8` and `6/8` are drawn on the staves where they change.

**Two deliberate changes to how the old measures look**

- **Bass chords are now drawn as real chords.** Where an entry like `3,/1,/6,,` used to
  be one open oval with a compound label under it, the three noteheads are now stacked on
  their own steps — which is what the reference score does, and what upgrade 2 asks for.
  The open-oval style stays for a chord *held* through the bar.
- **The key signature is now drawn on both staves**, each on the lines its own clef gives
  it. `test.html` draws it on the treble staff only; the reference score draws it on both.

**Verified** — `tools/check_arrangement.js` (new) checks every one of the above against
`tools/arrangement-sample.json`, a six-measure fixture written in the new shape, and
`tools/check_render.js` renders that fixture headless and counts what came out: 64
noteheads, 49 stems, 20 beams of which 9 are second and third strokes, 1 tie, 1 rest, 1
grace slash, 1 cue clef, 8 time-signature figures and 1 8va line. The 64 real measures
still lay out exactly where they did before — `check_layout.js` reports the same
positions and the same worst difference.

### The full transcription arrives (2026-10-14)

`music-sheet/flower_day.json` is now the full arrangement: **64 measures, 985 notes**,
with the left hand changing clef exactly where the reference score does (23 measures in
treble, 41 in bass, six cue clefs) — all three spellings of every note agree, every note
is inside the piano, and **all 64 measures are heard complete** by the detector.

Three things had to change to draw it, all found by looking at what the new density did:

1. **Labels step between heights rather than shrink.** The first run shrank the writing
   to its 12-unit floor in 57 of 64 measures. Every other label now rises (or drops,
   under the bass) instead, which doubles the room each has; only if that is still not
   enough does the writing get smaller. That left 33 measures shrinking and 54 stepping.
2. **The handwriting is measured per notation system.** "7" and "B4" are not the same
   width, and sizing for the longer one shrank the sheet for no reason in the other. Each
   measure now keeps both plans, and the switch swaps text, size and height together — so
   in a tight bar the 123 label can read `5/7` while the ABC label reads `B4`.
3. **A system's window grows downward as well as up.** A bass note written far below its
   staff takes its stem and its label with it; the window grows to hold them rather than
   letting them run into the system underneath.

**What the transcription still needs, from the player rather than from code.** Two
reports in `check_score.js` point at places to check against the printed score — both are
for a human to decide, and neither has been changed here:

- **24 measures whose melody is one eighth short of the bar** (measure 1 and its
  relatives, and the 3/8 bar). The bass fills every one of them. A pickup does not fill
  its bar, so this may be right — but the same one-eighth gap in twenty-four bars is more
  likely the last note of each of them.
- **18 left-hand notes written more than four staff steps from their staff**, in measures
  12, 14, 30, 33, 34, 35, 36, 58, 59, 60, 61 and 63. The clearest are measure 36's `6,,`
  (A2, eleven steps below a treble staff) and measure 63's `7,,` (B2, ten steps below) —
  both are bass-register notes in bars whose clef is treble. Three or four ledger lines is
  ordinary for this arrangement; five or more usually means a clef or an octave was
  written against the wrong bar.
- The reference score is described as having **65 bars**, with the last system running
  from measure 60 to 65; the file has **64**. Worth a look at the final page.

### Playback repaired, and the score corrected (2026-10-15)

Playing a measure made no sound. Three faults in `playback.js`, all left over from the
move to 64th-note units and note objects:

1. **Note objects were passed where MIDI numbers were wanted.** `event.notes` became an
   array of `{ num, let, midi, … }`, and `Sound.play` was still being handed the objects,
   which failed the pitch check and returned in silence.
2. **Units were used as if they were eighths.** A note length is counted in sixty-fourths,
   so multiplying by `eighthSeconds` made every note eight times too long — a 6/8 bar
   would have taken 19.2 seconds.
3. **The bass was still placed by `beatIndex`**, which the layout stopped producing, so
   every bass note was stacked at the barline and held for half a bar.

All three are fixed in one place, and the left hand is now placed exactly like the right:
from the beat's own position on the time axis, at its sounding pitch (an octave up under
an 8va), with rests silent and grace notes leaning in 0.08 s ahead of their beat. A bar's
length comes from its time signature rather than from how many notes were written in it,
so playback keeps a steady pulse even where the transcription is short.

**The check that would have caught all three** now runs in `check_render.js`, which plays
measure 3 through the real menu and reads the audio clock: **10 of 10 notes scheduled**,
the first at 0.12 s, the last at 2.12 s, the bar 2.40 s long, the shortest gap between
notes 0.200 s. Measure 30 is played back with **every note sounding exactly an octave
above what is written**, and a parked audio context is confirmed to be resumed.

**The corrected score.** The octave and rhythm corrections landed: **65 measures instead
of 64** (the reference score's last bar is now there), 990 notes all agreeing across the
three spellings, the bar-length report down from **24 short measures to 2** (measures 24
and 41, each an eighth short in the melody), and the stranded-note report from **18 to
none** — every left-hand note now sits within four steps of its staff, so the tall
systems that those notes forced have shrunk back with them.

### The transcription was not done here, and could not be honestly

**`flower_day.json` is still the simplified score.** Reading the notes off
`music-sheet/flower_day.pdf` is the one part of this that was not delivered, and the
reason is recorded here rather than hidden:

At the resolution a page of that PDF can be read at, the *shape* of the music is legible
— where the chords are, where the runs are, the clef changes, the 8va, the dynamics — but
individual pitches are not: which line or space a notehead sits on, its accidental, and
its exact rhythmic value cannot be read reliably across 65 dense measures. Writing them
down anyway would produce data that looks authoritative and is partly wrong, and nothing
in the tooling could tell which parts: the checks compare the number notation, the letter
name and the MIDI number against *each other*, so a note misread once is written down
wrongly three times in agreement. The cost of that is not cosmetic — practice mode cannot
leave a measure it cannot hear, which is exactly what measure 12's D3/C#3 did before the
window size was changed.

What would settle it, in order of preference:

1. **The source file the PDF was made from** — MusicXML, MIDI or a MuseScore `.mscz`. It
   carries every pitch, length, tie and clef exactly, and the conversion to this format
   would be a script, not a reading.
2. **Higher-resolution images** — the page rendered at 300–600 dpi and *cropped by
   system*, since a whole page is downscaled again on the way in while a system-sized
   crop is not.
3. **Measure-by-measure review** — a best-effort pass that the player checks against the
   PDF, one system at a time. Slow, and only worth it if the first two are impossible.

The machinery above is already built for whichever of those happens: the new format is
what a converter would emit, and `tools/arrangement-sample.json` shows the shape.
