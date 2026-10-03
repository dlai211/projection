# PRD — Feynman Diagram Generator

A browser tool that classifies Standard Model processes and renders tree-level
Feynman diagrams, including hadrons and multi-body decays.

**Status:** v0.3 — independent quark-line rendering shipped for hadron → hadron
transitions. Hadron → two-hadron finals still use the blob rendering (§4).

---

## 1. How to run

The app is a static site with **no build step and no dependencies**.

ES modules are blocked over `file://`, so it must be served over http:

- VS Code: right-click `index.html` → **Open with Live Server**
- or `python -m http.server` from this folder

A preset can be linked directly: `index.html#pion-decay`.

### Test suite

```bash
node --test tests/
```

Uses Node's built-in test runner (Node 18+). No npm install, no third-party
packages. `package.json` exists only to mark the folder as ES modules and to
define the `test` script.

`tests/engine.test.mjs` covers the physics engine; `tests/quarkflow.test.mjs`
covers the quark-flow derivation. `draw.js` and `ui.js` need a real DOM and are
verified by hand in the browser.

---

## 2. Architecture

| File | Responsibility |
|---|---|
| `js/particles.js` | Elementary particles: mass, charge, lepton/baryon number, panel layout data |
| `js/hadrons.js` | Hadron table, valence quark content, masses, `identifyHadron()` |
| `js/vertices.js` | `SM_VERTICES` (fundamental) and `EFFECTIVE_VERTICES` (phenomenological hadron-level) |
| `js/classifier.js` | Engine primitives: lookup, crossing, decay/fusion indices, kinematics, conservation |
| `js/topology.js` | The diagram search — recursive decay-tree enumeration |
| `js/quarkflow.js` | Valence quark flow for hadron → hadron transitions |
| `js/draw.js` | All canvas rendering |
| `js/ui.js` | Particle panel, tabs, results grouping, filter chips, lazy canvas rendering |
| `js/channel.js` | Controller: drop zones, presets, generate |
| `js/directory.js` | Mass tooltips |

`js/main.js`, `js/channel2.js` and `js/tmp.js` are superseded drafts and are not
referenced by anything. Left in place deliberately.

### Two design rules that are easy to get wrong

1. **Only the root of a diagram is on-shell.** Internal lines are virtual
   propagators with unconstrained virtuality, so no mass comparison may be
   applied at an internal vertex. Doing so wrongly deletes `n → p W⁻` (the W is
   80 GeV against a 0.78 MeV energy release) and `Z⁰ → μ⁺μ⁻` with
   bremsstrahlung. Pruning uses `FeynmanEngine.minLeafMass(symbol, budget)`.
2. **Flavour conservation is encoded in the vertex list, not checked globally.**
   `s → u W⁻` is present, so K⁺ → μ⁺νμ works. A global strangeness check would
   break it.

---

## 3. Completed

### v0.1 — elementary baseline
- Left panel of Standard Model particles; drag-and-drop or click into
  initial/final state zones.
- Conservation checks: charge, baryon number, and the three lepton numbers.
- Canvas rendering of 2→2 (s, t, u, contact) and 1→2, 1→3 decays.
- Combinatorial search for all valid processes from a given initial state.

### v0.2 — hadrons, multi-body decays, grouped output
- **Hadrons (26):** p, n, π±/π⁰, K±/K⁰/K̄⁰, η, Λ, Σ±/Σ⁰, Ξ⁰/Ξ⁻, Ω⁻ plus their
  distinct antiparticles, with measured masses, strangeness and valence content.
- **Hadrons tab** in the left panel, with a brace-hint when dragged-in quarks
  form a known hadron.
- **Effective hadronic vertices** so processes like π⁺ → μ⁺νμ, n → p e⁻ν̄e and
  Ω⁻ → ΛK⁻ are findable. Tagged `effective: true` and marked on the card.
- **Direct 1→3 decays** (single-point contact) alongside the cascade form.
- **1→4 decays**, all four tree shapes: linear chain, two-mediator,
  direct-then-decay, decay-then-direct.
- **New search engine.** The old brute force tried every combination of every
  particle (~200,000 searches with 56 particles at 4-body). Replaced with a
  recursive expansion driven by real decay channels: worst case now **26 ms**.
- **Grouped results:** collapsible sections by mediator (switchable to channel
  type or final state), filter chips, summary bar, t/u merging for identical
  finals, lazy canvas rendering, "show more" pagination.
- **Hadron drawing:** thick line into a blob, valence quarks as stubs, curly
  brace carrying the hadron name.
- Responsive CSS; high-DPI canvas rendering.

### v0.2.1 — bug fixes
- **Hadrons tab sectioning.** Mesons, Baryons and Antibaryons are now three
  separate boxed sections with their own headings and tinted icons, matching the
  Elementary tab. Previously one `Hadrons` box held three lightly-labelled
  groups, so Baryons and Antibaryons read as a single continuous list.
  Cause: `hadronCategory()` emitted one `.category` wrapping three
  `.particle-group`s instead of one `.category` per group.
