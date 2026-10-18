# PRD — bucket / `music-3d.html`

A single-page music player built over the **Mr. Sad Sick** 3D scene. The page
reuses the 3D stage from `index.html` and lifts *only* the song wheel, progress
bar and line visualizer out of `../music/`, re-stitched into a Spotify-style
centre layout.

**Status:** Phase 5 — the visualizer went back to mirrored bars (the wave is
superseded), now at high resolution: 2048-point FFT, 256 bars, a 70% fill
ratio and a low 0.25 threshold so quiet detail shows. Play button is a hollow
gradient ring; volume defaults to 70%.

---

## 1. How to run

Static page, no build step. It **must be served over http** — `model-viewer`
fetches the `.glb` with `fetch()`, which browsers block on `file://`, and
`mediaElementSource` needs a real origin:

- VS Code: right-click `music-3d.html` → **Open with Live Server**
- or `python -m http.server` from this folder, then open `/music-3d.html`

Needs internet for two things: the `model-viewer` script (same CDN as
`index.html`) and the `Patrick Hand` font.

Files used:

| Path | Role |
|---|---|
| `music-3d.html` | The whole page — scene, styling and logic inline |
| `model/music-model.glb` | 3D model (42 MB — first paint takes a moment) |
| `model/signature.png` | Signature overlay, inherited from `index.html` |
| `music/*.mp3` | The 7 SIX60 tracks, listed in `songs[]` inside `music-3d.html` |

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

Phase 1 kept that rule, drawing each surviving bin as a **single line through
the centre baseline** (`moveTo(x, mid - h); lineTo(x, mid + h)`) so it expanded
symmetrically up and down. The baseline hairline is always stroked, so the canvas
still reads as an axis when the track is paused. The canvas is DPR-scaled and its
geometry recomputed on resize.

**Change from the source, kept in every phase since:** samples are spaced across
the spectrum *logarithmically* (`bin = (binCount/2) ^ (i/(BARS-1))`) instead of
linearly. Music is bass-heavy, so a linear walk through the bins puts everything
in the left sixth of the canvas and leaves the rest empty.

*(The rendering went bars → wave (§7) → bars again (§8). The current state is
§8: mirrored bars, but finely spaced. The log bin mapping below is the one part
that has survived every rewrite.)*

## 5. Phase 2 — the refinement pass

**Model framing.** There is no `model.scale.set()` to tune here: the page uses
`model-viewer`, not hand-written Three.js, and `model-viewer` frames the model
itself. Its knob is the **camera orbit radius** — the third value of
`camera-orbit`. `index.html` leaves it on `auto`, which fits each model to its
own bounding box; this head-and-shoulders scan *fills* its box while
`index-model.glb` is a figure inside its box, so at `auto` the same framing put
its head ~35% too wide next to index.html. Fix, both places:

- `CAMERA_RADIUS = "7.1m"` (`music-3d.html`, near the bottom of the script) —
  measured against `index.html` renders: head width now lands within a few px.
  **Bigger number = camera further back = smaller model.**
- `updateRotation()` must interpolate the same radius, or the first mousemove
  resets the camera to `auto` and the sizing is lost.
- `#my-model { transform: translate(-50%, -43%) }` (index.html uses `-33%`) —
  the model's subject sits lower in its bounding box, so it needs a bigger lift
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
`#3f4a45` on music-3d.html, warm `#4a4539` on index.html).

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

## 7. Phase 4 — wave visualizer, volume, no selectable text

**The visualizer is a wave now.** The bars, the gaps and the threshold are all
gone. `draw()` builds a single closed shape:

1. one amplitude per sample — `heights[i] = dataArray[binMap[i]] * BAR_GAIN`,
   with no `CUTOFF`, so quiet bins contribute a small value instead of vanishing
   and the shape never breaks apart;
2. ends pinned to 0, so the wave tapers into the axis at both edges;
3. `SMOOTH` passes of 3-tap neighbour averaging (the spatial half of the
   smoothing; `analyser.smoothingTimeConstant = 0.85` is the temporal half);
4. the top edge is traced left → right with `quadraticCurveTo` through the
   midpoints between samples, then the bottom edge is traced back right → left
   with the sign flipped, and the path is closed;
5. filled with `WAVE_FILL`, then outlined in white — **the halo is applied to
   the outline only.** A shadow on a shape that size smears a grey slab across
   the whole canvas; that mistake was made and fixed here.

**Volume slider** (`#volume`, in the transport row but absolutely positioned at
its right edge, so the five Spotify buttons stay centred). It writes
`audio.volume` — which, because the element is routed through the
AudioContext, attenuates what you hear *and* what the analyser sees, so the
wave flattens when you turn it down. A GainNode placed after the analyser would
keep the wave dancing at zero volume. The track's filled fraction is a CSS
variable (`--vol`) written on input, because `input[type=range]` gives no
built-in fill in WebKit.

**Text is not selectable** — `user-select: none` on `body` (line 43), so
dragging the wheel or the transport never starts a selection. `index.html` has
not been given this; say the word if you want both pages consistent.

## 8. Phase 5 — back to bars, at high resolution

The wave (§7) is superseded. `draw()` is the mirrored bar loop again, but tuned
for detail rather than sparseness:

- **`FFT` 2048** — 1024 bins of frequency data instead of 256.
- **`BARS` 256** — was 200. Each bar gets a `step = cssW / BARS` slot.
- **Width is now a ratio, not a constant.** `lineW = Math.min(LINE_W, step *
  BAR_FILL)` — a bar wants to be `LINE_W` (2px) wide but may never exceed 70% of
  its slot. Whichever is smaller wins, so raising `BARS` narrows the bars
  automatically and they can never merge into a solid block on a narrow window.
  At 1024×576 that lands on 2px bars with a 1.5px gap.
