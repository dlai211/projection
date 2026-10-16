# 雨夜のコンビニ — a rainy-night corner, in miniature

A Japanese convenience store on a street corner at night in the rain, built as a
small 3D model you can turn over in your hands: drag to orbit it, scroll to zoom,
and there are no buttons anywhere. The shop is called **アオイマート / AOI MART** —
an invented shop, so nothing here treads on a real chain's livery.

Cel-shaded, drawn with four flat bands and an ink contour on everything that has
volume. Rain falls, water runs down the glass, the doors open for nobody, one of
the light boxes flickers, and the wet road reflects the whole thing back.

---

## Running it

Double-clicking `index.html` does **not** work: browsers refuse to load JavaScript
modules from `file://`, so you get a blank page and one line in the console. From
this folder, run

```
python -m http.server 8080
```

and open <http://localhost:8080/>.

If you open it the wrong way the page says so rather than going quietly black.

Nothing is fetched at run time — three.js is vendored into `vendor/`, and every
texture is drawn on a canvas at load. There are no image files in this project at
all, so it works with the network switched off.

---

## Using it

| Action | What it does |
|---|---|
| Drag | Orbit around the model |
| Scroll / pinch | Move in and out |
| Right-drag | Pan — but only a few metres, so the model can never be lost off-screen |
| Click anywhere | Starts the rain |

The camera never goes below the plinth. The underside of a model is where
"unfinished" shows, so `maxPolarAngle` stops just short of it.

On load there is a slow push-in over three seconds, and touching the model at any
point during it cancels the move rather than fighting you.

**Sound.** The rain is generated, not a file, and browsers refuse to start audio
until you interact with the page — so it begins on your first click and fades in.
There is no mute button, because there is no interface — press **M** to toggle it.

---

## Tuning it

Everything you would want to change is in **`js/config.js`** — it is plain data
with no imports, so it is safe to edit and the check script reads the very same
file the browser does.

| What | Where | When to change it |
|---|---|---|
| The whole palette | `PALETTE` | The scene has two hues doing the work — a warm interior and a cool exterior. Changing `interiorLight` or `skyHorizon` re-grades everything at once. |
| Sign colours | `PALETTE.brandBlue`, `brandGreen` | To re-livery the shop. |
| Shop name | `BRAND` | Anywhere in `js/signage.js` that draws it. |
| Where things are | `PLAN`, `STORE`, `STREET` | The layout is rectangles, not coordinates scattered through the code. |
| Rain | `WEATHER.rain` | `near` and `far` are separate layers; the parallax between them is what makes the rain read as volume rather than as a texture over the camera. |
| How wet the road looks | `WEATHER.puddle` | `wetness` for how much of it there is, `ripple` for how much the reflection wobbles. Past about `0.006` the ripples stop reading as water and start reading as a funhouse mirror. |
| Glow | `QUALITY.bloom` | These are **linear** numbers, not screen colours. See the note in `postfx.js` — this catches everybody. |
| Light levels | `LIGHTS` | The colours here are much lighter than they look. See the note in `config.js`. |
| Camera | `CAMERA` | `start` and `target` frame the default view. |

---

## Checking it

```
node tools/check_scene.js
```

No browser, no `npm install`, no dependencies. Exit code 0 means clean. It proves
the things a screenshot cannot: that every module resolves, that nothing is
orphaned, that the vendored three.js is a complete matched pair, that all 43
required elements are built, and — the one that matters — that **every config key
referenced anywhere in `js/` actually exists in `config.js`**.

That last check is not theoretical. Twice while building this, a key was
misspelled (`CAMERA.minPolar` read as `CAMERA.minPolarAngle`), which fed `NaN`
into OrbitControls, which made the camera position `NaN`, which made every vertex
project to `NaN` — producing a perfectly black frame, no error in the console, and
no clue at all as to why.

It cannot see the render, so it says nothing about how the scene looks. What it
also does not check is written down in `PRD.md` rather than left implied.

---

## How it is put together

Fourteen modules under `js/`, ES modules throughout, wired together in `main.js`.

```
index.html      structure and the import map; no styling, no logic
styles/         the whole stylesheet, including the failure notice
vendor/three/   three.js 0.186.1, vendored so the page works offline
js/
  config.js     every tunable number, in one place, importing nothing
  toon.js       the cel-shading look: gradient ramp, materials, ink contour
  textures.js   procedural surfaces — asphalt, paving, concrete, the puddle mask
  signage.js    everything with letters or a logo on it
  lights.js     the light rig, the fog, and the sky
  ground.js     plinth, streets, pavement, markings
  store.js      the building: shell, roof plant, glazing, signs, awning, doors
  interior.js   everything you see through the glass
  props.js      everything on the street that is not the shop
  weather.js    rain, splashes, drips, runoff, steam
  reflection.js the wet road
  postfx.js     bloom and grade
  anim.js       doors, flicker, signals
  main.js       bootstrap and the render loop
tools/
  check_scene.js
```

Imports run one way only. The system modules — `toon`, `lights`, `textures`,
`reflection`, `postfx` — own resources that others consume, and never import the
things that consume them, which is what keeps `main.js` a short wiring file
instead of a hub everything reaches through.

`PRD.md` is the place to look for *why* something is the way it is: every decision
that was not obvious, the four bugs that cost real time, and everything known to
be missing.
