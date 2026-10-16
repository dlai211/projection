/**
 * config.js — Every tunable number of the diorama, in one place.
 *
 * The model is built at 1 unit = 1 metre, so the cel-shading, the rain and the
 * camera all agree on scale. Change something here and the whole scene follows.
 *
 * RULE: this file imports nothing and touches no DOM — no three.js, no window,
 * no canvas. It is plain `export const` of numbers, strings and arrays, which is
 * what lets `tools/check_scene.js` read the real module in Node, with no browser
 * and no shim. Colours are stored as hex numbers and turned into THREE.Color by
 * the module that draws them, never here.
 */

/* ------------------------------------------------------------------ base -- */

/**
 * The plinth. Everything is built on its top surface at y = 0 and its sides are
 * visible, which is what makes the scene read as a model on a stand rather than
 * as ground running off to a horizon. Nothing is ever placed outside it.
 */
export const BASE = {
  size: 26,
  half: 13,
  depth: 1.5,
  lip: 0.06, // the top surface is inset, so the edge reads as a lip
  chamfer: 0.05,
};

/* ---------------------------------------------------------------- street -- */

/**
 * Two 6 m streets meet in an L. The main street runs east–west right across the
 * base; the side street comes down from the north and stops dead at it. That
 * stop is the corner the whole composition is built around.
 *
 * Plan, looking down (x to the right, z towards the viewer):
 *
 *      z=-13  ┌─────────────────────────┐
 *             │ back lot / alley        │
 *             │        ┌──────────────┐ │
 *    side     │        │    STORE     │ │  neighbour
 *    street   │        │              │ │  building
 *  x -13..-7  │        └──────────────┘ │  x 7..13
 *             │  pavement               │
 *      z=5    ├─────────────────────────┤
 *             │  main street  z 5..11   │
 *      z=11   ├─────────────────────────┤
 *             │  wall strip             │
 *      z=13   └─────────────────────────┘
 */
export const STREET = {
  y: -0.13, // the road surface, one kerb below the pavement
  kerb: 0.13,
  width: 6,
  walk: 2,
  main: { z0: 5, z1: 11 }, // east–west
  side: { x0: -13, x1: -7 }, // north–south
  laneMark: 0.11,
  gutter: 0.34, // the concrete channel running along every kerb
  grateEvery: 8.5,
  grateSize: 0.6,
  /** Across the one-way street, in front of the shop. */
  crosswalk: { x0: -5.5, x1: -2.7, stripes: 6, bar: 0.45, gap: 0.45 },
  /** Across the two-way side street, along the shop's pavement line. */
  crosswalkSide: { z0: 2.2, z1: 5.0, stripes: 6, bar: 0.45, gap: 0.45 },
  /**
   * Where the kerb is cut away for the crossing, and the ramp that fills it.
   * x0 is the side street's kerb, so nothing on the pavement may be placed west
   * of it at this z — that is carriageway.
   */
  kerbCut: { x0: -7, x1: -2.35 },
  /**
   * The yellow guidance strips.
   *
   * Listed here rather than written inline in ground.js so that they can be
   * checked. The shopfront one ran 3.2 m WEST from the kerb cut, which put a
   * tactile strip across the side street's carriageway and over the side
   * crossing's bars — a guidance strip doing the one thing a guidance strip
   * must never do.
   */
  tactile: [
    { id: 'tactileShopfront', x0: -2.35, x1: 0.85, z: 3.7 },
    { id: 'tactileFarWest', x0: -9.6, x1: -7, z: 11.3 },
    { id: 'tactileFarEast', x0: -2.35, x1: 0.25, z: 11.3 },
  ],
  /** Traffic on the one-way street runs this way. */
  oneWay: { axis: 'x', direction: 1, arrowEvery: 5.2 },
  /** The two-way street's centre line, and which half each direction keeps. */
  twoWay: { centre: -10, lane: 1.5 },
  /**
   * Kerbside parking on the one-way street, on the shop's side of the road.
   * These used to be on the side street, which put them where nothing could see
   * them; a corner shop's short-stay bays belong on its own frontage.
   */
  /**
   * Parallel bays on the shop's side of the one-way street: the long side runs
   * WITH the road, because the running lane is only about 3.5 m and a car
   * cannot nose into a bay across it.
   */
  parking: { z0: 5.2, d: 2.1, w: 5.2, gap: 0.4, first: 0.7, bays: 2 },
};

