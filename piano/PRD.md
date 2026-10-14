# PRD — Piano Listener & Trainer

> This file is the specification and changelog for `projection/piano/`.
> After each phase, add a "Phase N complete" entry at the bottom and commit + push.

- Drafted: 2026-10-13
- Status: **requirements confirmed (v0.2) — implementation under way**
- User: the author (no coding background; practises on a real 88-key piano with a
  computer and a microphone)

---

## 1. Goal

A **single web page** that turns a computer (screen + microphone) into three things:

1. **Read the score** — draw the 64 measures of `music-sheet/flower_day.json` in a
   flat 2D "pencil on coarse watercolour paper" style.
2. **Listen** — detect pitches with the Web Audio API **polyphonically**, i.e. hear
   a chord and a melody at the same time, not one note at a time.
3. **Practise** — in Learning Mode the page highlights the notes to play and moves
   on as you play them correctly; in Listening Mode, clicking any measure lets you
   hear that measure on its own or play from there to the end of the piece.

---

## 2. Starting point (what already existed)

| Path | What it is | How it is used |
|---|---|---|
| `piano/test.html` | Visual baseline (one self-contained HTML file), measures 1–8 only | **Reference only — never modified.** The new app is built separately |
| `piano/music-sheet/flower_day.json` | The score (64 measures) | The single source of truth for the new app; read-only |
| `piano/test-music/flower_day.mp3` | Test recording | Drives "test audio" mode to verify the detector |
| `piano/piano-mp3/*.mp3` | 88 piano samples (A0–C8, ~10 KB each, already in git history) | Playback sound source (see §7.3) |
| `piano/pitch-detection/crepe/` | An old ml5 CREPE model (**monophonic**) | **Not used.** CREPE cannot hear chords |
| `note_detector.html`, `piano.html`, `script.js` in git history | An earlier prototype (ml5 + Font Awesome) | Abandoned, not carried over |

**Conclusion:** the new app was written from scratch, reusing only `flower_day.json`,
`flower_day.mp3` and the piano samples.

---

## 3. File layout (HTML / CSS / JS strictly separated)

```
piano/
├─ index.html                 # structure and <script> tags only — no styling, no logic
├─ styles/
│  ├─ theme.css               # paper, graphite, type, the paper-grain filter
│  ├─ layout.css              # top bar / sheet / keyboard, responsiveness, density
│  └─ components.css          # icon buttons, staff elements, keys, popovers
├─ js/
│  ├─ config.js               # every tunable number (colours live in CSS)
│  ├─ pitch-utils.js          # MIDI ↔ name ↔ frequency, octaves, pitch classes
│  ├─ notes-letter.js         # LETTER notation mapping (ABC)
│  ├─ notes-number.js         # NUMBER notation mapping (123 / Jianpu)
│  ├─ staff-utils.js          # pitch → position on the treble/bass staff
│  ├─ glyphs-bravura.js       # generated musical glyph outlines
│  ├─ score-loader.js         # source JSON → score model
│  ├─ sheet-render.js         # draws the systems
│  ├─ keyboard-render.js      # the piano keyboard                (phase 2)
│  ├─ audio-engine.js         # microphone / test-audio capture   (phase 3)
│  ├─ pitch-detect.js         # polyphonic detection              (phase 3)
│  ├─ piano-sound.js          # playback samples + synth fallback (phase 3)
│  ├─ practice.js             # learning-mode state machine       (phase 4)
│  ├─ playback.js             # listening mode                    (phase 4)
│  └─ app.js                  # wiring: controls, resize, redraw
├─ music-sheet/flower_day.json   # the score, hand-editable
├─ music-sheet/flower-day.js     # generated from the JSON (see tools/)
├─ test-music/flower_day.mp3
├─ piano-mp3/*.mp3
├─ tools/                     # build and check scripts, not shipped to the browser
└─ PRD.md                     # this file
```

**Technical constraints (important)**

- Scripts are loaded as **classic `<script>` tags with a `window.App.*` namespace**,
  not ES modules, so `index.html` also works when opened directly from disk.
- The score is loaded from `music-sheet/flower-day.js`, a generated file that assigns
  a global. This exists because browsers refuse to `fetch()` a local `.json` file when
  the page is opened from `file://`. Regenerate it with `tools/build_score.py` after
  editing the JSON.
