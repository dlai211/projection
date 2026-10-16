# PRD — Rainy-night Convenience Store (`projection/shop/`)

> This file is the specification **and** the changelog for `projection/shop/`.
> After each phase, add a "Phase N complete" entry at the bottom.

- Drafted: 2026-10-16
- Status: **v1.1 — visual pass complete; two known gaps, listed in §7**
- User: the author (no coding background)

---

## 1. How to run

Static site, no build step, no dependencies. ES modules are blocked over
`file://`, so it must be served:

```
cd projection/shop
python -m http.server 8080
```

then open <http://localhost:8080/>. Opening `index.html` directly shows a notice
saying so rather than a blank page.

Offline by construction: three.js is vendored into `vendor/three/`, and every
texture is drawn on a canvas at load. There are no image or audio files in the
project at all.

### Checking it

```
node tools/check_scene.js
```

No browser, no install. Exit code 0 means clean. Recorded results are in §6.

---

## 2. What it is

A Japanese convenience store on a street corner at night in the rain, presented
as a small 3D model: drag to orbit, scroll to zoom, no interface of any kind. It
is built at 1 unit = 1 metre on a 26 m square plinth whose sides are visible, so
it reads as a model on a stand rather than as ground running to a horizon.

Art direction is cel-shaded — four flat bands, an ink contour on anything with
volume — with a warm interior against a cool, wet exterior. The shop is invented
(**アオイマート / AOI MART**) so nothing treads on a real chain's livery.

---

## 3. Architecture

Fifteen ES modules under `js/`, wired together in `main.js`. The rule that keeps
this manageable is one-way imports: the *system* modules — `toon`, `lights`,
`textures`, `signage`, `reflection`, `postfx` — own resources that other modules
consume, and never import the modules that consume them. `main.js` stays a short
wiring file instead of a hub everything reaches through.

**`config.js` and `manifest`-style data import nothing and touch no DOM.** That is
what lets `tools/check_scene.js` read the real module in Node, with no sandbox
and no shim, exactly as `piano/tools/check_*.js` does for that project.

### The pipeline

```
scene
  → [mirror pass: reflection.js, half-res, manual, outside the composer]
  → RenderPass → UnrealBloomPass → grade → OutputPass
```

### Decisions that were not obvious

**The gradient ramp is 64 texels, linearly filtered, not a 4-texel nearest-filter
ramp.** `gradientmap_pars_fragment` samples it with a bare `texture2D` — no
derivative-aware filtering — so a `NearestFilter` ramp gives a literally hard step
that shimmers and stair-steps along the terminator as the camera orbits. MSAA
does not help, because the aliasing is in the shading rather than the geometry.
Spreading each of the four steps over 16 texels gives crisp bands that do not
crawl.

**The outline hull's offset direction is `pos2 - pos`, and it is applied in NDC.**
Three.js's own `OutlineEffect` writes `pos - pos2`, but only because the normal it
feeds in has already been negated for BackSide rendering. Copy the sign without
copying the negation and the hull shrinks *inside* the object instead of swelling
around it — and it fails silently, by simply not drawing, rather than by looking
wrong. Separately, doing the same thing as `normalize(pos2 - pos)` on the clip-space
vec4s looks equivalent and is not: their `w` differs, so normalising the whole
vector scales the xyz part to nearly nothing for any surface facing the camera.

**The outline hull uses its OWN smoothed normals, computed per vertex of the
original geometry.** Averaging the geometry's normals is what closes the hull
around a convex corner; with hard-edged normals the two faces' offsets diverge and
the line tears open at every corner of every box. The obvious implementation —
`mergeVertices`, then `computeVertexNormals` — is wrong in a way that is very hard
to see: merging welds a box's 24 vertices down to 8, so the normals come back
indexed by a different vertex count than the geometry they are about to be
attached to, the buffer is short, and the hull collapses into the object shifted
in one direction. The outline then shows along a couple of edges and vanishes
from the rest, which reads as a shading quirk rather than as a bug.