/* ----------------------------------------------------------------- store -- */

/**
 * The store sits on the inside of the turn. Its south face looks across the main
 * street and its west face looks down the side street; the corner between them
 * is chamfered and the automatic doors sit in the chamfer, so the entrance is
 * visible from both streets at once.
 */
export const STORE = {
  x0: -5,
  x1: 5,
  z0: -7,
  z1: 3,
  wall: 3.4, // wall plate height
  parapet: 0.55,
  band: 1.1, // the illuminated fascia sign above the glazing
  chamfer: 3, // the corner is cut back this far along each face
  glassSill: 0.12,
  glassTop: 2.9,
  mullion: 0.085,
  doorWidth: 2.4,
  doorHeight: 2.35,
  awning: { depth: 2.1, drop: 0.34, thickness: 0.14 },
  /**
   * The entrance mat. 2.6 m across a 2.4 m doorway, not 3.2: at 3.2 it spread
   * wider than the opening it serves and read as a slab rather than a mat.
   */
  mat: { w: 2.4, d: 1.0 },
  /** The neighbouring building, which closes the street frontage to the east. */
  neighbour: { x0: 7, x1: 13, z0: -7, z1: 3, wall: 6.2, floors: 2 },
  /** The gap between the two buildings: the alley entrance off the main street. */
  alley: { x0: 5, x1: 7, z0: -7, z1: 3 },
};

/* ------------------------------------------------------------------ plan -- */

/**
 * The derived rectangles the whole scene is laid out on, in one place, so that
 * ground.js, store.js and props.js cannot disagree about where the pavement is.
 * `x0,x1,z0,z1` are edges, not centres.
 *
 * The two streets are excluded from the pavement by construction: the pavement
 * rects tile everything EXCEPT the road, which is what makes the kerbs real
 * geometry rather than a painted line.
 */
export const PLAN = {
  /** The raised pavement, 13 cm above the road. */
  pavement: [
    { id: 'walk-main', x0: -7, x1: 13, z0: 3, z1: 5 }, // along the main street
    { id: 'walk-block', x0: -7, x1: 13, z0: -13, z1: 3 }, // the whole block behind it
    { id: 'walk-far', x0: -13, x1: 13, z0: 11, z1: 13 }, // across the road
  ],
  /** Where the asphalt is. Everything else is pavement or plinth. */
  roads: [
    { id: 'road-main', x0: -13, x1: 13, z0: 5, z1: 11 },
    { id: 'road-side', x0: -13, x1: -7, z0: -13, z1: 5 },
  ],
  /** The back lot behind the shop, off the side street. */
  backLot: { x0: -7, x1: 13, z0: -13, z1: -7 },
};

/* --------------------------------------------------------------- levels -- */

/**
 * The height of every horizontal surface on the ground, declared once.
 *
 * This exists because of a real bug: the plinth's top layer ended at exactly
 * y = 0.0, which is exactly where the pavement blocks end. Two coplanar
 * horizontal surfaces covering most of the base, and as the camera moved, depth
 * precision flipped between them — the pavement strobed between its own paving
 * texture and the plinth's grey.
 *
 * Nothing here may be within 6 mm of anything else. `tools/check_scene.js`
 * enforces that, so the next layer added has to be given a real gap rather than
 * quietly landing on top of another one.
 */