- The dev server (already installed: Python 3.11):
  `cd projection/piano` → `python -m http.server 8080` → <http://localhost:8080/>

---

## 4. Visual theme

### 4.1 Paper: brighter, warmer coarse stock

| Token | Old value | **New value** |
|---|---|---|
| `--paper-base` | `#ece6da` | **`#f8f4ea`** |
| lighting colour in the filter | `#f2ece1` | **`#fdfaf3`** |
| `--graphite-2b` | `#282624` | `#312d29` |
| `--graphite-hb` | `#595550` | `#655f57` |
| `--graphite-faint` | `#8c867e` | `#9a938a` |
| paper layer opacity | 0.78 | **0.58** |

The `feTurbulence` + `feDiffuseLighting` bump-lit grain is kept exactly as it was —
that grain is what makes the paper read as coarse cold-press stock.

### 4.2 Icons: outline only, transparent, pencil ring

- **Line-only glyphs**: no filled shapes.
- **Completely transparent background**: no tinted circle behind the icon.
- The ring around each button is drawn with a **hand-drawn pencil wobble** (a small
  `feDisplacementMap`), while the glyph inside stays clean and geometric so the
  buttons never look lopsided.
- Active states use graphite weight and colour, not a solid block.
- Buttons: `123 / ABC`, microphone, reset, staff spacing, and (phase 2) the two
  keyboard-range buttons.

---

## 5. The score area

### 5.1 Systems per screen and the spacing control

- The music is drawn at a **fixed on-screen size** — one staff space is always the
  same number of pixels — and the **number of systems** adapts to the window height.
  The music is never shrunk to fit more lines in.
- Two systems' worth of headroom is the minimum; a window that cannot show two
  systems shrinks the music, but never below `minScale`.
- **Staff-spacing control**: one icon that cycles `normal → tight → loose`. Tight
  packs more (smaller gaps), loose gives the music more air. The button carries a
  small `N`/`T`/`L` badge showing the current setting.
  *(The draft asked for two buttons, but loose/tight/normal are three states of one
  setting — two buttons cannot express "neither".)*
- Margins are generous: the score sits on the paper rather than running to its edge.

### 5.2 The symbols at the left of each system

The reference used Unicode characters (`𝄞 𝄢 ♯`), which render differently on every
machine and are often missing entirely. The new app draws **real engraved outlines**
taken from the Bravura music font (see `NOTICE-BRAVURA.md`):

| Symbol | Requirement |
|---|---|
| Grand-staff brace `{` | A single curly brace spanning both staves, correctly proportioned, never clipped at the page edge |
| Treble clef | Spiral centred on the G line (2nd line of the treble staff) |
| Bass clef | The two dots straddle the F line (4th line of the bass staff) |
| Key signature ♯ | **1#** (G major / E minor): F♯ on the top line of the treble staff and the 4th line of the bass staff. **3#** (A major / F♯ minor): F♯ → C♯ → G♯ in circle-of-fifths order, each on its proper line or space |
| Time signature | Numerator over denominator, centred between the staves |

- Key and time signatures repeat at the start of every system, and are redrawn
  mid-system wherever the score changes them (measure 42 changes key; measures 32–33
  change time signature and back).
- Notes: tilted noteheads, stems, beams and ledger lines, all with the graphite
  texture; the measure being practised is shaded with a graphite smudge.

### 5.3 Annotations and the 123 / ABC switch

- Each note carries a handwritten label (above the melody, below the bass) in the
  `Caveat` hand.
- The `123 / ABC` toggle switches **every** annotation at once — on the staff and,
  from phase 2, on the keyboard as well.
- The two notation systems live in separate modules and never import each other.
  Both derive their spelling from the key signature, so they always agree:

**Number notation (Jianpu)** — `1` is the key's tonic, so it means C in C major and
C♯ in A major. Octave marks: `1` = middle C, `1'` = the C above, `1,` = the C below.
Accidentals are written before the degree: `#4` is a raised 4th, `♮4` a natural 4th.

**Letter notation** — `C D E F G A B` with `♯` / `♮` / `♭` as needed and an octave
number, so middle C is `C4`.

### 5.4 How the source JSON is read

```jsonc
{
  "meta": { "title": "꽃날 (Flower Day)", "timeSignature": "6/8", "tempoDottedQuarter": 50 },
  "measures": [
    { "m": 1, "key": "1#",
      "rh": [["7","B4",71], ["7","B4",71], ...],   // [number, letter, MIDI]
      "lh": ["3/7,", "E3/B2", 52] },               // 2 or 3 elements, see below
    ...
  ]
}
```