**Light colours are much lighter than the scene looks.** three.js lighting is
physically correct: irradiance is multiplied by the surface albedo and divided by
pi. A sky colour as dark as an actual night sky (linear ~0.02) times any sane
intensity lands within a rounding error of zero, and the whole model goes black.
The night comes from the *hue* of the light and from what is not lit — never from
starving the lights.

**Bloom's threshold is a linear number, not a screen colour.** three.js skips tone
mapping whenever it renders into a render target, and the composer's buffers are
render targets — so `UnrealBloomPass` thresholds against linear luminance. A neon
panel at sRGB `#ff5a3c` sits at a linear luminance of about 0.22, nowhere near a
0.85 threshold, so nothing blooms and you conclude the pass is broken.

**The road is two coplanar layers.** `MeshToonMaterial` has no `envMap`, no
roughness and no metalness, so there is no way to get a wet road out of the toon
pipeline. Layer A is ordinary toon asphalt, so the road bands and fogs with
everything else; Layer B is a single additive quad sampling a planar reflection,
masked into puddles and distorted by ripples. Additive rather than alpha, because
a wet road at night does not *replace* the asphalt with a mirror — it *adds*
reflected light to a nearly black surface.

**Glass gets no contour and no depth write.** Glass at 25% opacity with a black
hull behind it would paint out the interior the whole project exists to show.
What reads as "window" is the fresnel sheen at grazing angles, which is what reads
as glass at night anyway.

**There are no shadow maps.** A night scene whose dominant light is interior spill
through glass has no meaningful shadow caster, and a shadow map would cost a full
extra scene render to produce a hard, photographic edge that a cel frame does not
want. Also: every inverted hull would cast its own shadow unless individually
flagged, and the failure is a doubled black smear.

**Every module that loads has to be reachable, and every config key read has to
exist** — see §6. That check is not theoretical; see §5.

---

## 4. The scene

**Ground** — plinth with an inset lip, two 6 m streets meeting in an L, raised
pavement with real kerb faces, gutters, grates, dashed centre line, edge lines,
zebra crossing, parking bays in the back lot.

**Shop** — panel-built shell (not a solid box: two faces are opened for glazing
and the corner is cut for the door), flat roof with parapet, rooftop plant,
condensers, a water tank, a hatch and guard rail, a roof drain. Fascia sign
wrapping both street faces, a pole sign at the corner, aluminium sashes and
mullions, chamfered corner entrance with sliding doors, eave with an under-eave
light strip, entrance mat.

**Interior** — suspended ceiling grid with recessed light panels, three gondola
shelf runs with several hundred products merged into one mesh per colour, a
glass-door drinks cooler, checkout counter with register and card reader, coffee
machine, oden counter, magazine rack, lockers, floor guidance tape, hanging promo
cards, wall posters, and a back-room doorway that is deliberately **darker** than
the shop — a hole you cannot see into is what tells the eye the room has depth.

**Street** — vending machines, bicycle, rubbish bins with one lid ajar, street
lamp, utility pole with cross-arms, transformer and **sagging** wires, road sign,
corner guardrail, notice board, air-conditioner condensers in the alley, a
neighbouring building closing the frontage, and a traffic signal at the far end of
the street.

**Weather** — two layers of instanced rain with wind shear, splash rings on the
road, drips off the awning edge, runoff scrolling down the glass, steam off the
oden pot, and the wet-road reflection.

**Motion** — the doors cycle rarely and slowly, with a tenth of a second of offset
between the leaves, and the doorway spills a soft rectangle of warm light onto the
wet road only while they are open. Sign and interior flicker. The traffic signal
cycles. Audio is rain, synthesised rather than loaded — two filtered noise bands
with a slow random walk on the cutoff — starting on the first click and toggled
with **M**.

---

## 5. What went wrong

Four bugs cost real time. All four are recorded because all four are the kind that
do not announce themselves.

