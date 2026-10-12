# PRD — bucket / `music.html`

A single-page music player built over the **Mr. Sad Sick** 3D scene. The page
reuses the 3D stage from `index.html` and lifts *only* the song wheel, progress
bar and line visualizer out of `../music/`, re-stitched into a Spotify-style
centre layout.

**Status:** Phase 3 — the cluster moved down onto the chest at 80%, the
visualizer doubled its bar count at a lower amplitude, the song wheel is now
bi-directionally synced with the transport, and the background gradient follows
the cursor.

---

## 1. How to run

Static page, no build step. It **must be served over http** — `model-viewer`
fetches the `.glb` with `fetch()`, which browsers block on `file://`, and
`mediaElementSource` needs a real origin:

- VS Code: right-click `music.html` → **Open with Live Server**
- or `python -m http.server` from this folder, then open `/music.html`

Needs internet for two things: the `model-viewer` script (same CDN as
`index.html`) and the `Patrick Hand` font.

Files used:

| Path | Role |
|---|---|
| `music.html` | The whole page — scene, styling and logic inline |
| `model/hunter_2.glb` | 3D model (59 MB — first paint takes a moment) |
| `model/signature.png` | Signature overlay, inherited from `index.html` |
| `music/*.mp3` | The 7 SIX60 tracks, listed in `songs[]` inside `music.html` |

### Repo / publishing note

The git remote is `git@github.com:dlai211/projection.git`, and that repo is
**public**. The `bucket/` folder as committed contains third-party commercial
music (the seven SIX60 tracks), a personal 3D scan and a signature image.
Committing them locally is one thing; publishing them to a public repo is
another, and that push has been deliberately left for the owner to decide.

---

## 2. What was extracted from `../music/`, and what was left behind

**Taken:**

| Source | Extracted |
|---|---|
| `style.css` | Palette (`#dceee0` mint, `#F78DA7`→`#A8C0FF` accent gradient), `Patrick Hand`, wheel item styling, progress bar + gradient fill |
| `wheel.js` | The arc wheel — radius 100, 30px item pitch, items rotated along a circle with the "active" slot at the 3-o'clock position |
| `script.js` | `formatTime()`, progress fill on `timeupdate`, click-and-drag to seek, `animateLetters()` bouncy text |
| `main.js` | `AudioContext → AnalyserNode → destination` graph, `fftSize 512`, threshold-at-half-maximum line drawing, thin round-capped lines |

**Deliberately left behind:** cover art (`.cover`), lyrics line, the rain-on-glass
panel (`rainyday.js`, `index2.html`), and the `music_mp3/` + `music_pic/` assets —
they belong to the old playlist, and the SIX60 tracks have no matching artwork.

## 3. Decisions made in this phase

1. **Theme colour: mint `#dceee0`**, blended with the palette's own pink and
   periwinkle — a mint base with a pink glow top-right and a periwinkle glow
   bottom-left. The serif overlay text and hairline frame were re-tinted from
   `index.html`'s warm brown `#4a4539` to a cool `#3f4a45` so nothing fights the
   green. `index.html` itself is untouched.
2. **Controls occupy the title's space** — the `Mr. Sad Sick` solid/outline
   headings are removed. (Phase 1 put the cluster at 47%; Phase 2 moved it to
   `top: 75%` with `translateY(-50%)`, floating with no panel behind it.)
3. **The bottom scroll-indicator is removed** (its caption + hairline) because
   the full-width progress bar now lives there. The frame, corner ticks, the four
   serif captions and the "SAD" background text are kept as scene identity.
4. **The signature moved to the bottom-right** — at its `index.html` position
   (`left: 9%`, `top: 62%`) it collided with the wheel.