`score-loader.js` normalises all of this into one clean model:

1. `rh` entries are `[number, letter, MIDI]` triples.
2. `lh` entries are **irregular** — sometimes `["3/7,", "E3/B2", 52]`, sometimes
   `["2,/7,,", "#1,/6,,", 50]`. Rule: the notation string is first, the MIDI number
   last, and the middle element is only present sometimes. A packed chord
   (`"3,/1,/6,,"`) is split into its individual notes.
3. `key` and `time` carry over from the previous measure until the score changes them.

> **Known data limitation.** The JSON records pitch only — there is no duration data.
> Rhythm is therefore reconstructed: note spacing follows the reference engraving's
> proportions, and advancement in practice mode is **per measure**, which does not
> depend on note values.

---

## 6. The piano keyboard (phase 2)

| Mode | Behaviour |
|---|---|
| **Screen-adaptive (default)** | The octave range follows the window width (about 200 px per octave). On a 2K window this shows octaves 2–6, centred on middle C |
| **Full 88 keys** | The whole keyboard, A0–C8, scaled to fit the width |

- White keys outlined in pencil; black keys filled with a **dense diagonal
  pencil-scraped texture** generated on a canvas (several variants so neighbouring
  keys differ).
- Key labels follow the `123 / ABC` toggle.
- Clicking a key plays it and highlights the matching note on the staff.

---

## 7. Audio

### 7.1 Two sources, one analysis pipeline

1. **Microphone** for live practice:
   `getUserMedia({audio: {echoCancellation:false, noiseSuppression:false, autoGainControl:false}})`
   — these three must be off, or the browser eats the piano's overtones.
2. **Test audio** (`test-music/flower_day.mp3`) played through an
   `AudioBufferSourceNode` into the **same** `AnalyserNode`, so the detector can be
   tested without a piano. Includes transport controls and a diagnostics panel
   showing the detected notes and the match score.

### 7.2 Polyphonic detection

```
audio → AnalyserNode (FFT 4096)
      → smooth across frames
      → pick spectral peaks (local maxima above a moving threshold)
      → discard peaks that are harmonics of a lower peak
      → fold into a 12-bin pitch-class (chroma) vector
      → compare with the target measure's pitch classes
      → N consecutive frames above threshold ⇒ "correct"
```

- Matching is by **pitch class**, not exact pitch, so an octave slip on a real piano
  is not punished.
- Every threshold lives in `config.js`; a live 12-bar chroma display is available for
  tuning.
- No external library, and specifically not ml5/CREPE — that model is monophonic.

### 7.3 Playback sound

- Primary source: the 88 samples in `piano-mp3/`, preloaded and cached as
  `AudioBuffer`s on first interaction.
- Fallback: a synthesised tone for any pitch the samples do not cover.

---

## 8. The two modes

### 8.1 Learning mode (microphone on)

- The notes to play are highlighted on the staff and on the keyboard.
- **Judging is per measure**: when every target pitch of the measure has been heard
  — the melody *and* every note of the left-hand chord — the highlight advances.
- Playing nothing, or playing wrong notes, simply waits.
- Clicking any measure jumps there immediately and practice continues from that spot.
- Progress is shown as `Measure N / 64`.

### 8.2 Listening mode (microphone off)

- Clicking a measure opens a small bubble menu with two choices:
  1. **Play this measure only.**
  2. **Play from here to the end.**
- The staff and keyboard highlights follow the playback, and the sheet scrolls.
- Transport controls (play / pause / stop) live in the top bar.

### 8.3 Scrolling rules

- During practice the sheet scrolls **only when the target measure is off screen**,
  so the page does not jump on every advance.
- Clicking a measure scrolls it into view straight away.

---

## 9. Controls

| Control | Kind | Function |
|---|---|---|
| Title + subtitle | text | From `meta` |
| `123 / ABC` | pill switch | Switch all annotations |
| Microphone | outline icon | Toggle learning mode / listening mode |
| Reset | outline icon | Back to measure 1, clear all state |
| Staff spacing | outline icon | Cycle normal → tight → loose (badge shows which) |
| Keyboard range | outline icon ×2 | Screen-adaptive (default) / full 88 keys — phase 2 |
| Transport | outline icons | Play / pause / stop — phase 4 |
| Test audio | panel | Load the MP3, scrub, toggle the diagnostics display — phase 3 |