1. **The camera position was `NaN`.** `config.js` named the keys `minPolar` and
   `maxPolar`; `main.js` read `CAMERA.minPolarAngle`, got `undefined`, passed it to
   OrbitControls, and `Math.max(undefined, …)` produced a `NaN` polar angle, then a
   `NaN` camera position, then `NaN` for every projected vertex. The renderer drew
   a perfectly black frame, the console was silent, and no shader had failed to
   compile. Found by logging the camera position and the OrbitControls internals;
   the fix was to rename the keys after the OrbitControls properties they feed, so
   a mismatch is a typo the eye catches.

2. **The outline hull was inverted and did not draw at all** — see §3. It was
   invisible for two rounds of debugging because what looked like an outline in the
   render was actually the toon shading band on the shadowed side of each object.

3. **The outline hull had the wrong normal buffer** — see §3. Found by temporarily
   colouring the outline red and counting red pixels: 35 in the whole frame, all
   along the top edges, which said the hull was being offset in one direction
   rather than radially.

4. **`WEATHER.steam` did not exist** — the entry was under `MOTION`. This is the
   same failure as bug 1 and the reason `tools/check_scene.js` now verifies that
   every config key referenced anywhere in `js/` is actually in `config.js`.

Also worth recording: on the way to the first successful render, two GLSL template
literals were broken by backticks inside their own comments, which truncates the
string and produces a `SyntaxError` pointing at the next line rather than at the
comment.

---

## 6. How this was verified

**`node tools/check_scene.js` — 9/9 checks passed, on the real modules:**

```
Files
  ok    js/ has modules to check (15)
  ok    every relative import resolves
  ok    index.html loads a module entry point
  ok    no orphan modules
  ok    vendored three.js is complete (16 files)
  ok    three.module.js and three.core.js are a matching pair
Config
  ok    every config key referenced in js/ exists
  note  19 config keys nothing reads yet (not a failure)
Scene
  ok    all 15 planned modules exist
  ok    all 43 required elements are built
  15 modules, 4494 lines of JavaScript
```

**`node tools/visual_check.js` — six captures, opened and read.** See section 10.
`check_scene.js` is now at 19/19 on 16 modules and 47 required elements.

**In the browser** — served over `python -m http.server`, captured with headless
Chrome (`--headless=new`, `--virtual-time-budget`). Console is clean apart from
one three.js deprecation notice for `THREE.Clock`.

One thing about that capture method is worth writing down, because it silently
falsified several early rounds of review: under `--virtual-time-budget` the
compositor can finish without ever ticking a `requestAnimationFrame`, so only
what was drawn synchronously before `setAnimationLoop` reaches the screenshot.
The rain is ticked inside the loop, so **there was no rain in any still capture
this project has ever taken** — the model simply stopped being drawn after the
first frame. `main.js` now runs one complete update-and-draw before handing over.

**Not verified.** No frame-rate measurement was taken, so the 60 fps target in
`QUALITY` is a design intention rather than a measurement. Drag feel, touch input
and pinch-zoom were never exercised by a human. The reflection, ripples and rain
were checked by eye in still frames only — nobody has watched them move.

---

## 7. Known gaps

1. **The notice board and the attic of small props are thinner than the brief.**
   There is one board with three posters, one bicycle, one umbrella stand, one
   set of bins. The brief's "small, exquisite, collectible" reading would take
   several more of each, at slightly different angles.

2. **The audio is a wash, not a place.** It is rain and only rain — no door chime
   when the doors open, no distant traffic, no change as the camera moves. The
   door chime was specified in `MOTION.door.chime` and is not wired to anything.

3. **The 21 unreferenced config keys** listed by the check are palette entries and
   dimensions kept for later use. They are flagged rather than failing the build,
   but they are also genuinely dead right now.

---

## 8. Changelog

| Date | Change |
|---|---|
| 2026-10-16 | PRD created; v1.0 built — all eight phases, checks passing |
| 2026-10-16 | v1.1 — visual repair pass, on review of the first render |
| 2026-10-16 | v1.2 — `tools/visual_check.js`; eight faults found by looking at the render, none of them visible to `check_scene.js` |

---

## 9. Phase 9 — the visual repair pass