- **Expand / Collapse controls.** "Expand all", "Collapse all" and per-section
  click-to-toggle were all dead. Cause: `renderResults()` reset
  `state.expanded` on *every* call, wiping the flag each handler had just set;
  and the `groupIndex === 0` rule made the first section impossible to collapse
  even after that. The reset now happens only when the result set or the
  grouping changes, and the default-open group is seeded once into the set.
- **Test suite added** (`tests/`, `node --test`).

### v0.3 — independent quark line flow
**Requirement.** A separate line per constituent quark, with the braces kept
around the initial and final states. The active quark routes to the interaction
vertex; spectator quarks flow continuously as parallel lines from the source
bracket to the target bracket.

**Delivered.** For a hadron → single hadron transition the diagram is now drawn
as one line per valence quark running the full width. Spectators pass straight
through; the active quark kinks at the interaction vertex, where the mediator
branches off. Braces group the quarks at each end and carry the hadron names.

```
} n    d ─────────────●─────────── u   } p
       u ─────────────┼─────────── u
       d ─────────────┼─────────── d
                      ╲
                       W⁻ ── e⁻ ν̄e
```

- **Flow is derived**, not declared — `js/quarkflow.js` matches the source
  hadron's valence quarks against the target's. Whatever is unchanged is a
  spectator; whatever is left over is active. Handles every hadron → hadron pair
  in the catalogue, including the antiparticles.
- **An explicit override is supported** and takes precedence. A vertex may carry
  `quarkFlow: { spectator: [['u','u'],['d','d']], active: [['d','u']] }`. It is
  validated against the real quark content first, so stale data degrades to the
  derived answer rather than drawing nonsense.
- **Falls back safely.** Whenever the flow cannot be determined the existing blob
  rendering is used unchanged, so nothing regressed.
- The mediator is sent to whichever side of the rails its vertex is nearer, so
  its line does not cross the other quarks.

**Not yet covered (phase 2).** Hadron → two-hadron finals (Λ → pπ⁻, Ξ⁻ → Λπ⁻,
Ω⁻ → ΛK⁻) have two hadron children and the bookkeeping spans three hadrons; they
still render as blobs. So do transitions where the hadron itself decays on.

---

## 4. Not yet done

### 4.1 Quark lines for hadron → two-hadron finals
Λ → pπ⁻, Ξ⁻ → Λπ⁻, Ω⁻ → ΛK⁻. Three hadrons share the quark bookkeeping and a
q q̄ pair is created at the vertex, so the rails need somewhere to put the meson.
Currently falls back to the blob rendering.

### 4.2 Quark lines where there is no target hadron
π⁺ → μ⁺νμ: both quarks annihilate into the vertex, so there is no target brace to
flow into. Needs a separate design.

---

## 5. Known limitations

- **Proton–proton elastic scattering is not modelled.** There is no
  nucleon–nucleon vertex, and faking one with a single effective vertex would
  not be honest.
- **Free quarks can appear as final states.** `μ⁻ → νμ d ū` is kinematically
  legal in a free-quark model but cannot happen once confinement is accounted
  for (the lightest hadron outweighs the muon). Quark-level channels inside a
  hadronic process are real physics; lone quarks in a final state are an artifact
  of the model.
- **Flavour-neutral mesons cannot be identified from quark content.** π⁰ is the
  superposition (uū − dd̄)/√2 and η is (uū + dd̄ − 2ss̄)/√6, so a single q q̄ pair
  does not determine the particle. The UI reports these as possibilities rather
  than guessing.
- **Quark-level expansion is not attempted.** Hadronisation is not perturbative,
  so hadrons are drawn as blobs with valence content rather than fully dissolved
  into quarks and gluons.
- **2→2 kinematics are not checked.** There is no collider energy input, so √s is
  unknown; applying a mass check would silently delete valid diagrams.

---

## 6. Design decisions

Resolved for v0.3:

1. **Scope** — hadron → single hadron first; multi-hadron finals deferred.
2. **Flow data** — derived from valence content, with a validating per-vertex
   override and a safe fallback.
3. **Layout** — full-width parallel rails with a kink at the interaction vertex.
4. **Fallback** — anything the flow cannot describe keeps the blob rendering.

---

## 7. Workflow

For each issue resolved:

1. Run the test suite: `node --test tests/`
2. Fix any failures.
3. `git add . && git commit -m "<description>" && git push`

Repository: `C:\Users\laiji\VSCode\projection` → `git@github.com:dlai211/projection.git` (branch `main`).

---

## 8. Changelog

| Date | Change |
|---|---|
| 2026-09-29 | v0.2 — hadrons, effective vertices, 1→4 decays, new search engine, grouped output |
| 2026-10-02 | PRD created; quark-line rendering specified |
| 2026-10-02 | v0.2.1 — Hadrons tab sectioned, expand/collapse fixed, test suite added |
| 2026-10-02 | v0.3 — independent quark-line rendering for hadron → hadron transitions |