export const LEVELS = {
  // Every value is the TOP of that surface, in metres. Geometry positions
  // itself from these rather than carrying its own magic number, so the gap
  // between any two of them is checkable.
  plinthTop: -0.15, // bottom of the stack, below everything
  road: -0.13,
  /**
   * The additive reflection layer. Exempt from the minimum-gap rule: it writes
   * no depth and renders last, so it cannot fight with anything. It is listed
   * here anyway because its height still has to be reasoned about.
   */
  wet: -0.1265,
  marking: -0.118, // painted lines
  grate: -0.11,
  pavement: 0, // the raised pavement blocks
  kerbEdge: 0.008,
  tactile: 0.02, // guidance paving
  mat: 0.032,
  alley: 0.044,
  /** The delivery yard at the back, a touch above the pavement. */
  yard: 0.056,
};

/* -------------------------------------------------------------- interior -- */

/**
 * What you see through the glass. Laid out so the eye reads four different
 * depths from the window — counter (near), shelf aisle (middle), drinks cooler
 * (back wall), back-room door (deepest) — because depth is what makes a lit box
 * read as a room.
 */
export const INTERIOR = {
  ceiling: 2.95,
  lightPanel: { rows: 3, cols: 4, x: 1.5, z: 0.42, y: 2.93 },
  shelf: { runs: 3, h: 1.42, depth: 0.62, gap: 1.25, tiers: 4, productsPerTier: 9 },
  cooler: { w: 4.2, h: 2.35, depth: 0.75, doors: 4, x: 0.8, z: -6.4 },
  counter: { w: 3.0, h: 0.95, depth: 0.72, x: 1.6, z: 0.4 },
  oden: { w: 1.1, h: 0.92, x: 3.1, z: 0.4 },
  coffee: { w: 0.62, h: 0.74, x: -0.4, z: 0.3 },
  magazine: { w: 1.5, h: 1.35, x: -3.9, z: -1.2 },
  hotCase: { w: 1.0, h: 0.72, x: 2.4, z: 0.45 },
  backDoor: { w: 0.95, h: 2.05, x: 3.4 },
  locker: { w: 0.9, h: 1.9, x: -4.2, z: -5.6 },
};

/* ------------------------------------------------------------- fixtures -- */

/**
 * Where every fixture inside the shop stands, on the floor plan.
 *
 * Kept here rather than inline in interior.js because the shop has a CHAMFERED
 * corner: the usable floor is not the rectangle, and the 45 degree wall runs
 * along z = x + 5. A case positioned by eye lands through that wall sooner or
 * later — the bento cabinet did exactly that, and stood a quarter of a metre out
 * on the pavement with the automatic doors behind it.
 *
 * `tools/check_scene.js` verifies every one of these against the wall by
 * coordinate, so the next fixture has to be placed somewhere legal.
 */
export const FIXTURES = [
  { id: 'cooler', x: -1.6, z: -6.3, w: 4.2, d: 0.75 },
  { id: 'counter', x: 1.4, z: 1.25, w: 3.0, d: 0.72 },
  { id: 'oden', x: 3.6, z: 1.25, w: 1.1, d: 0.62 },
  { id: 'magazine', x: -3.8, z: -1.2, w: 0.46, d: 1.5 },
  { id: 'lockers', x: -4.2, z: -5.75, w: 0.5, d: 0.9 },
  { id: 'bento', x: 0.4, z: 2.25, w: 1.6, d: 0.62 },
  { id: 'onigiri', x: -1.8, z: 2.13, w: 1.15, d: 0.5 },
];

/**
 * Everything standing in the delivery yard behind the shop.
 *
 * Separate from FIXTURES because the rule they answer to is different: nothing
 * back here is inside the chamfered shop, so what matters is that each one is
 * on the plinth and that none of them intersect — which is exactly what went
 * wrong when the truck reversed into the bicycle shelter.
 */
