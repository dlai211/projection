/**
 * interior.js — everything you see through the glass.
 *
 * This is the module the piece stands or falls on. A lit box with shelves in it
 * reads as a light box with shelves in it; what makes it read as a ROOM is depth
 * layering and uneven light. Four clearly different distances from the window —
 * counter at ~1 m, shelf aisle at ~2 m, drinks cooler on the back wall at
 * ~3.5 m, and the back-room doorway glowing DARKER at the end — give the eye
 * something to measure, and the depth comes from the light level rather than
 * from the geometry.
 *
 * Two more things do more work than they look like they should:
 *
 *   - The suspended ceiling grid. Recessed rectangular panels in a white grid is
 *     the single most recognisable feature of the inside of a Japanese
 *     convenience store, it is visible through the glass from a low camera, and
 *     it is what makes the interior look bright rather than merely lit.
 *
 *   - Density without objects. There are a few hundred products in here and they
 *     are all plain boxes, merged into one mesh per colour. Sixty items on a
 *     shelf run is a budget decision, not a modelling one.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { INTERIOR, PALETTE, OUTLINE, FIXTURES } from './config.js';
import { toon, roundedBox, addOutline } from './toon.js';
import { poster, shelfCard, backDoorSign } from './signage.js';

/**
 * Merge a pile of boxes into one geometry per colour.
 *
 * mergeGeometries returns null and logs rather than throwing when the inputs
 * disagree — some indexed and some not, or different attribute sets — and a
 * silent null is a hole in the scene rather than an error. So every box is built
 * the same way here and the result is checked.
 */
function mergeBoxes(boxes, material, name) {
  const geometries = boxes.map((b) => {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d);
    if (b.rz) g.rotateZ(b.rz);
    g.translate(b.x, b.y, b.z);
    return g;
  });
  if (geometries.length === 0) return null;

  const merged = mergeGeometries(geometries, false);
  for (const g of geometries) g.dispose();
  if (!merged) throw new Error(`interior: could not merge ${name}`);

  const mesh = new THREE.Mesh(merged, material);
  mesh.name = name;
  mesh.userData.noOutline = true;
  return mesh;
}