The first render was reviewed and came back with seven groups of faults. All
seven are addressed; what follows is what was actually wrong and what was done,
because most of them were not what they first looked like.

**Bloom was blowing the signage out to a white smear with no legible lettering.**
Two causes, and only fixing one would not have worked. The threshold, 0.82, was
below the linear luminance of the sign's own highlights; and every emissive
material was tinted `0xffffff`, so there was no hue left to see at any exposure.
Threshold to 0.88, strength 0.34 → 0.28, radius 0.30 → 0.22, and every emissive
retinted — the signs to a warm `signGlow`, the vending machine to its cold blue,
the traffic lamps to their own colours. The fascia now reads as dark blue
lettering on a warm white band, which is what it was always supposed to be.

**The fog was a grey veil over the whole frame.** `FogExp2` at 0.017 put almost
half a stop of grey on the far corner of a 26 m base and destroyed the cool/warm
separation. Down to 0.0085 — a few per cent, just enough to sit the model in air.

**The scene went far too dark once the fog came off**, because the fog had been
hiding how little light there was. Exposure back up, ambient and the interior
spill raised, and the shop floor given a little self-illumination: the floor is
what actually carries the interior's light back out through the glass.

**The middle of the pavement had a pillar in it.** It was the pole sign, standing
at the chamfer — which is exactly where the doors are. Moved to the east end of
the frontage, where it is clear of both the entrance and the west glazing, and
thinned from 0.17 m to 0.105 m. The transformer that made the utility pole read
as a pillar moved up the pole; the pole itself moved across the road.

**The wires ended in mid air.** All four spans ran past the edge of the plinth and
stopped. There are now two poles and two wall brackets, and every span lands on
one of them.

**The guardrail barricaded the crossing**, and the road markings ran straight
through it. The rail is now in two runs either side of the crossing; the dashed
centre line and the edge lines break for the junction; and stop lines were added,
set back 1.8 m. The kerb at each end of the crossing is now cut away and ramped,
because a crossing that ends in a 13 cm step is one nobody can use.

**The window posters read backwards from the street.** The planes were rotated by
PI, which showed the back face of the texture. Removed the rotation.

**A brown smudge hung over the bins outside.** It was the oden steam: the emitter
was positioned off the chamfer rather than off the pot. The umbrella stand was
inside the shop for the same kind of reason — at x = -4.65 with the interior
starting at -4.75. Both repositioned; the umbrellas are now four distinct furled
shapes rather than a blur.

**The pavement texture was stretched into wood grain.** One `repeat` value shared
by a 20x2 m strip and a 20x16 m block. Each rectangle now gets its own repeat.

**The shelves were blank boxes with blue lines**, which the brief called out
directly. The carcass is dark, the boards pale, and the stock now has gaps in it,
uneven heights, the odd stacked second item and a couple of degrees of lean —
a shelf packed edge to edge with identical boxes reads as a texture, not as
merchandise. A lit bento case with black trays and red lids, and a stepped
onigiri stand of triangular rice balls with nori bands, were added as the two
named zones they were supposed to be.

**The plinth was a 0.9 m slab.** Now 1.5 m in three stacked layers with a lit rim
between them, so the edge catches a line of light all the way round and the base
reads as a purpose-made stand.

**The facade was a pale grey box.** The walls were near-white, which under a cool
ambient reads as precisely the "grey box" the review named. Darkened to
`0xbcc5d4`, so the lit interior and the sign are what the eye goes to.

**The tactile paving, when first added, was worse than its absence** — 30 cm
wide, bright, emissive and 20 m long, which read as painted lane markings rather
than as a guidance strip. Cut to 16 cm, dulled to ochre, and shortened to a
short approach at each ramp.

Still passing afterwards: `node tools/check_scene.js`, 9/9.

---

## 10. Phase 10 — learning to look

Phase 9 was done by editing coordinates and reasoning about the result. It fixed
real things, but it also produced a round that was worse than the one before it,
and then a round that missed a signal head standing inside the building. The
problem was not any individual mistake. It was that there was no instrument in
this project that could see a picture, so every visual claim made here was an
inference dressed up as an observation.