export const YARD = [
  // The tailgate sits at x = 1.1, and everything on the unloading route lines
  // up with it: the service door on the wall, the hand truck on the ground.
  { id: 'truck', x: -2.0, z: -9.6, w: 4.9, d: 2.0 },
  { id: 'handTruck', x: 1.1, z: -8.9, w: 0.8, d: 1.1 },
  { id: 'empties', x: 3.1, z: -9.3, w: 0.6, d: 0.8 },
  { id: 'cardboard', x: 4.4, z: -9.4, w: 0.9, d: 0.7 },
  { id: 'dumpster', x: -1.6, z: -7.9, w: 1.6, d: 1.0 },
  /**
   * The staff shelter, moved to the far end of the yard.
   *
   * It was at (-5.2, -11.7), which left 0.4 m between its corner and the
   * truck's cab — and the truck's way out to the side street runs straight
   * through x = -4. It now stands against the neighbour building's rear line,
   * 5.9 m clear of the truck and out of the exit lane.
   */
  { id: 'bikeShelter', x: 8.4, z: -11.5, w: 2.7, d: 1.9 },
];

/**
 * Street furniture. None of it may stand in a carriageway or on a crossing —
 * which two of the road signs were doing, one of them planted in the middle of
 * the side street and the other on the crossing itself.
 */
export const FURNITURE = [
  /**
   * The two signal masts.
   *
   * `yaw` turns the arm (built along local +X) and the head (facing local +Z)
   * together; `flip` moves the head to the other side of its own arm, for the
   * case where the head has to face the opposite way from the arm's reach.
   *
   * Both of these were wrong in a way that no coordinate check could see. The
   * single corner mast carried its arm EAST from x = -6.7, so the head ended up
   * at x = -4.5 — half a metre inside the shop. And both poles stood at
   * z = 10.2, in the middle of the carriageway, while this table claimed 12.2,
   * so the "furniture is not in the road" check was passing on a fiction.
   */
  { id: 'signalMain', x: 2.2, z: 11.7, post: 4.6, arm: 2.4, armY: 4.3, yaw: Math.PI / 2, flip: true },
  /**
   * The side-street head is on the FAR pavement too, and that is not a
   * compromise — it is the far-side rule, which is where Japanese signals are
   * mounted so that an approaching driver sees one beyond the junction rather
   * than a pole in their own windscreen.
   *
   * It has been in two wrong places on the shop's side. At (-6.7, 1.4) its arm
   * pointed east, into the building. Moved to (-6.6, 4.2) the arm pointed the
   * right way, but the mast then stood 4.1 m directly in front of the automatic
   * doors, on the exact line a customer walks in along. There is no third spot:
   * an arm can only reach west over the side street from just east of the kerb,
   * and everything just east of that kerb is either the shop, the yard, or the
   * pavement in front of the door.
   *
   * x sits at the east end of the side street's own width so that the head
   * hangs over the ARRIVING lane — left-hand traffic, so southbound traffic
   * keeps x -10..-7 — and so that the mast is not two metres from either
   * standard camera, which it was, filling a third of one of them.
   */
  { id: 'signalSide', x: -7.4, z: 11.9, post: 4.5, arm: 2.4, armY: 4.2, yaw: Math.PI / 2, flip: true },
  { id: 'signOneway', x: -1.0, z: 4.5, post: 2.5, yaw: -Math.PI / 2 },
  { id: 'signParking', x: 5.4, z: 4.5, post: 2.4, yaw: -Math.PI / 2 },
  /**
   * 止まれ, at the yard mouth rather than beside the signal mast. A signalled
   * junction does not carry a stop sign, and the one that was there stood
   * 0.73 m from the mast with both plates at the same height. This one faces
   * back into the yard, at the driver about to pull out onto the side street,
   * which is the one place on this corner where traffic really does have to
   * stop and look.
   */
  { id: 'signStop', x: -6.72, z: -11.9, post: 2.4, yaw: Math.PI / 2 },
  /** On the far pavement. Moving A here takes it out of the road and out of
   *  the middle of the default view, which it was bisecting. */
  { id: 'utilityPoleA', x: -11.8, z: 12.2 },
  { id: 'utilityPoleB', x: 3.5, z: 12.2 },
  { id: 'streetLamp', x: 1.5, z: 4.0 },
];