---

## 10. Phases

| Phase | Content | Acceptance |
|---|---|---|
| **1** Score rendering | Page skeleton, theme, all 64 measures, symbols, notation toggle, adaptive systems, density control | The whole score draws correctly; 123/ABC switch works; the density control visibly changes the layout |
| **2** Keyboard | `keyboard-render.js`, both range modes, scraped black keys, labels follow the notation toggle | The two icons switch range; a 2K window shows octaves 2–6 by default |
| **3** Audio engine | `audio-engine.js`, `pitch-detect.js`, `piano-sound.js`, MP3 through the analyser, diagnostics | Playing the MP3 shows the detected notes matching the target measure |
| **4** The two modes | `practice.js`, `playback.js`, mic judging, measure jumping, the two playback choices | Playing correctly on a real piano advances the highlight; clicking any measure jumps there |
| **5** Polish | Tuning, performance, edge cases, usage docs | Thirty minutes of practice without a glitch or a false pass |

---

## 11. Decisions (confirmed 2026-10-13)

| # | Question | **Decision** |
|---|---|---|
| Q1 | What counts as "played correctly"? | **Per measure** — every target pitch class in the measure, including all left-hand chord notes |
| Q2 | How does clicking a measure offer the two playback choices? | **A small bubble menu** with two buttons |
| Q3 | What sound does the page play? | **The existing `piano-mp3/` samples**, with a synthesised fallback |
| Q4 | How does the score advance in MP3 test mode? | **Only when notes are actually detected**, so the result reflects the detector's real accuracy |

---

## 12. Changelog

- **2026-10-13** v0.1 — first draft (requirements, inventory, open questions).
- **2026-10-13** v0.2 — requirements confirmed (Q1–Q4 above). Frozen; implementation began.

### Phase 1 complete — score rendering (2026-10-13, commit `dd15a61`)

**Delivered**

- The file layout of §3, with HTML, CSS and JS strictly separated and loaded as
  classic scripts so the page opens from disk.
- All 64 measures drawn, 4 per system across 16 systems: brace, both clefs, key
  signatures (1#, and 3# after measure 42), time signatures (6/8, plus the 3/8 bar
  at measure 32), barlines, beams, ledger lines and handwritten annotations.
- The `123 / ABC` notation toggle, backed by two independent mapping modules that
  each derive their spelling from the key signature.
- Systems adapt to window height; the sheet scrolls, drawing only the systems on
  screen so the DOM stays small.
- Brighter paper (`#f8f4ea`) with the coarse grain preserved; controls reduced to
  outline glyphs on a transparent background with a hand-drawn pencil ring.

**Deviations from the draft, and why**

1. **Symbols are Bravura SMuFL outlines**, not the Unicode characters `𝄞 𝄢 ♯`.
   Those code points are missing from most system fonts and cannot be positioned
   precisely. The outlines come from `tools/extract_bravura_glyphs.py`; the font is
   OFL-licensed (see `NOTICE-BRAVURA.md`).
2. **The music is drawn at a fixed size and the system count adapts**, rather than
   shrinking the music to fit more lines. Notes stay equally legible on every screen.
3. **The sheet scrolls** through all 16 systems, rendering only the visible ones.
4. **One cycling icon for staff spacing** instead of two buttons — see §5.1.
5. **`test.html` is untouched.** It remains in the repository as the visual
   reference, but nothing in the new page loads it.

### Phase 1 revisions (2026-10-13)

Requested after reviewing phase 1:

- **All text is English.** The interface, the code comments and the documentation.
  (The score's own title and subtitle stay as they are — they are the song's name.)
- **More room around the score**: margins widened by a fifth and the page padding
  above and below the systems increased, so the music sits on the paper rather than
  running to its edge.
- **Fixed a cut-off at the left edge**: the grand-staff brace used to start left of
  the drawing's origin and was clipped. Everything now sits inside the page.
- **Fixed the time signature colliding with the first notes**: the header block
  (brace, clefs, key signature, time signature) was repacked and the music now
  starts clear of it — about two note-widths of clearance in the leftmost measure.
- **Fixed the active-measure shading** covering the notes instead of sitting behind
  them.

