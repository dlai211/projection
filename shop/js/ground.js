/**
 * ground.js — the display plinth, the two streets, the pavement, and everything
 * painted on them.
 *
 * The plinth is a first-class object here, not an afterthought. It is where the
 * "collectible model" read lives: three stacked slabs with a chamfer between
 * them, so the edge catches a line of light all the way round and the base reads
 * as a purpose-made stand rather than as a slice of ground. Nothing is ever
 * placed outside it, and there is no ground plane beyond it — the model has to
 * float in the void or the illusion dies instantly.
 *
 * The kerbs are real geometry, not a painted line: the pavement blocks are boxes
 * sitting 13 cm proud of the asphalt, so the road is a genuine recess with
 * genuine vertical faces. That is what catches the light along every kerb, and it
 * is also what the wet layer reflects against.
 *
 * The road markings follow the order a real street uses, which matters more than
 * it sounds: dashed centre line, then a solid stop line, then the crossing. A
 * dashed line running through a zebra crossing is the single clearest sign that
 * nobody checked.
 */

import * as THREE from 'three';
import { BASE, STREET, PALETTE, PLAN, LAYERS, LEVELS } from './config.js';
import { toon, addOutline, roundedBox } from './toon.js';
import { asphalt, paving, concrete } from './textures.js';
import { parkingSign, roadArrow } from './signage.js';

/** How high the road surface sits below the pavement. */
export const ROAD_Y = STREET.y;

/** The pavement is cut away here for the crossing, with a ramp down to the road. */
const KERB_CUT = STREET.kerbCut;

function rectMesh(rect, y, thickness, material, name) {
  const width = rect.x1 - rect.x0;
  const depth = rect.z1 - rect.z0;
  const mesh = new THREE.Mesh(roundedBox(width, thickness, depth, 0.01), material);
  mesh.position.set((rect.x0 + rect.x1) / 2, y - thickness / 2, (rect.z0 + rect.z1) / 2);
  mesh.name = name;
  return mesh;
}

/**
 * Pavement needs its own texture repeat per rectangle. A 20x2 m strip and a
 * 20x16 m block sharing one repeat setting stretch the slab grid into long
 * wood-grain streaks on whichever one they do not suit.
 */
function pavingFor(width, depth, tone) {
  const map = paving().clone();
  map.needsUpdate = true;
  map.repeat.set(Math.max(1, width / 1.6), Math.max(1, depth / 1.6));
  return toon({ color: tone ?? 0xffffff, map });
}

/** Painted lines: flat, scuffed, never outlined. */
function marking(width, depth, x, z, y = LEVELS.marking, material = null) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.004, depth),
    material ?? paintMaterial,
  );
  mesh.position.set(x, y - 0.002, z);
  mesh.userData.noOutline = true;
  return mesh;
}

const paintMaterial = toon({
  color: PALETTE.paint,
  // Road paint has to survive a much darker night than it used to. A little
  // self-illumination keeps the zebra and the stop lines legible without
  // letting them glow.
  emissive: PALETTE.paint,
  emissiveIntensity: 0.3,
});