5. **Wheel now snaps** to the nearest song on release and is clamped to the ends,
   instead of drifting freely; one mouse-wheel notch = one song (trackpads are
   accumulated so they don't fly past). Clicking a song in the wheel selects it.
6. **Loop modes**: `all → one → off`, defaulting to `all` (a 7-song page looping
   beats stopping at track 7). Shuffle picks a different random track on each
   Next/Prev.
7. **Selecting a song in the wheel keeps playing** if audio was already playing;
   if it was paused, the new song loads paused — no surprise autoplay.
8. **`AudioContext` is created on the first play click**, not at load, then
   resumed — this is the standard fix for the "suspended context = silence" bug.
9. **The wheel box is 340px wide, not 250px.** The source's `overflow: hidden`
   box clipped the *active* title at ~110px of text (the active slot sits at
   `x = +radius`, so the title grows rightward into the clip). Widened so
   "Don't Forget Your Roots" fits; the box height is still exactly the arc's
   diameter, so `overflow: hidden` keeps doing its real job — fading the tail
   items at the top and bottom.
10. **Repeat-one shows a solid Material-style "1"** inside the loop. A stroked
    "1" at 22px read as a slash, so the glyph is filled (`fill="currentColor"`),
    which also keeps it the accent colour when the mode is on.

## 4. The mirrored visualizer

`main.js` drew one line per frequency bin from the canvas bottom upward
(`moveTo(x, y); lineTo(x, y - barHeight)`), keeping only bins above half the
frame's maximum so the quiet bins stay invisible.

Here the same rule is kept, but each surviving bin is drawn as a **single line
through the centre baseline**: `moveTo(x, mid - h); lineTo(x, mid + h)`. So a
loud frequency expands symmetrically up *and* down from the middle, and a quiet
one is not drawn at all. The baseline hairline is always stroked, so the canvas
still reads as an axis when the track is paused. The canvas is DPR-scaled and
its bar geometry recomputed on resize.

**One change from the source:** the 72 bars are spaced across the spectrum
*logarithmically* (`bin = (binCount/2) ^ (i/71)`, covering bins 1–128 of 256)
instead of linearly. Music is bass-heavy, so a linear walk through the bins puts
every line in the left sixth of the canvas and leaves the rest empty — the log
walk gives each bar a fair share of the range and uses the full width. The
"only draw above half the loudest bin" threshold is unchanged, so quiet
high-frequency bars still drop out rather than showing noise.

## 5. Phase 2 — the refinement pass

**Model framing.** There is no `model.scale.set()` to tune here: the page uses
`model-viewer`, not hand-written Three.js, and `model-viewer` frames the model
itself. Its knob is the **camera orbit radius** — the third value of
`camera-orbit`. `index.html` leaves it on `auto`, which fits each model to its
own bounding box; `hunter_2` is a head-and-shoulders scan that *fills* its box
while `hunter.glb` is a figure inside its box, so at `auto` the same framing put
hunter_2's head ~35% too wide next to index.html. Fix, both places:

- `CAMERA_RADIUS = "7.1m"` (`music.html`, near the bottom of the script) —
  measured against `index.html` renders: head width now lands within a few px.
  **Bigger number = camera further back = smaller model.**
- `updateRotation()` must interpolate the same radius, or the first mousemove
  resets the camera to `auto` and the sizing is lost.
- `#my-model { transform: translate(-50%, -43%) }` (index.html uses `-33%`) —
  hunter_2's subject sits lower in its bounding box, so it needs a bigger lift
  to land in the same place: head near the top, jacket filling the lower third.
  This is also what lets the white UI sit on the black jacket.

**No glass.** The `.player` panel's background, border, blur and shadow are
gone; the cluster floats directly over the canvas. `top: 75%` +
`translate(-50%, -50%)` centres it three quarters down.

**White UI.** Song title, artist, the four transport icons and the visualizer
are white; the play button inverted to a white disc with a dark glyph (it is the
primary action). The accents stay on the progress-bar fill and the on-state of
the shuffle/repeat toggles. Because white has nothing to sit on where the model
is missing or pale, the text carries a two-layer shadow (tight edge + soft halo)
and the visualizer lines carry `GLOW` px of dark halo.

**Visualizer.** Wider canvas, sparser lines, shorter bars — all driven by the
constants block listed in §6.

**Nav.** Home + music icons in the top centre of *both* pages, under the frame's
top line: 32px circles, a 1px border and the glyph only — no fill. The current
page's icon is at full opacity. Each page uses its own ink colour (cool
`#3f4a45` on music.html, warm `#4a4539` on index.html).

## 6. Phase 3 — layout, density, wheel sync, live background

1. **Cluster moved down** to `top: 80%` (line 252), so it sits on the chest of
   the hoodie. The visualizer canvas was made shallower at the same time
   (`clamp(56px, 9vh, 104px)`) — at 80% a taller canvas would have run into the
   progress bar on a 576px-tall window. Measured clearance: the lowest a bar can
   reach is ~534px, the progress track starts at ~545px.
2. **Visualizer density**: `BARS` 64 → **128** at the same canvas width, so the
   gap closed from ~11px to ~4px, and `BAR_GAIN` 0.18 → **0.12** for a tighter
   waveform.
3. **Wheel sync** — both directions now run through one function, `tweenTo()`
   (line 678), so there is a single place the wheel can move and it can never
   disagree with the audio:
   - **Player → wheel** (`loadSong`, line 936): Next, Previous and
     end-of-track all call it, and it tweens the wheel to `currentIndex`.
     It passes no `onArrive`, so it cannot call back into `selectSong` and loop.
   - **Wheel → player** (`selectSong`, line 720): a drag-release, a wheel notch
     or a click on a song now always loads **and plays** it (it used to keep
     whatever play/pause state it found).
   - The first autoplay still needs one real click somewhere on the page —
     browsers refuse it otherwise. After that, wheel-picking always plays.
4. **Live background**: the two glow layers are positioned by four CSS
   variables (`--glow-x/y` and `--glow-x2/y2`, defined on `:root` around line 26,
   consumed by the `body` gradient around line 55). A mousemove listener records
   the cursor, and a rAF loop eases the variables toward it (`GLOW_EASE`, line
   1059 — 0 never arrives, 1 is glued to the cursor). The pink glow chases the
   cursor; the periwinkle glow takes the opposite corner. The loop stops writing
   to the DOM once the values settle, so an idle page is not repainting the
   background every frame.