export function buildInterior(bounds) {
  const group = new THREE.Group();
  group.name = 'interior';

  // Positions come from config.FIXTURES rather than being written inline, so
  // tools/check_scene.js is checking the numbers the scene is actually built
  // from and not a copy of them.
  const at = (id) => FIXTURES.find((f) => f.id === id);

  const { x0, x1, z0, z1 } = bounds;
  const midX = (x0 + x1) / 2;
  const midZ = (z0 + z1) / 2;
  // Visible through the glass, so it must not be culled as a whole when only
  // part of the shop is on screen.
  group.frustumCulled = false;

  const width = x1 - x0;
  const depth = z1 - z0;

  /* ------------------------------------------------------------ ceiling -- */

  // A white grid at the ceiling plane, with the light panels recessed into it.
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 0.4, depth + 0.4),
    toon({ color: 0xf2f5fa, side: THREE.DoubleSide }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(midX, INTERIOR.ceiling, (z0 + z1) / 2);
  ceiling.name = 'ceiling';
  ceiling.userData.noOutline = true;
  group.add(ceiling);

  const panel = INTERIOR.lightPanel;
  const panelMaterial = toon({
    color: 0xffffff,
    emissive: PALETTE.interiorLight,
    emissiveIntensity: 1.05,
  });
  const gridBoxes = [];
  const panelBoxes = [];
  const cols = panel.cols;
  const rows = panel.rows;

  for (let ix = 0; ix < cols; ix++) {
    for (let iz = 0; iz < rows; iz++) {
      const px = midX + (ix - (cols - 1) / 2) * ((width - 1.4) / cols);
      const pz = (z0 + z1) / 2 + (iz - (rows - 1) / 2) * ((depth - 1.4) / rows);
      // The frame around each panel, so the ceiling is a grid and not a sheet.
      gridBoxes.push(
        { w: panel.x + 0.16, h: 0.05, d: 0.06, x: px, y: INTERIOR.ceiling - 0.02, z: pz - panel.z / 2 - 0.08 },
        { w: panel.x + 0.16, h: 0.05, d: 0.06, x: px, y: INTERIOR.ceiling - 0.02, z: pz + panel.z / 2 + 0.08 },
        { w: 0.06, h: 0.05, d: panel.z + 0.16, x: px - panel.x / 2 - 0.08, y: INTERIOR.ceiling - 0.02, z: pz },
        { w: 0.06, h: 0.05, d: panel.z + 0.16, x: px + panel.x / 2 + 0.08, y: INTERIOR.ceiling - 0.02, z: pz },
      );
      panelBoxes.push({ w: panel.x, h: 0.04, d: panel.z, x: px, y: INTERIOR.ceiling - 0.035, z: pz });
    }
  }
  group.add(mergeBoxes(gridBoxes, toon({ color: 0xd7dde8 }), 'ceilingGrid'));
  group.add(mergeBoxes(panelBoxes, panelMaterial, 'ceilingLights'));

  /* --------------------------------------------------------- back room -- */

  // The doorway at the back is deliberately DARKER than the shop. A hole you
  // cannot see into is what tells the eye the room has depth; a bright doorway
  // would flatten the whole interior into a backdrop.
  const backW = INTERIOR.backDoor.w;
  const backH = INTERIOR.backDoor.h;
  const backX = midX + 2.2;
  const doorway = new THREE.Mesh(
    new THREE.PlaneGeometry(backW, backH),
    toon({ color: PALETTE.backRoom }),
  );
  doorway.position.set(backX, backH / 2, z0 + 0.02);
  doorway.name = 'backRoomDoorway';
  doorway.userData.noOutline = true;
  group.add(doorway);
  const doorSign = backDoorSign();
  const doorPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.25),
    toon({ color: 0xffffff, map: doorSign, emissive: 0xffffff, emissiveMap: doorSign, emissiveIntensity: 0.35 }),
  );
  doorPlate.position.set(backX + 0.75, 1.55, z0 + 0.03);
  doorPlate.userData.noOutline = true;
  group.add(doorPlate);

  /* -------------------------------------------------------- drinks cooler -- */

  // On the back wall, facing the window. Bright, saturated and full of colour,
  // which is what makes the far end of the shop read as "stocked" from outside.
  const cooler = INTERIOR.cooler;
  const coolerX = at('cooler').x;
  const coolerZ = at('cooler').z;

  const coolerBody = new THREE.Mesh(
    roundedBox(cooler.w, cooler.h, cooler.depth, 0.03),
    toon({ color: PALETTE.darkMetal }),
  );
  coolerBody.position.set(coolerX, cooler.h / 2, coolerZ);
  coolerBody.name = 'drinksCooler';
  group.add(coolerBody);

  const fridgeFace = new THREE.Mesh(
    new THREE.PlaneGeometry(cooler.w - 0.16, cooler.h - 0.3),
    toon({ color: PALETTE.fridge, emissive: PALETTE.interiorCool, emissiveIntensity: 0.55 }),
  );
  fridgeFace.position.set(coolerX, cooler.h / 2 + 0.05, coolerZ + cooler.depth / 2 + 0.005);
  fridgeFace.name = 'coolerFace';
  fridgeFace.userData.noOutline = true;
  group.add(fridgeFace);

  // Rows of bottles: the colour is the point.
  const bottleBoxes = [];
  const bottleColours = [];
  const shelfYs = [0.55, 0.98, 1.41, 1.84, 2.2];
  for (let r = 0; r < shelfYs.length; r++) {
    for (let i = 0; i < 16; i++) {
      const bx = coolerX - cooler.w / 2 + 0.28 + i * ((cooler.w - 0.56) / 15);
      bottleBoxes.push({ w: 0.11, h: 0.26, d: 0.11, x: bx, y: shelfYs[r], z: coolerZ + cooler.depth / 2 - 0.16 });
      bottleColours.push(PALETTE.product[(r * 16 + i) % PALETTE.product.length]);
    }
  }
  const byColour = new Map();
  for (let i = 0; i < bottleBoxes.length; i++) {
    const c = bottleColours[i];
    if (!byColour.has(c)) byColour.set(c, []);
    byColour.get(c).push(bottleBoxes[i]);
  }
  let bottles = 0;
  for (const [colour, boxes] of byColour) {
    const mesh = mergeBoxes(boxes, toon({ color: colour, emissive: colour, emissiveIntensity: 0.35 }), `coolerStock${colour.toString(16)}`);
    if (mesh) {
      mesh.receiveShadow = false;
      group.add(mesh);
      bottles += boxes.length;
    }
  }

  // Glass doors over the front, with their frames.
  for (let i = 0; i < cooler.doors; i++) {
    const dx = coolerX - cooler.w / 2 + (cooler.w / cooler.doors) * (i + 0.5);
    const door = new THREE.Mesh(
      roundedBox(cooler.w / cooler.doors - 0.08, cooler.h - 0.24, 0.05, 0.01),
      toon({ color: PALETTE.fridge, transparent: true, opacity: 0.16, depthWrite: false }),
    );
    door.position.set(dx, cooler.h / 2, coolerZ + cooler.depth / 2 + 0.04);
    door.userData.noOutline = true;
    group.add(door);
  }

  /* ---------------------------------------------------------- shelf runs -- */

  const shelf = INTERIOR.shelf;
  const shelfMaterial = toon({ color: 0xd8d2c4 }); // pale boards inside the dark carcass
  const edgeMaterial = toon({ color: PALETTE.shelfEdge, emissive: PALETTE.shelfEdge, emissiveIntensity: 0.3 });

  const runZ0 = z0 + 1.2;
  const runZ1 = z1 - 2.2;
  const runMid = (runZ0 + runZ1) / 2;
  const runLength = runZ1 - runZ0;

  for (let r = 0; r < shelf.runs; r++) {
    const rx = midX - 1.9 + r * (shelf.depth + shelf.gap);

    const body = new THREE.Mesh(
      roundedBox(shelf.depth, shelf.h, runLength, 0.02),
      toon({ color: 0x4a5060 }),
    );
    body.position.set(rx, shelf.h / 2, runMid);
    body.name = `shelfRun${r}`;
    addOutline(body, { thickness: OUTLINE.detail, color: 0x0d0f18 });
    group.add(body);

    // Product rows on both sides, and the coloured edge strip that runs along
    // every shelf in every convenience store in the country.
    const boxes = [];
    const colours = [];
    for (let t = 0; t < shelf.tiers; t++) {
      const ty = 0.28 + t * ((shelf.h - 0.34) / shelf.tiers);
      for (const side of [-1, 1]) {
        // The shelf board itself.
        boxes.push({
          w: shelf.depth - 0.04, h: 0.035, d: runLength - 0.06,
          x: rx, y: ty - 0.02, z: runMid,
        });
        colours.push(0xd8d2c4);

        // The coloured edge strip along the front lip.
        const edge = { w: 0.03, h: 0.09, d: runLength - 0.06, x: rx + (side * shelf.depth) / 2, y: ty, z: runMid };
        boxes.push(edge);
        colours.push(PALETTE.shelfEdge);

        // Stock, with deliberate gaps: some slots empty, some stacked two
        // deep, heights uneven. A shelf packed edge to edge with identical
        // boxes reads as a texture, not as merchandise.
        const slots = shelf.productsPerTier;
        for (let i = 0; i < slots; i++) {
          if ((i * 5 + t * 3 + r * 7) % 9 === 0) continue; // an empty facing
          const pz = runZ0 + 0.35 + i * ((runLength - 0.7) / (slots - 1));
          const tall = (i * 7 + t * 5 + r * 3) % 4;
          const height = 0.15 + tall * 0.035;
          const wide = 0.13 + ((i + t) % 3) * 0.03;
          const colour = PALETTE.product[(i * 3 + t * 5 + r * 7) % PALETTE.product.length];
          const lean = ((i * 11 + t) % 5) - 2; // a couple of degrees off square

          boxes.push({
            w: wide, h: height, d: 0.15,
            x: rx + side * (shelf.depth / 2 - 0.12),
            y: ty + height / 2 + 0.05,
            z: pz,
            rz: lean * 0.018,
          });
          colours.push(colour);

          // Every so often a second one stacked on top.
          if ((i * 3 + t) % 7 === 0) {
            boxes.push({
              w: wide * 0.92, h: height * 0.7, d: 0.14,
              x: rx + side * (shelf.depth / 2 - 0.12),
              y: ty + height + height * 0.35 + 0.06,
              z: pz,
              rz: -lean * 0.02,
            });
            colours.push(PALETTE.product[(i * 3 + t * 5 + r * 11 + 3) % PALETTE.product.length]);
          }
        }
      }
    }

    const shelfByColour = new Map();
    for (let i = 0; i < boxes.length; i++) {
      const c = colours[i];
      if (!shelfByColour.has(c)) shelfByColour.set(c, []);
      shelfByColour.get(c).push(boxes[i]);
    }
    for (const [colour, list] of shelfByColour) {
      const isEdge = colour === PALETTE.shelfEdge;
      const mesh = mergeBoxes(
        list,
        isEdge ? edgeMaterial : toon({ color: colour }),
        `shelfStock${r}_${colour.toString(16)}`,
      );
      if (mesh) group.add(mesh);
    }
  }

  /* ------------------------------------------------------------- counter -- */

  const counter = INTERIOR.counter;
  const counterX = at('counter').x;
  const counterZ = at('counter').z;

  const counterBody = new THREE.Mesh(
    roundedBox(counter.w, counter.h, counter.depth, 0.02),
    toon({ color: PALETTE.counter }),
  );
  counterBody.position.set(counterX, counter.h / 2, counterZ);
  counterBody.name = 'counter';
  addOutline(counterBody, { thickness: OUTLINE.detail, color: 0x0d0f18 });
  group.add(counterBody);

  const counterTop = new THREE.Mesh(
    roundedBox(counter.w + 0.08, 0.06, counter.depth + 0.08, 0.015),
    toon({ color: PALETTE.counterTop }),
  );
  counterTop.position.set(counterX, counter.h + 0.03, counterZ);
  counterTop.userData.noOutline = true;
  group.add(counterTop);

  // Register and card reader.
  const register = new THREE.Mesh(roundedBox(0.44, 0.3, 0.34, 0.02), toon({ color: 0x3a4050 }));
  register.position.set(counterX + 0.8, counter.h + 0.21, counterZ);
  register.name = 'register';
  addOutline(register, { thickness: OUTLINE.detail, color: 0x0d0f18 });
  group.add(register);
  const registerFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.2),
    toon({ color: 0x22303a, emissive: 0x6fe0c0, emissiveIntensity: 0.85 }),
  );
  registerFace.position.set(counterX + 0.8, counter.h + 0.24, counterZ - 0.176);
  registerFace.rotation.y = Math.PI;
  registerFace.userData.noOutline = true;
  group.add(registerFace);

  const reader = new THREE.Mesh(roundedBox(0.2, 0.12, 0.16, 0.015), toon({ color: 0xdfe4ec }));
  reader.position.set(counterX + 0.3, counter.h + 0.12, counterZ - 0.2);
  group.add(reader);

  /* -------------------------------------------------------- coffee & oden -- */

  // Coffee machine, against the counter's far end.
  const coffee = INTERIOR.coffee;
  const coffeeMesh = new THREE.Mesh(
    roundedBox(coffee.w, coffee.h, 0.5, 0.02),
    toon({ color: 0xe6e9f0 }),
  );
  coffeeMesh.position.set(counterX - 1.5, counter.h + coffee.h / 2 + 0.06, counterZ);
  coffeeMesh.name = 'coffeeMachine';
  addOutline(coffeeMesh, { thickness: OUTLINE.detail, color: 0x0d0f18 });
  group.add(coffeeMesh);
  const coffeeGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.3),
    toon({ color: 0x2a2520, emissive: PALETTE.lampWarm, emissiveIntensity: 1.1 }),
  );
  coffeeGlow.position.set(counterX - 1.5, counter.h + coffee.h / 2 + 0.14, counterZ - 0.26);
  coffeeGlow.rotation.y = Math.PI;
  coffeeGlow.userData.noOutline = true;
  group.add(coffeeGlow);

  // Oden counter: a stainless pot with a lit lid, and the steam that
  // weather.js puts above it.
  const oden = INTERIOR.oden;
  const odenX = at('oden').x;
  const odenBody = new THREE.Mesh(roundedBox(oden.w, oden.h, 0.62, 0.03), toon({ color: PALETTE.metal }));
  odenBody.position.set(odenX, oden.h / 2, counterZ);
  odenBody.name = 'odenCounter';
  addOutline(odenBody, { thickness: OUTLINE.detail, color: 0x0d0f18 });
  group.add(odenBody);
  const odenGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(oden.w - 0.2, 0.5),
    toon({ color: 0x6b5a3a, emissive: 0xffd9a0, emissiveIntensity: 0.95 }),
  );
  odenGlow.rotation.x = -Math.PI / 2;
  odenGlow.position.set(odenX, oden.h + 0.005, counterZ);
  odenGlow.userData.noOutline = true;
  group.add(odenGlow);

  /* ------------------------------------------------------------ bento -- */

  // The chilled case by the window. Open, multi-tier, with its own light, and
  // stacked with trays rather than generic boxes — the brief asks for a bento
  // area specifically, and a bento is recognisable at a glance by its shape and
  // by the black tray with a red compartment grid.
  // x + 5 must stay greater than z (see FIXTURES in config.js): at z = 2.25
  // that means x > -2.75, and the chamfered corner is not shop floor at all.
  const bentoX = at('bento').x;
  const bentoZ = at('bento').z;
  const bentoW = 1.6;
  const bentoH = 1.28;
  const bentoD = 0.62;

  const bentoBody = new THREE.Mesh(
    roundedBox(bentoW, bentoH, bentoD, 0.02),
    toon({ color: 0x3d4453 }),
  );
  bentoBody.position.set(bentoX, bentoH / 2, bentoZ);
  bentoBody.name = 'bentoCase';
  addOutline(bentoBody, { thickness: OUTLINE.detail, color: 0x1a1c29 });
  group.add(bentoBody);

  // A lit back panel, so the case glows the way a chilled display does.
  const bentoGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(bentoW - 0.12, bentoH - 0.3),
    toon({ color: 0xffffff, emissive: 0xffe6c0, emissiveIntensity: 0.9 }),
  );
  bentoGlow.position.set(bentoX, bentoH / 2 + 0.06, bentoZ - bentoD / 2 + 0.03);
  bentoGlow.userData.noOutline = true;
  group.add(bentoGlow);

  const bentoBoxes = [];
  const bentoColours = [];
  for (let tier = 0; tier < 3; tier++) {
    const ty = 0.16 + tier * 0.42;
    bentoBoxes.push({ w: bentoW - 0.1, h: 0.025, d: bentoD - 0.08, x: bentoX, y: ty, z: bentoZ });
    bentoColours.push(0xe8e4da);
    for (let i = 0; i < 5; i++) {
      if (i === 3 && tier === 1) continue; // one gap, so it is not a solid wall
      const bx = bentoX - bentoW / 2 + 0.2 + i * 0.3;
      bentoBoxes.push({ w: 0.24, h: 0.07, d: 0.18, x: bx, y: ty + 0.05, z: bentoZ + 0.04 });
      bentoColours.push(0x1e1f26);
      bentoBoxes.push({ w: 0.23, h: 0.035, d: 0.17, x: bx, y: ty + 0.1, z: bentoZ + 0.04 });
      bentoColours.push(i % 2 === 0 ? 0xc0392b : 0xd9a441);
    }
  }
  const bentoByColour = new Map();
  for (let i = 0; i < bentoBoxes.length; i++) {
    const c = bentoColours[i];
    if (!bentoByColour.has(c)) bentoByColour.set(c, []);
    bentoByColour.get(c).push(bentoBoxes[i]);
  }
  for (const [colour, list] of bentoByColour) {
    const mesh = mergeBoxes(list, toon({ color: colour }), `bento${colour.toString(16)}`);
    if (mesh) group.add(mesh);
  }

  /* ---------------------------------------------------------- onigiri -- */

  // A stepped display of rice balls. Triangular, white, with the nori band —
  // about as recognisable a silhouette as there is in a Japanese shop.
  const onigiriX = at('onigiri').x;
  const onigiriZ = at('onigiri').z;

  const stand = new THREE.Mesh(
    roundedBox(1.15, 0.14, 0.5, 0.02),
    toon({ color: 0x4a5060 }),
  );
  stand.position.set(onigiriX, 0.62, onigiriZ);
  stand.name = 'onigiriStand';
  addOutline(stand, { thickness: OUTLINE.detail, color: 0x1a1c29 });
  group.add(stand);
  const standPost = new THREE.Mesh(roundedBox(0.6, 0.58, 0.34, 0.02), toon({ color: 0x4a5060 }));
  standPost.position.set(onigiriX, 0.29, onigiriZ - 0.04);
  group.add(standPost);

  const riceMaterial = toon({ color: 0xf6f2e8, emissive: 0xfff0d8, emissiveIntensity: 0.16 });
  const noriMaterial = toon({ color: 0x22301f });

  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 5; i++) {
      const ox = onigiriX - 0.42 + i * 0.21;
      const oy = 0.76 + row * 0.2;
      const oz = onigiriZ + (row === 0 ? 0.1 : -0.08);

      // A three-sided cylinder is a triangular prism; laid on its side it is a
      // rice ball.
      const rice = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.055, 3), riceMaterial);
      rice.rotation.x = Math.PI / 2;
      rice.rotation.y = row === 0 ? 0 : Math.PI;
      rice.position.set(ox, oy, oz);
      rice.userData.noOutline = true;
      group.add(rice);

      const nori = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.058), noriMaterial);
      nori.position.set(ox, oy - 0.045, oz);
      nori.userData.noOutline = true;
      group.add(nori);
    }
  }

  /* ----------------------------------------------------- magazine & more -- */

  const magazine = INTERIOR.magazine;
  const magX = at('magazine').x;
  const magZ = at('magazine').z;
  const magBody = new THREE.Mesh(roundedBox(0.5, magazine.h, magazine.w, 0.02), toon({ color: PALETTE.shelf }));
  magBody.position.set(magX, magazine.h / 2, magZ);
  magBody.name = 'magazineRack';
  addOutline(magBody, { thickness: OUTLINE.detail, color: 0x0d0f18 });
  group.add(magBody);

  const magBoxes = [];
  const magColours = [];
  for (let t = 0; t < 4; t++) {
    for (let i = 0; i < 7; i++) {
      magBoxes.push({
        w: 0.06, h: 0.24, d: 0.17,
        x: magX + 0.2,
        y: 0.3 + t * 0.3,
        z: magZ - magazine.w / 2 + 0.2 + i * ((magazine.w - 0.4) / 6),
      });
      magColours.push(PALETTE.product[(t * 7 + i) % PALETTE.product.length]);
    }
  }
  const magByColour = new Map();
  for (let i = 0; i < magBoxes.length; i++) {
    const c = magColours[i];
    if (!magByColour.has(c)) magByColour.set(c, []);
    magByColour.get(c).push(magBoxes[i]);
  }
  for (const [colour, list] of magByColour) {
    const mesh = mergeBoxes(list, toon({ color: colour }), `magazines${colour.toString(16)}`);
    if (mesh) group.add(mesh);
  }

  // Lockers and a stack of crates against the west wall.
  const locker = INTERIOR.locker;
  const lockerMesh = new THREE.Mesh(
    roundedBox(0.5, locker.h, locker.w, 0.02),
    toon({ color: 0x9aa3b4 }),
  );
  lockerMesh.position.set(at('lockers').x, locker.h / 2, at('lockers').z);
  lockerMesh.name = 'lockers';
  addOutline(lockerMesh, { thickness: OUTLINE.detail, color: 0x0d0f18 });
  group.add(lockerMesh);

  /* --------------------------------------------------------- floor tape -- */

  // The coloured guidance tape on the floor, which every shop like this has and
  // which reads from outside as "this place is organised".
  const tapeMaterial = toon({ color: PALETTE.floorTape, emissive: PALETTE.floorTape, emissiveIntensity: 0.2 });
  const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.09, depth - 1.2), tapeMaterial);
  tape.rotation.x = -Math.PI / 2;
  tape.position.set(midX - 1.9 - shelf.depth / 2 - 0.5, 0.024, (z0 + z1) / 2);
  tape.userData.noOutline = true;
  group.add(tape);
  const tape2 = tape.clone();
  tape2.position.x = midX + 3.1;
  group.add(tape2);

  /* ---------------------------------------------------------- promo cards -- */

  // Hanging cards above the aisles. Cheap, and they are what makes the ceiling
  // area look busy rather than empty.
  for (let i = 0; i < 4; i++) {
    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.3),
      toon({ color: 0xffffff, emissive: PALETTE.signGlow, emissiveIntensity: 0.32, side: THREE.DoubleSide }),
    );
    const map = shelfCard(i);
    card.material.map = map;
    card.material.emissiveMap = map;
    card.position.set(midX - 2.6 + i * 1.7, 2.35, midZ - 1.4 + (i % 2) * 0.05);
    card.userData.noOutline = true;
    group.add(card);
  }

  /* ------------------------------------------------------- wall posters -- */

  for (let i = 0; i < 2; i++) {
    const map = poster(i + 1);
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.85),
      toon({ color: 0xffffff, map, emissive: PALETTE.signGlow, emissiveMap: map, emissiveIntensity: 0.28 }),
    );
    p.position.set(x0 + 0.14, 1.7, z1 - 5.0 - i * 0.9);
    p.rotation.y = Math.PI / 2;
    p.userData.noOutline = true;
    group.add(p);
  }

  return { group, stats: { bottles } };
}

export { mergeBoxes };