/* --------------------------------------------------------------- weather -- */

/* --------------------------------------------------------------- weather -- */

export const WEATHER = {
  /** Two layers: the parallax between them is what makes rain read as volume. */
  rain: {
    near: 1600,
    far: 1100,
    box: { x: 40, y: 16, z: 40 },
    /** How far the rain volume leans towards the model rather than the camera. */
    focusBias: 0.55,
    fade: { near: 2.4, far: 60 },
    speed: { near: { min: 17, max: 25 }, far: { min: 12, max: 18 } },
    streak: { near: 0.7, far: 0.34 },
    opacity: { near: 0.46, far: 0.3 },
  },
  wind: { x: -1.5, z: 0.55 },
  splash: { count: 150, life: 0.62, radius: 0.3 },
  /** Drips fall from fixed points along the awning edge, not from the sky. */
  drip: { count: 7, interval: { min: 0.9, max: 3.2 }, fall: 3.1 },
  glass: { streakSpeed: 0.055, opacity: 0.3 },
  /** Steam off the oden pot. Weather, not motion: it is a temperature thing. */
  steam: { count: 24, rise: 0.28, life: 2.6 },
  puddle: {
    scale: 0.16, // world → mask UV, so the mask is fixed to the ground
    ripple: 0.0042, // in reflection-UV space; above ~0.006 it is a funhouse mirror
    fresnel: 2.6,
    wetness: 0.72,
    breathe: 0.03, // the mask edge swells slowly, so puddles are never still
  },
};

/* --------------------------------------------------------------- timing -- */

export const MOTION = {
  /**
   * Doors opening for nobody is uncanny if it happens often. Rare, slow, and —
   * the part that sells it — the doorway spills a soft rectangle of warm light
   * onto the wet road while it is open.
   */
  door: { openFor: 4.2, closedFor: { min: 25, max: 50 }, speed: 1.15, skew: 0.15, chime: true },
  signFlicker: { chance: 0.12, min: 0.06, max: 0.42 },
  interiorFlicker: { chance: 0.04, min: 0.05, max: 0.15 },
  signal: { green: 11, amber: 2.4, red: 9.5 },
  intro: { duration: 3.4, from: 1.55 }, // a slow push-in on load, then it stops
};

/* ---------------------------------------------------------------- light -- */

/**
 * Toon shading bands per gradient-mapped light, so two lights of comparable
 * strength overlap their bands and the flat cel look turns to mush. Budget:
 * one weak cool key, one ambient lift, one warm interior spill that clearly
 * dominates its own region. Everything else that looks like it emits light is
 * an emissive material leaning on bloom, and contributes nothing to shading.
 */