**Verified:** `node tools/check-model.js` clean; screenshots at 2K and 1600×900; the
notation toggle, all three densities, and jumping to measure 42 (which scrolls across
systems) all checked.

### Phase 1 revisions 2 — size matched to the reference (2026-10-13)

The score's size was still not right. It now reproduces `test.html` exactly, and the
default view shows two systems.

**Where the size is controlled** — three places, and nothing else:

| What | File | Setting |
|---|---|---|
| **Overall size of the score** (this is the one to turn) | `js/config.js` | `layout.maxSystemWidth` — the score is 1000 drawing units wide, so 1360 px makes one unit 1.36 px and the staff space 13.6 px, matching the reference. Only a *narrower* window shrinks it |
| **The drawing's own proportions** | `js/config.js` | `sheet.staff.space` (10 units per staff space), `sheet.staff.marginLeft` / `marginRight` (where the staff lines start and end horizontally), `sheet.staff.trebleTop` / `bassTop` (their vertical position), `sheet.viewBox` (the drawing's coordinate window) |
| **Where the header sits** | `js/config.js` | `sheet.header.*` — the brace, clefs, key signature and time signature x-positions |
| **Vertical spacing** | `js/config.js` | `layout.pagePaddingTop`, `layout.pagePaddingBottom` (margins at the top and bottom of the page) and `layout.density.*.systemGapPx` (the air between two systems) — all plain CSS pixels. They change the *spacing*, never the size of the music |
| **How the box is placed on the page** | `styles/layout.css` | `.sheet-area` (scrolls), `.sheet-canvas` (full-song spacer), `.system-svg` (centred fixed-width box) |

**Changes**

- The drawing now matches the reference's proportions: the music spans x=12 to x=985
  of the 1000-unit window, so a measure is 224 units — visually the same density as
  the reference's 241.
- The staff space is 13.6 px and the staff is 54 px tall, exactly as in `test.html`.
- **Default view is two systems**, as in the reference.
- The score is centred by moving the SVG box (`margin: 0 auto`) rather than by sliding
  the viewBox. Keeping the two mechanisms separate removed a double-offset bug that
  pushed the music off to the right.

**Verified:** screenshots at 2K (two systems, centred) and 1600×900; hit-testing
re-checked — clicking across a system returns measures 1, 2, 3, 4 in order.

### Phase 1 revisions 3 — spacing in pixels (2026-10-13)

The spacing was expressed as a fraction of a system's height, which made it awkward
to reason about. All three vertical distances are now plain CSS pixels in
`js/config.js`:

| Setting | Controls |
|---|---|
| `layout.pagePaddingTop` | The air above the first system — the one to raise to push the score down the page |
| `layout.pagePaddingBottom` | The air below the last system |
| `layout.density.tight/normal/loose.systemGapPx` | The air between two systems, for each setting the spacing button cycles through |

The value is **exact**, not a minimum. Two things make that possible:

1. The drawing band a system occupies *is* the ink band — the SVG shows only
   `inkTop .. inkBottom` of the drawing, so a system carries no empty margin that
   could leak into the spacing.
2. Height left over at the bottom of the scroll range stays blank instead of being
   shared out into the gaps.

The gap is measured between the two drawing bands; a couple of pixels of a text
line box (the written labels, the measure numbers) fall outside its band, so the
visible gap runs about 0.7 px narrower than the configured value. `tight` is set to
2.7 for that reason and renders as 2 px on screen.

### Phase 1 revisions 4 — scrolling without a scrollbar (2026-10-13)

The score is 16 systems tall, far more than any window shows, so the sheet scrolls.
The scrollbar itself is hidden (`scrollbar-width: none` and a `::-webkit-scrollbar`
rule) because it would sit on the paper and break the drawn look.

Position is instead carried by two quiet cues:

- **A position ruler** down the right margin: one tick per system, placed by where
  that system actually is in the whole piece, so the marks slide as you scroll. The
  systems on screen are inked darker. It is `position: fixed`, so it stays put while
  the sheet moves behind it.
- **The status line** below the keyboard, which names the measures on screen —
  `Measures 37–40 of 64 · practising measure 12` — falling back to the plain
  `Measure 12 / 64` once the whole piece is visible at once.

The scroll spacer now covers the *whole* score rather than only the systems that
fit, which is what gives the area something to scroll through. Only the systems on
screen are drawn, so the DOM stays small.