`tools/visual_check.js` is that instrument. It drives headless Chrome to six
fixed camera positions and writes PNGs, and then a person opens them. What
follows is what the first four passes with it found.

**The utility poles stood in the middle of the road.** Both of them: at z = 10.2,
inside the main carriageway. `FURNITURE` in `config.js` said 12.2, and
`check_scene.js` had a check that no street furniture stands in a carriageway,
and that check passed — because `props.js` kept its own copy of the coordinates
and never read the table. The check was validating a fiction and reporting `ok`.
This is the worst failure mode in the file, because it does not look like a
failure. Every pole, mast and sign is now placed from `FURNITURE`, and there is a
check that `props.js` still reads every entry.

**A signal head hung half a metre inside the shop.** The side-street mast carried
its arm east from x = -6.7, so the head landed at x = -4.5, above the ceiling and
across the frontage. The mast was on the pavement and the mast was in the table,
so nothing objected. There is now a check that samples twenty points along every
signal arm and fails if any of them is inside the building.

**A triangle of shop floor lay on the pavement.** The floor was a plane one wall
thickness smaller than the building on each side — a rectangle. The building's
corner is cut off at 45 degrees, so a triangle 1.8 m across passed through the
chamfer and sat in front of the automatic doors as a blown-out white apron with a
hard straight edge. It had been in every render this project ever produced. The
floor is now a `Shape` with the chamfer in it. No coordinate check could have
found this; every number was right.

**The entrance mat was a black hole.** `0x3b4250` under a dark multiplier map, in
a spot none of the scene's real lights reach, came out at very nearly black — and
I misread it as a shadow through two rounds of review, including one where I
"fixed" something else and called it dealt with. Two stops lighter, no map, and
a whisper of emissive.

**A guidance strip was painted across a zebra crossing.** The tactile strips were
written inline in `ground.js`, and one of them ran 3.2 m west from the kerb cut —
which is the side street, so it lay on the carriageway and printed yellow over
the crossing's bars. The strips are now a table in `config.js` with a check that
none of them is in a road.

**An edge line ran across the mouth of a junction.** The main street's near edge
line was drawn from the plinth edge, and west of x = -7 there is no near kerb at
all — the carriageway simply continues north. The two sides of the street need
different runs and now have them.

**Two windows hung in the air off the side of the neighbouring building.** The
row stepped off at 1.6 m intervals from `x0 + 1.2`, and the fourth landed at
x = 13 — exactly the east face. The columns are now derived from the building's
own width.

**The delivery yard was unlit and the neighbour's back wall was blank.** The
bulkhead lamp over the service door was an emissive box and nothing else: it
glowed and lit nothing, so the whole back lot — truck, shelter, bins, wall —
rendered as a black rectangle. It is now a real point light, and the neighbour
has a corridor of small windows on its back and side, two downpipes and two
condenser units on brackets.

**And several things that turned out to be fine**, which is worth recording
because the point of an instrument is that it can also say no:

- Both crossings were already correct. Their bars run with their own traffic:
  the side-street crossing's bars run along Z and the main street's along X, so
  the two are perpendicular. In the whole-base plan view each bar is 15 px and I
  twice read them the wrong way round; the close junction view settles it, and
  the two crossings measure 170x95 px and 100x188 px — transposed, as they must
  be.
- The stop line is in the lane arriving at the junction. Left-hand traffic:
  southbound traffic keeps its left, which is the +x half, which is the side
  nearest the shop. The arrows on the ground already said so.
- The truck's tailgate and the service door are 20 mm apart in x. The loading
  hatch was a metre east of the door, and that is now fixed.

The scene also gained a fifth and sixth camera because four were not enough: the
whole-base plan view puts a 45 cm crossing bar at fifteen pixels, which is enough
to see that there is a crossing and not enough to see which way its bars run.

**Still not verified.** Everything in section 6 that was true is still true: no
frame-rate measurement, no human has dragged or pinched the model, and nobody has
watched the rain move. The visual check reads stills.