export const LIGHTS = {
  /**
   * These have to be LIGHT colours at a substantial intensity, not the dark
   * night colours they end up looking like. three.js lighting is physically
   * correct: irradiance is multiplied by the surface's albedo and then divided
   * by pi, so a sky colour as dark as the actual sky (linear ~0.02) times any
   * sane intensity lands within a rounding error of zero, and the whole model
   * goes black. The night in this scene comes from the HUE of the light and
   * from what is not lit — never from starving the lights.
   */
  ambient: { sky: 0x6d86bd, ground: 0x232a3c, intensity: 3.6 },
  key: { color: 0x9ab4e0, intensity: 1.75, position: { x: -16, y: 24, z: 13 } },
  interiorSpill: { color: 0xffdfb0, intensity: 46, distance: 16, position: { x: 0, y: 2.3, z: -0.5 } },
  doorway: { color: 0xffe0b0, intensity: 0, distance: 9, position: { x: -3.6, y: 1.4, z: 2.2 } },
  // Above the lamp post, which is at (1.5, 4.0). It was at x = -0.4 — the
  // light and the post that casts it were 1.9 m apart.
  streetLamp: { color: 0xffd9a0, intensity: 16, distance: 15, position: { x: 1.5, y: 4.6, z: 4.0 } },
  /**
   * The yard's bulkhead lamp, which until now was an emissive box and nothing
   * else: it glowed and lit none of the ground under it, so the whole delivery
   * yard came out black. A back lot at night is dim, not unlit.
   */
  bulkhead: { color: 0xffd2a0, intensity: 11, distance: 9, position: { x: 1.1, y: 2.35, z: -7.6 } },
  vending: { color: 0xbfe6ff, intensity: 5, distance: 7, position: { x: 8.6, y: 1.1, z: 3.4 } },
  exposure: 1.14,
  /**
   * Fog is a spice, not a mood. It was 0.017, which put a grey veil over the
   * whole frame and killed the cool/warm separation — the far corner of a 26 m
   * base only wants a few per cent, just enough to sit the model in air.
   */
  fogDensity: 0.0085,
};

/**
 * Render layers. Anything that must not appear in the wet road's reflection
 * goes on NO_REFLECT — both because reflecting itself would feed back, and
 * because a mirrored sky dome is simply wrong.
 */
export const LAYERS = {
  DEFAULT: 0,
  NO_REFLECT: 1,
};

/* -------------------------------------------------------------- quality -- */

export const QUALITY = {
  /**
   * On a 2x display this alone is ~1.8x the frame cost, and at this art style
   * there is nothing to see for it.
   */
  pixelRatioCap: 1.5,
  /** The composer's own buffers are not multisampled unless you ask. */
  msaaSamples: 4,
  reflection: {
    scale: 0.5,
    updateEvery: 1, // 2 is often invisible on a slow orbit and halves the cost
    blur: 3, // vertical taps used to fake roughness on the wet road
  },
  bloom: {
    /**
     * These are LINEAR-luminance numbers, not sRGB. Rendering into the
     * composer's buffer skips tone mapping, so an emissive panel at sRGB
     * #ff5a3c sits at linear ~0.22 — a 0.85 threshold would bloom nothing.
     */
    strength: 0.26,
    radius: 0.22,
    /**
     * Raised from 0.88. At 0.88 the threshold sat BELOW the sign faces' own
     * emissive value, so the fascia and the pylon sign were fully inside the
     * bloom and got haloed into flat cream — the lettering on both was being
     * erased by the pass that was supposed to make them glow. Bloom should pick
     * up what is brighter than white, not everything that is white.
     */
    threshold: 1.12,
    resolution: 0.5, // the whole mip chain lives at a quarter of screen pixels
  },
  grade: { vignette: 0.18, aberration: 0.10, lift: 0.008, contrast: 1.02 },
  anisotropy: true,
};

/* -------------------------------------------------------------- outline -- */

/**
 * Two tiers, not one: uniform line width everywhere is the flat tell. The
 * colour is deliberately not black — pure black at night reads as a hole rather
 * than as ink.
 */
export const OUTLINE = {
  hero: 0.0034, // store shell, vending machine, poles, the big silhouettes
  detail: 0.0021, // interior and small props
  cool: 0x1a1c29, // deep blue-grey ink: pure black at night reads as a hole
  warm: 0x241d28,
};

/* --------------------------------------------------------------- camera -- */

