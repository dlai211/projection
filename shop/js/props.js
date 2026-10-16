/**
 * props.js — everything on the street that is not the shop or the road.
 *
 * Two jobs beyond just filling the pavement:
 *
 *   - The vending machine is the second brightest thing in the frame and the
 *     only cold light in it. It is the accent that keeps the warm shop and the
 *     cool night from being the whole palette.
 *
 *   - The utility pole is the tallest thing in the scene by a wide margin, and
 *     the wires crossing the frame are what give the composition a vertical.
 *     Without them the shot is a low, flat band of buildings. The wires sag —
 *     a straight line between two poles is an instant tell to anyone who has
 *     ever looked up in Japan.
 */

import * as THREE from 'three';
import { STORE, PALETTE, STREET, OUTLINE, LAYERS, MOTION, LEVELS, FURNITURE } from './config.js';
import { toon, roundedBox, addOutline } from './toon.js';
import { concrete, paving } from './textures.js';
import { poster, roadSign } from './signage.js';

const SOUTH = STORE.z1;
const WEST = STORE.x0;

export function buildProps() {
  const group = new THREE.Group();
  group.name = 'props';

  const metal = toon({ color: PALETTE.metal });
  const darkMetal = toon({ color: PALETTE.darkMetal });
  const concreteMat = toon({ color: PALETTE.concrete, map: concrete() });

  const put = (mesh, name, outline = true, tier = OUTLINE.detail) => {
    mesh.name = name;
    if (outline) addOutline(mesh, { thickness: tier, color: 0x0d0f18 });
    group.add(mesh);
    return mesh;
  };

  /**
   * Every pole, mast and sign on this corner is placed from `FURNITURE` rather
   * than from a number written here.
   *
   * That is not tidiness. The two utility poles used to carry their own
   * coordinates — z = 10.2, in the middle of the carriageway — while the table
   * in config.js said 12.2, so `tools/check_scene.js` was cheerfully reporting
   * that no street furniture stood in the road. It was checking a table the
   * scene did not read. One source of truth, or the check is theatre.
   */
  const F = (id) => {
    const item = FURNITURE.find((f) => f.id === id);
    if (!item) throw new Error(`props.js wants a FURNITURE entry called "${id}"`);
    return item;
  };

  /* ----------------------------------------------------- neighbouring block */

  // Closes the street frontage to the east, so the shop is a corner rather than
  // a building in a field. Kept dark and plain — it must not compete.
  const n = STORE.neighbour;
  const neighbour = new THREE.Mesh(
    roundedBox(n.x1 - n.x0, n.wall, n.z1 - n.z0, 0.02),
    toon({ color: 0x4a5266, map: concrete() }),
  );
  neighbour.position.set((n.x0 + n.x1) / 2, n.wall / 2, (n.z0 + n.z1) / 2);
  put(neighbour, 'neighbourBlock', true, OUTLINE.hero);

  // A few dim windows, so it does not read as a car park wall. The columns are
  // derived from the building's own width rather than stepped off its corner:
  // they used to run at 1.6 m intervals from x0 + 1.2, and the fourth column
  // landed at x = 13 — exactly the east face — so two windows hung in the air
  // off the side of the building, which is how they appear in the default view.
  const dimWin = toon({ color: 0x2a3040, emissive: 0x6a5a3a, emissiveIntensity: 0.22 });
  const cols = 4;
  const columnX = (i) => n.x0 + 0.5 + ((n.x1 - n.x0 - 1.0) * (i + 0.5)) / cols;

  for (let floor = 0; floor < 3; floor++) {
    for (let i = 0; i < cols; i++) {
      if ((floor * cols + i) % 3 === 0) continue;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), dimWin);
      win.position.set(columnX(i), 1.5 + floor * 1.9, n.z1 + 0.011);
      win.userData.noOutline = true;
      group.add(win);
    }
  }

  /**
   * The other two faces.
   *
   * Only the street frontage was ever detailed, so the wall the delivery yard
   * and the alley actually look at was six metres of nothing — and since
   * nothing back there was lit either, the whole back lot came out black. A
   * building that has stopped being drawn the moment you walk round it is the
   * single most common way a diorama gives itself away.
   */
  const backZ = n.z0 - 0.011; // faces the yard
  const sideX = n.x0 - 0.011; // faces the alley
  const litWin = toon({ color: 0x2a3040, emissive: 0xffcf8a, emissiveIntensity: 0.55 });
  const darkWin = toon({ color: 0x252b3a, emissive: 0x6a5a3a, emissiveIntensity: 0.18 });

  // A corridor run: one window in four lit. A wall where every window is lit
  // is a rendering; a wall where none are is a wall.
  const backCols = 3;
  const backX = (i) => n.x0 + 1.0 + ((n.x1 - n.x0 - 2.0) * i) / (backCols - 1);
  for (let floor = 0; floor < 3; floor++) {
    for (let i = 0; i < backCols; i++) {
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62, 0.8),
        (floor * backCols + i) % 4 === 1 ? litWin : darkWin,
      );
      win.position.set(backX(i), 1.9 + floor * 1.8, backZ);
      win.rotation.y = Math.PI; // the plane faces +z by default
      win.userData.noOutline = true;
      group.add(win);
    }
  }
  for (let floor = 0; floor < 3; floor++) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.8), floor === 1 ? litWin : darkWin);
    win.position.set(sideX, 1.9 + floor * 1.8, -5.4);
    win.rotation.y = -Math.PI / 2;
    win.userData.noOutline = true;
    group.add(win);
  }

  // Downpipes. Two on the back wall, one down the alley side, each with the
  // shoe at the bottom that kicks the water clear of the wall.
  const pipeMat = toon({ color: 0x6d7583 });
  const downpipe = (x, z, outX, outZ) => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 5.9, 8), pipeMat);
    pipe.position.set(x, 2.95, z);
    // No contour: a 7.5 cm tube with a hull offset self-intersects into a smear.
    pipe.userData.noOutline = true;
    group.add(pipe);

    const shoe = new THREE.Mesh(roundedBox(0.15, 0.15, 0.36, 0.04), pipeMat);
    shoe.position.set(x + outX * 0.17, 0.13, z + outZ * 0.17);
    if (!outZ) shoe.rotation.y = Math.PI / 2;
    shoe.userData.noOutline = true;
    group.add(shoe);
  };
  downpipe(7.4, backZ - 0.1, 0, -1);
  downpipe(12.6, backZ - 0.1, 0, -1);
  downpipe(sideX - 0.1, 2.5, -1, 0);

  // Two condensers on wall brackets — the thing that hangs off the back of
  // every building in the country, and what gives this wall a middle distance
  // for the bulkhead lamp to pick out.
  for (const [cx, cy] of [[9.5, 2.8], [11.4, 4.5]]) {
    const body = new THREE.Mesh(roundedBox(0.86, 0.62, 0.36, 0.03), toon({ color: 0xa4acba }));
    body.position.set(cx, cy, n.z0 - 0.24);
    addOutline(body, { thickness: OUTLINE.detail, color: 0x1a1c29 });
    group.add(body);

    const grille = new THREE.Mesh(new THREE.CircleGeometry(0.21, 16), toon({ color: 0x3a4152 }));
    grille.position.set(cx, cy, n.z0 - 0.43);
    grille.rotation.y = Math.PI;
    grille.userData.noOutline = true;
    group.add(grille);

    for (const dx of [-0.3, 0.3]) {
      const leg = new THREE.Mesh(roundedBox(0.06, 0.06, 0.42, 0.02), darkMetal);
      leg.position.set(cx + dx, cy - 0.34, n.z0 - 0.2);
      leg.userData.noOutline = true;
      group.add(leg);
    }
  }

  /* --------------------------------------------------------- vending machine */

  // The hero prop and the only cold light outside the shop.
  const vendingAt = (x, z, rotationY = 0) => {
    const machine = new THREE.Group();
    machine.position.set(x, 0, z);
    machine.rotation.y = rotationY;

    const body = new THREE.Mesh(roundedBox(1.0, 1.85, 0.72, 0.025), toon({ color: PALETTE.vendingRed }));
    body.position.y = 0.925;
    addOutline(body, { thickness: OUTLINE.hero, color: 0x0d0f18 });
    machine.add(body);

    // The lit front: a bright panel, which is what makes the machine glow.
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.84, 1.15),
      toon({ color: 0xffffff, emissive: PALETTE.vendingGlow, emissiveIntensity: 0.95 }),
    );
    face.position.set(0, 1.2, 0.365);
    face.userData.noOutline = true;
    machine.add(face);

    // Rows of cans behind the glass, in colour.
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 5; i++) {
        const can = new THREE.Mesh(
          new THREE.BoxGeometry(0.11, 0.16, 0.06),
          toon({ color: PALETTE.product[(row * 5 + i) % PALETTE.product.length], emissive: 0xffffff, emissiveIntensity: 0.25 }),
        );
        can.position.set(-0.32 + i * 0.16, 0.86 + row * 0.24, 0.35);
        can.userData.noOutline = true;
        machine.add(can);
      }
    }

    // The coin slot and the delivery flap.
    const panel = new THREE.Mesh(roundedBox(0.86, 0.3, 0.06, 0.02), toon({ color: 0x2b3141 }));
    panel.position.set(0, 1.95, 0.35);
    machine.add(panel);
    const flap = new THREE.Mesh(roundedBox(0.6, 0.24, 0.08, 0.02), darkMetal);
    flap.position.set(0, 0.42, 0.36);
    machine.add(flap);

    group.add(machine);
    return machine;
  };

  vendingAt(8.4, STORE.z1 + 0.5);
  vendingAt(9.5, STORE.z1 + 0.5);

  /* ---------------------------------------------------------------- lamp */

  // The pole and head; the light itself lives in lights.js so anim.js can drive
  // it without reaching into geometry.
  const lamp = F('streetLamp');
  const lampZ = lamp.z;
  const lampX = lamp.x;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 4.4, 10), metal);
  pole.position.set(lampX, 2.2, lampZ);
  put(pole, 'lampPost', true, OUTLINE.hero);

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), metal);
  arm.rotation.x = Math.PI / 2.6;
  arm.position.set(lampX, 4.35, lampZ + 0.38);
  group.add(arm);

  const head = new THREE.Mesh(roundedBox(0.42, 0.14, 0.66, 0.05), darkMetal);
  head.position.set(lampX, 4.56, lampZ + 0.72);
  put(head, 'lampHead');
  const bulb = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.03, 0.56),
    toon({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 1.5 }),
  );
  bulb.position.set(lampX, 4.48, lampZ + 0.72);
  bulb.userData.noOutline = true;
  group.add(bulb);

  /* --------------------------------------------------------- utility pole */

  // The tallest thing here by a long way, and the one that gives the frame its
  // vertical. Straight out of the ground, no taper — these are concrete.
  // On the far side of the main street. It used to stand on the corner
  // pavement, which put a pole with a transformer box on it directly between
  // the default camera and the shop's glazing.
  const poleA = F('utilityPoleA');
  const poleX = poleA.x;
  const poleZ = poleA.z;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 9.2, 12), concreteMat);
  trunk.position.set(poleX, 4.6, poleZ);
  put(trunk, 'utilityPole', true, OUTLINE.hero);

  // A second pole along the same side, so every span has somewhere to arrive.
  const pole2X = F('utilityPoleB').x;
  const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 8.6, 12), concreteMat);
  pole2.position.set(pole2X, 4.3, poleZ);
  put(pole2, 'utilityPole2', true, OUTLINE.hero);

  // Cross-arms and a transformer.
  for (const [x, top] of [[poleX, 8.5], [pole2X, 7.9]]) {
    for (const [y, len] of [[top - 0.9, 1.9], [top - 0.15, 1.5]]) {
      const armBar = new THREE.Mesh(roundedBox(len, 0.09, 0.09, 0.02), darkMetal);
      armBar.position.set(x, y, poleZ);
      put(armBar, 'poleArm');
      for (const side of [-1, 1]) {
        const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 8), toon({ color: 0x6b7280 }));
        insulator.position.set(x, y + 0.12, poleZ + side * len * 0.36);
        group.add(insulator);
      }
    }
  }
  // The transformer sits high on the pole. At head height it read as part of a
  // pillar standing in the way of the shopfront.
  const transformer = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.7, 12), darkMetal);
  transformer.position.set(poleX + 0.42, 6.9, poleZ);
  put(transformer, 'transformer');

  /* --------------------------------------------------------------- wires */

  // Sagging, because a straight line between two poles is the single clearest
  // sign that nobody looked up while making the scene.
  const wireCurve = (from, to, sag) => {
    const points = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const p = new THREE.Vector3().lerpVectors(from, to, t);
      // A shallow parabola: the real shape is a catenary, but at this sag the
      // difference is not visible.
      p.y -= sag * 4 * t * (1 - t);
      points.push(p);
    }
    return new THREE.CatmullRomCurve3(points);
  };

  const wireMaterial = toon({ color: 0x1b1f2a });
  // Brackets bolted to real surfaces, so no span simply stops in mid air, which
  // is what all four of them used to do past the edge of the plinth.
  const bracketX = 10.6;
  const bracket = new THREE.Mesh(roundedBox(0.12, 0.5, 0.12, 0.02), darkMetal);
  bracket.position.set(bracketX, 6.1, n.z1 + 0.06);
  put(bracket, 'wallBracket');

  /**
   * Three spans, and every one of them lands on something real: the two poles
   * and the neighbour's wall. There used to be a fourth, running west from the
   * pole to a bracket bolted to nothing at the plinth's edge — a wire
   * terminating in mid air over the junction, which is the exact tell the
   * brackets were added to avoid.
   */
  const spans = [
    { from: new THREE.Vector3(poleX, 8.5, poleZ), to: new THREE.Vector3(pole2X, 7.9, poleZ), sag: 0.34 },
    { from: new THREE.Vector3(poleX, 8.05, poleZ), to: new THREE.Vector3(pole2X, 7.45, poleZ), sag: 0.28 },
    { from: new THREE.Vector3(pole2X, 7.6, poleZ), to: new THREE.Vector3(bracketX, 6.1, n.z1 + 0.06), sag: 0.22 },
  ];
  for (const span of spans) {
    const wire = new THREE.Mesh(new THREE.TubeGeometry(wireCurve(span.from, span.to, span.sag), 20, 0.028, 5, false), wireMaterial);
    // No contour: a 3 cm tube with a hull offset self-intersects and turns into
    // a black smear, and at this size the dark material already reads as a line.
    wire.userData.noOutline = true;
    group.add(wire);
  }

  /* --------------------------------------------------------------- bins */

  // The recycling trio by the door, with one lid ajar, because a row of three
  // identical closed bins reads as CAD.
  const binColours = [0x3f6fb5, 0xb5a13f, 0xb55a3f];
  for (let i = 0; i < 3; i++) {
    const bin = new THREE.Mesh(
      roundedBox(0.42, 0.66, 0.42, 0.03),
      toon({ color: binColours[i] }),
    );
    bin.position.set(-6.3, 0.33, -0.6 - i * 0.5);
    put(bin, `bin-${i}`);
    const lid = new THREE.Mesh(roundedBox(0.44, 0.05, 0.44, 0.02), darkMetal);
    lid.position.set(-6.3, 0.68, -0.6 - i * 0.5);
    // The middle one sits ajar.
    lid.rotation.z = i === 1 ? 0.14 : 0;
    group.add(lid);
  }

  /* -------------------------------------------------------- umbrella stand */

  // Out on the pavement. It used to sit at x = -4.65, which is INSIDE the shop
  // — the interior starts at -4.75 — so the stand and its umbrellas were
  // planted in the middle of the sales floor.
  const standX = WEST - 0.62;
  const standZ = SOUTH - 2.3;
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.52, 14), toon({ color: 0x8f97a8 }));
  stand.position.set(standX, 0.26, standZ);
  put(stand, 'umbrellaStand');
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 6, 16), toon({ color: 0xb9c0cd }));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(standX, 0.52, standZ);
  rim.userData.noOutline = true;
  group.add(rim);

  // Four furled umbrellas: clearly their own objects, not a smudge.
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.4;
    const umbrella = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.052, 1.0, 6),
      toon({ color: [0x3f5f8f, 0x8f3f4f, 0x3f7f6f, 0x6f5f8f][i] }),
    );
    umbrella.position.set(standX + Math.cos(angle) * 0.07, 0.94, standZ + Math.sin(angle) * 0.07);
    umbrella.rotation.z = Math.cos(angle) * 0.16;
    umbrella.rotation.x = Math.sin(angle) * 0.16;
    umbrella.userData.noOutline = true;
    group.add(umbrella);
  }

  /* ------------------------------------------------------------- bicycle */

  // Leaning a few degrees off the wall, which is what bicycles do.
  const bike = new THREE.Group();
  bike.position.set(STORE.x1 + 1.4, 0, SOUTH + 0.7);
  bike.rotation.y = -0.16;
  bike.rotation.z = 0.09;
  const frameMaterial = toon({ color: 0x2f5f8f });
  for (const dz of [-0.55, 0.55]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 6, 20), darkMetal);
    wheel.position.set(0, 0.33, dz);
    wheel.rotation.y = Math.PI / 2;
    bike.add(wheel);
  }
  for (const [y, z, len, rot] of [[0.62, 0, 1.0, Math.PI / 2], [0.62, -0.2, 0.55, 0.5], [0.55, 0.42, 0.5, -0.6]]) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 6), frameMaterial);
    tube.position.set(0, y, z);
    tube.rotation.x = rot;
    bike.add(tube);
  }
  const basket = new THREE.Mesh(roundedBox(0.32, 0.22, 0.26, 0.02), toon({ color: 0x9aa3b4 }));
  basket.position.set(0, 0.82, 0.5);
  bike.add(basket);
  const saddle = new THREE.Mesh(roundedBox(0.11, 0.06, 0.24, 0.02), darkMetal);
  saddle.position.set(0, 0.92, -0.34);
  bike.add(saddle);
  group.add(bike);

  /* ------------------------------------------------------------ guardrail */

  // Along the corner, which is where one actually goes.
  const railMaterial = toon({ color: 0xc9ced9 });
  const railZ = STREET.main.z0 - 0.42;
  const railRun = (from, to) => {
    const length = to - from;
    if (length < 0.8) return;
    for (let x = from; x <= to + 0.01; x += 0.72) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.78, 8), railMaterial);
      post.position.set(x, 0.39, railZ);
      group.add(post);
    }
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, length, 8), railMaterial);
    rail.rotation.z = Math.PI / 2;
    rail.position.set((from + to) / 2, 0.72, railZ);
    // No contour on a thin tube: a hull offset self-intersects at this radius
    // and turns the rail into a black smear.
    rail.userData.noOutline = true;
    group.add(rail);
  };
  // ONE short run, on the pavement, east of the shop's crossing.
  //
  // There used to be a second run starting at x = -12.2. The side street
  // occupies x = -13..-7, so that run began in the middle of the carriageway
  // and carried on across the side street's own crossing — a fence down the
  // centre of a road, which is exactly as wrong as it sounds. Street furniture
  // goes on the pavement, and both crossing mouths stay clear.
  railRun(STREET.crosswalk.x1 + 0.9, 4.4);

  // The blue disc that used to stand here was a placeholder; the three real
  // plates are built further down, each in the place a driver looks for it.

  /* -------------------------------------------------------- notice board */

  const board = new THREE.Mesh(roundedBox(1.5, 1.0, 0.08, 0.02), toon({ color: 0x3d4a3a }));
  board.position.set(11.2, 1.35, STORE.z1 + 0.6);
  put(board, 'noticeBoard', true, OUTLINE.hero);
  for (let i = 0; i < 3; i++) {
    const map = poster(i);
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(0.38, 0.52),
      toon({ color: 0xffffff, map, emissive: PALETTE.signGlow, emissiveMap: map, emissiveIntensity: 0.16 }),
    );
    sheet.position.set(10.68 + i * 0.44, 1.42, STORE.z1 + 0.645);
    sheet.rotation.z = (i - 1) * 0.03;
    sheet.userData.noOutline = true;
    group.add(sheet);
  }
  for (const dx of [-0.6, 0.6]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8), darkMetal);
    leg.position.set(11.2 + dx, 0.45, STORE.z1 + 0.6);
    group.add(leg);
  }

  /* --------------------------------------------------- air-con condensers */

  // On the shop's east wall, in the alley. Seen by nobody except the camera,
  // which is exactly why they are worth having.
  for (let i = 0; i < 2; i++) {
    const unit = new THREE.Mesh(roundedBox(0.22, 0.55, 0.78, 0.02), toon({ color: 0xb9bfcc }));
    unit.position.set(STORE.x1 + 0.16, 0.55 + i * 0.95, STORE.z0 + 2.0);
    put(unit, `condenser${i}`);
    const grill = new THREE.Mesh(new THREE.CircleGeometry(0.22, 14), darkMetal);
    grill.rotation.y = Math.PI / 2;
    grill.position.set(STORE.x1 + 0.28, 0.55 + i * 0.95, STORE.z0 + 2.0);
    group.add(grill);
  }

  /* ------------------------------------------------------- traffic signals */

  /**
   * At the junction, where they belong. They used to stand at the far east end
   * of the street, a long way from any traffic they could possibly control.
   *
   * Two heads on one mast, at right angles, because the two streets meet here:
   * one faces back down the side street, one faces back down the one-way. Each
   * hangs over the lane it governs.
   */
  const signal = new THREE.Group();
  signal.name = 'trafficSignals';

  /**
   * A mast, with its head carried out over the lane on an arm. Moving the
   * signal OFF the corner and onto the far side of each approach is both what
   * Japanese junctions actually do and what clears the shop's entrance, which
   * the previous corner mast stood directly in front of.
   */
  const mastAt = (x, z, height) => {
    const base = new THREE.Group();
    base.position.set(x, 0, z);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, height, 10), metal);
    column.position.y = height / 2;
    addOutline(column, { thickness: OUTLINE.hero, color: 0x1a1c29 });
    base.add(column);
    signal.add(base);
    return base;
  };

  const mastMain = F('signalMain');
  const mastSide = F('signalSide');
  mastAt(mastMain.x, mastMain.z, mastMain.post);
  mastAt(mastSide.x, mastSide.z, mastSide.post);

  /**
   * Builds one three-lamp head, hung under an arm and facing `yaw`.
   *
   * `flip` puts the lamps on the other side of the housing. The arm and the
   * head are built perpendicular to each other, and the handedness of that
   * pair is fixed — so at a junction where the arm has to reach one way and
   * the head has to face the other, the head needs turning round on its own
   * arm. Without it, the main-street head faced east: away from the one-way
   * traffic it exists to stop, and towards the shop.
   */
  const signalHead = (armLength, yaw, height, originX, originZ, flip = false) => {
    const face = flip ? -1 : 1;
    const rig = new THREE.Group();
    rig.position.set(originX, 0, originZ);
    rig.rotation.y = yaw;

    const armBar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, armLength, 8), metal);
    armBar.rotation.z = Math.PI / 2;
    armBar.position.set(armLength / 2, height, 0);
    rig.add(armBar);

    const housing = new THREE.Mesh(roundedBox(1.0, 0.34, 0.2, 0.03), darkMetal);
    housing.position.set(armLength, height - 0.12, 0);
    addOutline(housing, { thickness: OUTLINE.detail, color: 0x1a1c29 });
    rig.add(housing);

    const lamps = {};
    for (const [i, key] of [[0, 'green'], [1, 'amber'], [2, 'red']]) {
      const colour = { green: PALETTE.signalGreen, amber: PALETTE.signalAmber, red: PALETTE.signalRed }[key];
      const lamp = new THREE.Mesh(
        new THREE.CircleGeometry(0.105, 16),
        toon({ color: colour, emissive: colour, emissiveIntensity: 0.08 }),
      );
      lamp.position.set(armLength - 0.3 + i * 0.3, height - 0.12, face * 0.105);
      lamp.userData.noOutline = true;
      rig.add(lamp);
      lamps[key] = lamp;
    }

    // The pedestrian head, lower down and facing across the crossing.
    const pedHousing = new THREE.Mesh(roundedBox(0.22, 0.42, 0.16, 0.02), darkMetal);
    pedHousing.position.set(armLength * 0.25, height - 1.5, 0);
    rig.add(pedHousing);
    const pedLamps = {};
    for (const [i, key] of [[0, 'walk'], [1, 'stop']]) {
      const colour = key === 'walk' ? 0x63d68f : PALETTE.signalRed;
      const lamp = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 0.15),
        toon({ color: colour, emissive: colour, emissiveIntensity: 0.1 }),
      );
      lamp.position.set(armLength * 0.25, height - 1.38 + i * 0.2, face * 0.085);
      lamp.userData.noOutline = true;
      rig.add(lamp);
      pedLamps[key] = lamp;
    }

    signal.add(rig);
    return { lamps, pedLamps };
  };

  // Arm SOUTH over the one-way from the far strip, head turned to face WEST —
  // towards the traffic that is actually coming (the one-way runs west to east).
  const headMainStreet = signalHead(
    mastMain.arm, mastMain.yaw, mastMain.armY, mastMain.x, mastMain.z, mastMain.flip,
  );
  // Arm NORTH over the main street on the far side, head turned to face back up
  // the side street at the traffic arriving at the junction.
  const headSideStreet = signalHead(
    mastSide.arm, mastSide.yaw, mastSide.armY, mastSide.x, mastSide.z, mastSide.flip,
  );

  group.add(signal);

  /* ------------------------------------------------------------ road signs */

  /**
   * Three plates on posts, each where a driver would actually look for it:
   * the one-way plate at the mouth of the one-way street, the parking plate
   * beside the bays, and the 止まれ triangle at the stop line.
   */
  const signPlate = (x, z, height, yaw, kind, size = 0.62, plateRotation = 0) => {
    const rig = new THREE.Group();
    rig.position.set(x, 0, z);
    rig.rotation.y = yaw;

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, height, 8), metal);
    post.position.y = height / 2;
    addOutline(post, { thickness: OUTLINE.detail, color: 0x1a1c29 });
    rig.add(post);

    const map = roadSign(kind);
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, 0.035),
      toon({ color: 0xffffff, map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.22 }),
    );
    plate.position.y = height - size / 2 - 0.06;
    plate.rotation.z = plateRotation;
    plate.name = `roadSign:${kind}`;
    addOutline(plate, { thickness: OUTLINE.detail, color: 0x1a1c29 });
    rig.add(plate);

    group.add(rig);
    return rig;
  };

  // All three stand on the PAVEMENT, none in a carriageway and none on a
  // crossing. Two of them used to be: the one-way plate was planted in the
  // middle of the side street, and on the crossing at that.
  //
  // 一方通行 — on the shop's pavement, facing WEST down the one-way, which is
  // the direction its traffic arrives from.
  const signOne = F('signOneway');
  signPlate(signOne.x, signOne.z, signOne.post, signOne.yaw, 'oneway');
  // P — beside the parallel bays. It faced north, into the block, so a driver
  // on the one-way saw it edge-on; it now faces west like the one-way plate.
  const signPark = F('signParking');
  signPlate(signPark.x, signPark.z, signPark.post, signPark.yaw, 'parking', 0.56);
  // 止まれ — at the yard mouth, turned to face back into the yard at the
  // driver about to pull out onto the side street. `plateRotation` keeps the
  // triangle point-down: it is a Japanese stop sign, not a warning triangle.
  const signHalt = F('signStop');
  signPlate(signHalt.x, signHalt.z, signHalt.post, signHalt.yaw, 'stop', 0.62, Math.PI);

  /* ------------------------------------------------------- alley interior */

  // A dark slot between the shop and the neighbour: it has to read as a way
  // through, so it gets a floor, a wall and almost no light.
  const alleyFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(STORE.alley.x1 - STORE.alley.x0, STORE.alley.z1 - STORE.alley.z0),
    toon({ color: 0x2b3040, map: paving() }),
  );
  alleyFloor.rotation.x = -Math.PI / 2;
  alleyFloor.position.set(
    (STORE.alley.x0 + STORE.alley.x1) / 2,
    LEVELS.alley,
    (STORE.alley.z0 + STORE.alley.z1) / 2,
  );
  alleyFloor.userData.noOutline = true;
  alleyFloor.layers.set(LAYERS.NO_REFLECT);
  group.add(alleyFloor);

  return {
    group,
    signal: {
      main: headMainStreet,
      side: headSideStreet,
      cycle: MOTION.signal,
    },
  };
}