## 7. Visualizer tuning reference

Everything lives in one block in `music.html`:

| Line | Constant | Now | What it does |
|---|---|---|---|
| 814 | `BARS` | `128` | Number of frequency lines. **Fewer = wider spacing**, because step is derived: `step = canvasWidth / BARS`. |
| 815 | `LINE_W` | `3` | Line thickness in px, capped at 60% of the step so lines can never merge on a narrow window. |
| 816 | `BAR_GAIN` | `0.12` | **The height dial.** Multiplier on `(value - cutoff)`. Was `0.3` in Phase 1 / the source, then `0.18`. |
| 817 | `MAX_BAR` | `0.8` | Hard ceiling on a bar, as a fraction of the canvas half-height. |
| 818 | `CUTOFF` | `0.5` | A bin only draws if it beats this fraction of the loudest bin. Lower it (0.35) for a busier visualizer. |
| 819 | `GLOW` | `7` | px of dark halo behind each white line. |
| ~852 | `step` | derived | `cssW / BARS` — the centre-to-centre distance. Width and spacing both come from here. |
| ~853 | `lineW` | derived | `min(LINE_W, step * 0.6)`. |
| ~893 | — | — | `let h = (value - cutoff) * BAR_GAIN` — the amplitude line. |
| ~896 | — | — | `const x = i * step + step / 2` — where each line is placed. |

Canvas size itself is CSS: `#visualizer` (line 376) is `width: 100%` of
`.player`, which is `min(1040px, 88vw)` (line 254); its height is
`clamp(56px, 9vh, 104px)` (line 378) — deliberately shallow since Phase 3,
so the cluster at 80% still clears the progress bar on a short window.

Note the log bin mapping means the lowest handful of bins each feed several
bars, so the far left reads as a solid block of bass. That is what a
log-spaced visualizer looks like; it is not a bug.

## 8. How this was verified

Rendered headless (Chrome `--headless=new`) against a local `http.server`,
driving the real page through an iframe that holds the load event open so the
59 MB model has time to arrive, with `--autoplay-policy=no-user-gesture-required`
so the transport can be clicked programmatically:

- **Playing:** pause icon flips, `0:14 / 3:47` counts, fill advances, visualizer
  draws real mirrored lines.
- **Next ×2 then Loop then Shuffle:** title/artist swap, total time re-reads,
  the wheel rotates the new song into the active slot, both toggles light up.
- **Model scale**, measured rather than eyeballed: the model was isolated by
  diffing a render against the same layout with no model, then the head extent
  was compared with `index.html` at 1024×576. At `auto` the head was ~35% too
  wide; at `7.1m` it lands within a few px, and the head top sits at the same
  y as index.html's.
- **Both pages** re-rendered after the nav was added; index.html is otherwise
  untouched.
- **Wheel sync, both directions**, driven from the harness: (A) two clicks on
  Next while playing → title, total time and the wheel's slot all land on
  "Never Enough"; (B) two synthetic wheel notches → the same song loads *and*
  starts playing, with the wheel showing it in the slot.
- **Live background:** a synthetic mousemove at the bottom-left swung the pink
  glow from the top-right down to the cursor, with the periwinkle taking the
  opposite corner.
- **Clearance at 80%:** zoomed the bottom strip at 1024×576 and measured the
  lowest a bar can reach (~534px) against the progress track (~545px).
- Every `getElementById` / `querySelector` target in the script was checked
  against the markup; all resolve.

Not verified automatically: seeking by dragging the bar, touch input, and the
nav links actually navigating.

## 9. Known limits / next steps

- No artwork or lyrics for the SIX60 tracks. If cover art is added later, drop
  it in `music/` and add a `pic` field to `songs[]`.
- Track order is filename order; no persistence (reload restarts at track 1,
  paused).
- The 59 MB `hunter_2.glb` is the slowest thing on the page: **~1M vertices**
  (972,084) plus 3 textures. It is the reason the model takes a while to appear.
  `gltf-transform` + Draco/Meshopt would cut it dramatically if load time
  matters.
- The visualizer's right-hand third is often empty on bass-heavy tracks — that
  is the half-of-maximum `CUTOFF` rule, not a bug. Lower it to make it busier.
- The far left of the visualizer is a block of near-identical tall bars: log
  spacing gives the lowest bins several bars each. Normal for a log-spaced
  visualizer.
- The cluster is at 80%; on a window shorter than ~560px it will start to meet
  the progress bar. The shallower canvas is what keeps a 576px window safe.
- The live background rewrites CSS variables on the body gradient, so the
  background repaints while the cursor is moving. Fine on a GPU; on a weak
  machine, raise the settle threshold or lower `GLOW_EASE`.
- Not tuned below ~700px width; the wheel and control cluster will crowd there.
- Nav icons are plain links — no active-page detection beyond the hard-coded
  `current` class.