export const CAMERA = {
  fov: 36, // a touch long, the way a model gets photographed
  near: 0.4,
  far: 200,
  // Three-quarter view from the side-street corner, which is the one angle that
  // shows both glazed faces of the shop at once. Aimed at the middle of the
  // plinth, not the middle of the shop, or the near edge falls out of frame.
  start: { x: -13.5, y: 11.5, z: 16.5 },
  target: { x: 0, y: 1.2, z: -0.5 },
  minDistance: 8,
  maxDistance: 54,
  // Named after the OrbitControls properties they feed, so a mismatch is a
  // typo the eye catches rather than a silently undefined value.
  minPolarAngle: 0.1,
  maxPolarAngle: Math.PI / 2 - 0.035, // never quite down to the slab's underside
  panLimit: 4.5, // how far the look-at point may wander, in metres
  damping: 0.058,
  /** Below this horizontal fov a tall narrow window would crop the model. */
  minHorizontalFov: 46,
};

/* -------------------------------------------------------------- palette -- */

/**
 * Two hues do all the work: a warm interior around 35 deg and a cool exterior
 * around 210 deg. Everything else is a desaturated variant of one of those two,
 * plus one accent — the vending machine's cold blue-white. "Layered neon depth"
 * is value separation between near, middle and far, not more colours: the far
 * layer is darkest and most saturated, the near layer is the store, and the
 * store must be the brightest thing in frame by a clear margin.
 */
export const PALETTE = {
  // night, outside — the cool half
  skyZenith: 0x0f1424,
  skyHorizon: 0x1a2238,
  cityGlow: 0x2e2b45, // the warm smear a city leaves on its own clouds
  fog: 0x141a2e,
  asphalt: 0x14171f, // wet asphalt at night is nearly black; the reflection works
  asphaltWorn: 0x232839,
  kerb: 0x3f4557,
  paving: 0x5c6478,
  gutter: 0x353b4a,
  paint: 0xb9c4da,
  concrete: 0x5f6678,
  blockWall: 0x44506a,
  metal: 0x7c8497,
  darkMetal: 0x323848,
  wood: 0x6b4f38,

  // the store
  brandBlue: 0x2a7fe0,
  brandGreen: 0x24b47e,
  brandDeep: 0x10386f,
  signWhite: 0xfff8e7,
  signGlow: 0xfff0d2,
  wall: 0xbcc5d4,
  wallShade: 0x8d96a8,
  mullion: 0x2b3141,
  glass: 0x9fc6d8,

  // inside — the warm half
  interiorLight: 0xffdfb0,
  interiorCool: 0xdff0e6,
  floor: 0xd8cfc0,
  floorTape: 0x4f9fd8,
  shelf: 0xd8d2c4,
  shelfEdge: 0x2f7fc4,
  counter: 0xa8763f,
  counterTop: 0xdfe3ea,
  fridge: 0xdcebfa,
  backRoom: 0x2a2f3d, // the back room is darker, so the doorway reads as a hole
  product: [
    0xd94f43, 0xe89a38, 0x4a99cc, 0x55b673, 0xe8c945,
    0xcc68a0, 0x8168c6, 0xdcd6c8, 0x3a8666, 0xcc4636,
  ],

  // accents
  neonCyan: 0x49d8ff,
  neonAmber: 0xffb454,
  lampWarm: 0xffd9a0,
  vendingRed: 0xd93b34,
  vendingGlow: 0xcfe8ff,
  signalGreen: 0x3ce07a,
  signalRed: 0xff4d4d,
  signalAmber: 0xffc23c,
};

/* ---------------------------------------------------------------- brand -- */

/**
 * An invented shop, so nothing here treads on a real chain's livery. "Aoi" is
 * just the Japanese for blue, which is what the sign is.
 */
export const BRAND = {
  name: 'アオイマート',
  latin: 'AOI MART',
  sub: '24H',
  slogan: 'OPEN 24 HOURS',
};

/* ---------------------------------------------------------------- debug -- */

/**
 * Never visible in the shipped piece — this is a scene with no interface, and
 * it stays that way. `?debug=1` prints the renderer's own counters to the
 * console, which is the only place a number is allowed to appear.
 */
export const DEBUG = {
  counters: false, // ?debug=1
};