- **`CUTOFF` 0.25** (restored — it had been removed for the wave). Bars measure
  their height *above* the cutoff, so a low threshold lets hats, strings and
  reverb tails lift a bar off the axis instead of being clipped away.
- **`GLOW` 3**, down from 7. At 256 bars a 7px halo bleeds across the 1.5px gaps
  and greys the whole strip out. This is also the most expensive thing in the
  loop — `GLOW = 0` is the cheap escape hatch if a weak machine stutters.

Also fixed here: the signature (`.signature`, line 105) was sitting exactly
where the volume slider now lives — the track ran straight through it. It moved
to `bottom: 7% / right: 3% / 12vw`, which clears both the slider and the
progress bar's total-time label at 1024×576 and 1440×900.

**Follow-ups.** The play button is a hollow gradient **ring**, not a gradient
disc: an `::before` painted with `var(--accent)` and then masked
(`mask-composite: exclude`) so only its 3px border survives, leaving the middle
transparent so the model shows through and the glyph sits on the page. It uses
`drop-shadow`, not `box-shadow` — a box-shadow would fill the hollow middle with
a glow. Volume now defaults to **70%**: the range input's `value="0.7"` drives
both the play level and the track fill, since `applyVolume()` runs on load.
Verified by probe: `audio.volume=0.70 | slider=0.7`.

## 9. Visualizer tuning reference

Everything lives in one block in `music-3d.html`:

| Line | Constant | Now | What it does |
|---|---|---|---|
| 881 | `FFT` | `2048` | Analyser window. 2048 → 1024 bins of frequency data. `4096` is the next step up if you want even finer resolution. |
| 922 | `BARS` | `256` | Number of mirrored bars. **The detail dial.** `384` also works — the width maths below keeps bars from merging at any count. |
| 923 | `LINE_W` | `2` | Bar thickness in px — a *ceiling*, not a fixed width. |
| 924 | `BAR_FILL` | `0.7` | Share of a slot a bar may occupy; the remaining 30% is the gap. This is the "`step * 0.7`" from the brief, expressed as its own knob. |
| 925 | `BAR_GAIN` | `0.1` | **The height dial.** Multiplies `(value - cutoff)`. |
| 926 | `MAX_BAR` | `1.0` | Ceiling as a fraction of the canvas half-height — see the clearance note in §11. |
| 927 | `CUTOFF` | `0.25` | A bin draws only if it beats this fraction of the loudest bin, and its height is measured *above* it. Low = quiet detail survives. Was `0.5`. |
| 928 | `GLOW` | `3` | px of dark halo per bar. `0` disables it (and is much faster). |
| 957 | — | — | `lineW = Math.min(LINE_W, step * BAR_FILL)` — the bar-width rule. |
| 987 | — | — | `const cutoff = CUTOFF * loudest;` |
| 998 | — | — | The skip: `if (value <= cutoff) continue;` |
| ~1003 | — | — | `let h = (value - cutoff) * BAR_GAIN` — the amplitude line. |

Canvas size is CSS: `#visualizer` (line 376) is `width: 100%` of `.player`,
which is `min(1040px, 88vw)` (line 254); its height is
`clamp(56px, 9vh, 104px)` (line 378).

The log bin mapping means the lowest handful of bins each feed several bars, so
the far left reads as a solid block of bass. That is what a log-spaced
visualizer looks like; it is not a bug.

## 10. How this was verified

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
  lowest the wave reaches against the progress track (~545px) — see §10.
- **Phase 4:** the wave was rendered with real audio and inspected at 2× zoom to
  confirm it is one continuous mirrored shape with no gaps and a taper at both
  ends. A probe injected into the iframe read back the *computed*
  `user-select` for body, title and wheel (all `none`), and the volume slider
  was driven to 45% and back to confirm the track fill and that the wave
  flattens with the volume.
- Every `getElementById` / `querySelector` target in the script was checked
  against the markup; all resolve.

Not verified automatically: seeking by dragging the bar, touch input, and the
nav links actually navigating.

## 11. Known limits / next steps

- No artwork or lyrics for the SIX60 tracks. If cover art is added later, drop
  it in `music/` and add a `pic` field to `songs[]`.
- Track order is filename order; no persistence (reload restarts at track 1,
  paused).
- The 42 MB `music-model.glb` is the slowest thing on the page — it is the
  reason the model takes a while to appear. `gltf-transform` + Draco/Meshopt
  would cut it dramatically if load time matters.
- **Visualizer clearance (measured, 1024×576):** the canvas spans y 500–556 and
  the progress track sits at ~545, so with `MAX_BAR = 1.0` a bass peak that
  reaches the ceiling will cross the progress bar by ~11px. Two levers if it
  bothers you: `MAX_BAR = 0.7`, or lift the cluster to `top: 77%`. On a taller
  window (900px+) there is ~24px of clearance and it does not arise.
- At 256 bars the halo is a real per-frame cost: 256 shadowed strokes. If the
  page stutters on a weak machine, `GLOW = 0` is the first thing to try.
- The live background rewrites CSS variables on the body gradient, so the
  background repaints while the cursor is moving. Fine on a GPU; on a weak
  machine, raise the settle threshold or lower `GLOW_EASE`.
- Not tuned below ~700px width; the wheel and control cluster will crowd there.
- Nav icons are plain links — no active-page detection beyond the hard-coded
  `current` class.