export function buildGround() {
  const group = new THREE.Group();
  group.name = 'ground';

  /* ------------------------------------------------------ display plinth -- */

  // Three stacked slabs, each slightly smaller than the one below, with a thin
  // bright rim between them. The layering is what makes the base read as a
  // stand: one solid block of any colour looks like a cut-off piece of ground.
  // The top of the stack stops at -0.15: comfortably below the road surface at
  // -0.13, so nothing here is ever coplanar with anything above it. It used to
  // end at exactly 0.0, which is exactly where the pavement ends.
  const plinthTopY = LEVELS.plinthTop;
  const layers = [
    { size: BASE.size, height: 0.7, tone: 0x191d27, y: -BASE.depth },
    { size: BASE.size - 0.16, height: 0.5, tone: 0x232834, y: -BASE.depth + 0.7 },
    { size: BASE.size - 0.3, height: plinthTopY + BASE.depth - 1.2, tone: 0x2e3442, y: -BASE.depth + 1.2 },
  ];
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const mesh = new THREE.Mesh(
      roundedBox(layer.size, layer.height, layer.size, 0.03),
      toon({ color: layer.tone, map: concrete() }),
    );
    mesh.position.y = layer.y + layer.height / 2;
    mesh.name = `plinthLayer${i}`;
    group.add(mesh);

    // A bright rim along the top edge of each step.
    if (i < layers.length - 1) {
      const rim = new THREE.Mesh(
        roundedBox(layer.size - 0.02, 0.02, layer.size - 0.02, 0.008),
        toon({ color: 0x525a6e }),
      );
      // Sits just BELOW the step, never straddling it: a rim whose top face
      // lands on the next layer's bottom face is another coplanar pair.
      rim.position.y = layer.y + layer.height - 0.014;
      rim.userData.noOutline = true;
      group.add(rim);
    }
  }

  // NO outline on the plinth. An inverted hull on a flat-topped slab puts a
  // back-facing copy of the top face a couple of millimetres above the real
  // one, and the two fight across the entire base. Ground planes are excluded
  // from the outline pass everywhere in this project, and this is why.

  /* --------------------------------------------------------------- road -- */

  const roadMaterial = toon({ color: 0xffffff, map: asphalt() });
  for (const rect of PLAN.roads) {
    const road = rectMesh(rect, ROAD_Y, 0.04, roadMaterial, rect.id);
    road.userData.noOutline = true;
    // The road must not appear in its own reflection.
    road.layers.set(LAYERS.NO_REFLECT);
    group.add(road);
  }

  /* ----------------------------------------------------------- pavement -- */

  const addWalk = (rect, name) => {
    const width = rect.x1 - rect.x0;
    const depth = rect.z1 - rect.z0;
    const walk = rectMesh(rect, 0, Math.abs(ROAD_Y), pavingFor(width, depth), name);
    walk.userData.noOutline = true;
    group.add(walk);
    return walk;
  };

  // The main-street pavement is split either side of the crossing, and the gap
  // is a ramp rather than a step — a crossing that ends in a 13 cm kerb is one
  // nobody can use, and it shows immediately in the render.
  // No west piece: the ramp starts at the corner, because that is also where
  // the side street's crossing lands.
  if (KERB_CUT.x0 - -7 > 0.1) addWalk({ x0: -7, x1: KERB_CUT.x0, z0: 3, z1: 5 }, 'walkMainWest');
  addWalk({ x0: KERB_CUT.x1, x1: 13, z0: 3, z1: 5 }, 'walkMainEast');
  addWalk({ x0: -7, x1: 13, z0: -13, z1: 3 }, 'walkBlock');

  addWalk({ x0: -13, x1: KERB_CUT.x0, z0: 11, z1: 13 }, 'walkFarWest');
  addWalk({ x0: KERB_CUT.x1, x1: 13, z0: 11, z1: 13 }, 'walkFarEast');

  // The two ramps.
  const rampRun = KERB_CUT.x1 - KERB_CUT.x0;
  const rampAngle = Math.atan2(Math.abs(ROAD_Y), 2);
  for (const z of [3.0, 11.0]) {
    const ramp = new THREE.Mesh(
      roundedBox(rampRun, 0.12, 2.06, 0.01),
      pavingFor(rampRun, 2),
    );
    ramp.position.set((KERB_CUT.x0 + KERB_CUT.x1) / 2, ROAD_Y / 2 - 0.02, z + 1);
    ramp.rotation.x = z < 5 ? rampAngle : -rampAngle;
    ramp.name = 'kerbRamp';
    ramp.userData.noOutline = true;
    group.add(ramp);
  }

  /* -------------------------------------------------------- tactile paving -- */

  // The yellow guidance strip. Two long runs along the pavement, and a pad of
  // warning blocks at each end of the crossing, which is where they go.
  const tactile = toon({ color: 0xa88b3c, emissive: 0xa88b3c, emissiveIntensity: 0.03 });
  const strip = (x0, x1, z, width = 0.16) => {
    if (x1 - x0 < 0.3) return;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.012, width), tactile);
    bar.position.set((x0 + x1) / 2, LEVELS.tactile - 0.006, z);
    bar.userData.noOutline = true;
    group.add(bar);
  };

  // A short approach along the pavement to each ramp, and the warning pad on
  // the ramp itself. Nothing longer: at this scale a 20 m strip of it stops
  // reading as guidance and starts reading as a painted lane.
  //
  // There were four strips and there is no pavement west of the kerb cut on
  // the shop's side — that is the side street — so the fourth one lay across
  // the carriageway and printed a yellow band over the side crossing.
  for (const run of STREET.tactile) strip(run.x0, run.x1, run.z);

  for (const z of [3.62, 11.38]) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(rampRun - 0.5, 0.014, 0.4), tactile);
    pad.position.set((KERB_CUT.x0 + KERB_CUT.x1) / 2, LEVELS.tactile - 0.007, z);
    pad.userData.noOutline = true;
    group.add(pad);
  }

  /* -------------------------------------------------------------- gutter -- */

  const gutterMaterial = toon({ color: PALETTE.gutter, map: concrete() });
  const gutters = [
    { x0: -13, x1: KERB_CUT.x0, z0: STREET.main.z0, z1: STREET.main.z0 + 0.34 },
    { x0: KERB_CUT.x1, x1: 13, z0: STREET.main.z0, z1: STREET.main.z0 + 0.34 },
    { x0: -13, x1: 13, z0: STREET.main.z1 - 0.34, z1: STREET.main.z1 },
    { x0: STREET.side.x1 - 0.34, x1: STREET.side.x1, z0: -13, z1: STREET.main.z0 },
  ];
  for (const rect of gutters) {
    const gutter = rectMesh(rect, ROAD_Y + 0.004, 0.03, gutterMaterial, 'gutter');
    gutter.userData.noOutline = true;
    group.add(gutter);
  }
  // Grates, at a regular pitch along the channel.
  for (let x = -11; x < 13; x += STREET.grateEvery) {
    if (x > KERB_CUT.x0 - 1 && x < KERB_CUT.x1 + 1) continue;
    for (const z of [STREET.main.z0 + 0.17, STREET.main.z1 - 0.17]) {
      const grate = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.02, 0.34),
        toon({ color: 0x2a2f3c }),
      );
      grate.position.set(x, LEVELS.grate - 0.01, z);
      grate.userData.noOutline = true;
      group.add(grate);
    }
  }

  /* ------------------------------------------------------------ markings -- */

  /**
   * Two streets with two different jobs, marked accordingly.
   *
   * The front street is ONE WAY with kerbside parking on the shop's side: no
   * centre line, a row of bays outside the shop, and direction arrows down the
   * running lane. The side street is TWO WAY: a solid yellow centre line and a
   * direction arrow in each lane. A dashed centre line down a one-way street,
   * which is what used to be here, is the marking equivalent of a typo.
   */
  const cx0 = STREET.crosswalk.x0;
  const cx1 = STREET.crosswalk.x1;
  const STOP_BACK = 1.8;

  /* -- crossings ---------------------------------------------------------- */

  /**
   * Japanese crosswalk bars run WITH the traffic, not across it: a pedestrian
   * steps over them one at a time, like the rungs of a ladder laid along the
   * road. Both crossings here had it exactly 90 degrees out — the bars ran
   * across the traffic on one and along it on the other, so neither read as a
   * crossing from a car.
   */
  const bar = STREET.crosswalk.bar;
  const pitch = bar + STREET.crosswalk.gap;
  const runLength = 2.8;

  const crossingAcrossX = (centreX, centreZ, count) => {
    for (let i = 0; i < count; i++) {
      const z = centreZ + (i - (count - 1) / 2) * pitch;
      group.add(marking(runLength, bar, centreX, z));
    }
  };
  const crossingAcrossZ = (centreX, centreZ, count) => {
    for (let i = 0; i < count; i++) {
      const x = centreX + (i - (count - 1) / 2) * pitch;
      group.add(marking(bar, runLength, x, centreZ));
    }
  };

  /* -- front street: one way, west to east ------------------------------- */

  /**
   * Direction arrows: flat, painted, one per lane.
   *
   * They used to be built from a box and a cone, which gave them a visible
   * thickness and a contour and made three of them along the shop front read as
   * objects lying in the road rather than as paint. The yaw goes on a parent
   * group because rotating a flat plane about two axes at once is a reliable
   * way to get the arrow pointing somewhere you did not intend.
   */
  const arrowMap = roadArrow();
  const arrowMaterial = toon({
    color: 0xffffff,
    map: arrowMap,
    emissive: 0xffffff,
    emissiveMap: arrowMap,
    emissiveIntensity: 0.3,
    transparent: true,
    side: THREE.DoubleSide,
  });

  const arrow = (x, z, yaw = 0) => {
    const rig = new THREE.Group();
    rig.position.set(x, LEVELS.marking, z);
    rig.rotation.y = yaw;
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.0), arrowMaterial);
    blade.rotation.x = -Math.PI / 2;
    blade.userData.noOutline = true;
    rig.add(blade);
    group.add(rig);
  };

  const laneZ = STREET.parking.z0 + STREET.parking.d + 1.9;
  // One arrow on the whole one-way street, in the middle of the shop frontage.
  arrow(1.6, laneZ, -Math.PI / 2);

  /**
   * Edge lines: the outer boundary of the running lane, on each side of the
   * main street, broken across the crossing.
   *
   * They are NOT the same on both sides. The far kerb runs the main street's
   * whole length, so its line does too. The near kerb does not exist west of
   * the side street's mouth — there the carriageway simply continues north —
   * so an edge line drawn there ran straight across the opening of the junction
   * the line is supposed to be marking the edge of.
   */
  const edgeRuns = {
    near: [[STREET.side.x1, cx0 - STOP_BACK - 0.4], [cx1 + STOP_BACK + 0.4, 13]],
    far: [[-13, cx0 - STOP_BACK - 0.4], [cx1 + STOP_BACK + 0.4, 13]],
  };
  for (const [side, runs] of Object.entries(edgeRuns)) {
    const z = side === 'near' ? STREET.main.z0 + 0.5 : STREET.main.z1 - 0.5;
    for (const [a, b] of runs) {
      if (b <= a) continue;
      group.add(marking(b - a, 0.1, (a + b) / 2, z));
    }
  }

  // The crossing across the one-way: bars run along X, follow the traffic.
  crossingAcrossX((cx0 + cx1) / 2, 8, STREET.crosswalk.stripes);

  /* -- front street: kerbside parking on the shop's side ------------------ */

  const bay = STREET.parking;
  const bayLetter = parkingSign();
  for (let i = 0; i < bay.bays; i++) {
    const x0 = cx1 + bay.first + i * (bay.w + bay.gap);
    const x1 = x0 + bay.w;
    if (x1 > 12.4) break;
    const mid = (x0 + x1) / 2;
    const zc = bay.z0 + bay.d / 2;

    // Outline: two sides and a closed end. The open end faces the traffic.
    group.add(marking(0.1, bay.d, x0, zc));
    group.add(marking(0.1, bay.d, x1, zc));
    group.add(marking(bay.w, 0.1, mid, bay.z0));

    // No wheel stop. A car drives straight in and straight out of a parallel
    // bay; a concrete bar across the end of one makes it unusable.

    // The P, flat, with its top away from the lane so a driver reads it the
    // right way round on the way past.
    const letter = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 1.25),
      toon({ color: 0xffffff, map: bayLetter, emissive: PALETTE.paint, emissiveMap: bayLetter, emissiveIntensity: 0.22, transparent: true }),
    );
    letter.rotation.x = -Math.PI / 2;
    letter.position.set(mid + 0.8, LEVELS.marking, zc);
    letter.userData.noOutline = true;
    group.add(letter);
  }

  /* -- side street: two way ----------------------------------------------- */

  // Solid yellow centre line: the Japanese no-overtaking line, and the clearest
  // possible signal that this street carries traffic both ways.
  const centreMaterial = toon({ color: 0xd8b23c, emissive: 0xd8b23c, emissiveIntensity: 0.22 });
  for (let z = -12.4; z < STREET.crosswalkSide.z0 - 2.2; z += 3.0) {
    const length = Math.min(2.0, STREET.crosswalkSide.z0 - 2.2 - z);
    if (length < 0.5) break;
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.004, length), centreMaterial);
    dash.position.set(STREET.twoWay.centre, LEVELS.marking, z + length / 2);
    dash.userData.noOutline = true;
    group.add(dash);
  }

  // A direction arrow in each lane, pointing the way that lane goes. Japan
  // drives on the left, so traffic heading towards the junction keeps the +x
  // lane and traffic leaving it keeps the -x lane.
  const nearLane = STREET.twoWay.centre + STREET.twoWay.lane;
  const farLane = STREET.twoWay.centre - STREET.twoWay.lane;
  arrow(nearLane, -4.2, Math.PI); // towards the junction
  arrow(farLane, -6.2, 0); // away from it

  // One stop line, in the lane arriving at the junction, 1.6 m short of the
  // crossing. There were two before, and both sat in the middle of the
  // junction box between the two crossings, where nothing stops.
  group.add(marking(2.9, 0.18, nearLane, STREET.crosswalkSide.z0 - 1.6));

  // The side street's crossing: bars run along Z, following ITS traffic.
  crossingAcrossZ(-10, (STREET.crosswalkSide.z0 + STREET.crosswalkSide.z1) / 2,
    STREET.crosswalkSide.stripes);

  // Kerb ramp where that crossing meets the corner.
  const sideRamp = new THREE.Mesh(
    roundedBox(2.1, 0.12, STREET.crosswalkSide.z1 - STREET.crosswalkSide.z0 + 0.4, 0.01),
    pavingFor(2.1, 2),
  );
  sideRamp.position.set(-6.4, ROAD_Y / 2 - 0.02, (STREET.crosswalkSide.z0 + STREET.crosswalkSide.z1) / 2);
  sideRamp.rotation.z = -Math.atan2(Math.abs(ROAD_Y), 2);
  sideRamp.name = 'kerbRampSide';
  sideRamp.userData.noOutline = true;
  group.add(sideRamp);

  /* ------------------------------------------------------------ kerbside -- */

  const kerbMaterial = toon({ color: PALETTE.kerb, map: concrete() });
  const kerbEdges = [
    { w: KERB_CUT.x0 + 7, d: 0.12, x: (-7 + KERB_CUT.x0) / 2, z: STREET.main.z0 - 0.06 },
    { w: 13 - KERB_CUT.x1, d: 0.12, x: (KERB_CUT.x1 + 13) / 2, z: STREET.main.z0 - 0.06 },
    { w: 0.12, d: 16, x: -7.06, z: -5 },
    { w: KERB_CUT.x0 + 13, d: 0.12, x: (-13 + KERB_CUT.x0) / 2, z: STREET.main.z1 + 0.06 },
    { w: 13 - KERB_CUT.x1, d: 0.12, x: (KERB_CUT.x1 + 13) / 2, z: STREET.main.z1 + 0.06 },
  ];
  for (const edge of kerbEdges) {
    if (edge.w <= 0) continue;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(edge.w, 0.02, edge.d), kerbMaterial);
    mesh.position.set(edge.x, LEVELS.kerbEdge - 0.01, edge.z);
    mesh.userData.noOutline = true;
    group.add(mesh);
  }

  return group;
}
