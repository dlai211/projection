/**
 * service.js — the delivery yard behind the shop.
 *
 * The back of the plot used to be a large empty expanse of paving. It is now
 * the late-night delivery: a cab-over box truck backed up to the service door,
 * its hazard lights going, a platform hand truck halfway between the two with
 * crates stacked on it, and the ordinary clutter of a back alley — a dumpster,
 * flattened cardboard, meter boxes, and the staff bicycles under a little
 * corrugated shelter.
 *
 * Two things here are doing more work than their size suggests:
 *
 *   - The truck's hazard lights. They are the only thing in the scene that
 *     flashes at a rhythm faster than the traffic signal, and a pair of amber
 *     lamps blinking on a wet yard is most of what makes the back of the
 *     building read as *happening* rather than as scenery.
 *
 *   - The bulkhead lamp over the service door. It is the only light back here,
 *     and without it the whole yard is a dark rectangle.
 */

import * as THREE from 'three';
import { PALETTE, LEVELS, OUTLINE } from './config.js';
import { toon, roundedBox, addOutline } from './toon.js';
import { concrete, paving } from './textures.js';
import { liverySide } from './signage.js';

const OUT = { thickness: OUTLINE.detail, color: 0x1a1c29 };

export function buildService({ z0 }) {
  const group = new THREE.Group();
  group.name = 'service';

  const darkMetal = toon({ color: PALETTE.darkMetal });
  const metal = toon({ color: PALETTE.metal });
  const white = toon({ color: 0xe9edf3 });

  /* -------------------------------------------------------- yard surface -- */

  // Its own slab, in its own darker concrete, with expansion joints and the
  // yellow hatching a loading bay always has. It used to be the same paving as
  // the front pavement, which made the back of the shop read as more of the
  // same street rather than as a yard.
  const YARD_W = 20;
  const YARD_D = 6;
  const YARD_X = 3;
  const YARD_Z = -10;

  const yardSlab = new THREE.Mesh(
    roundedBox(YARD_W, 0.12, YARD_D, 0.02),
    toon({ color: 0x4a4f5c, map: concrete() }),
  );
  yardSlab.position.set(YARD_X, LEVELS.yard - 0.06, YARD_Z);
  yardSlab.name = 'yardSlab';
  yardSlab.userData.noOutline = true;
  group.add(yardSlab);

  // Expansion joints, cut into the slab.
  const jointMaterial = toon({ color: 0x3a3f4b });
  for (let x = YARD_X - YARD_W / 2 + 3; x < YARD_X + YARD_W / 2; x += 3) {
    const joint = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, YARD_D - 0.2), jointMaterial);
    joint.position.set(x, LEVELS.yard - 0.004, YARD_Z);
    joint.userData.noOutline = true;
    group.add(joint);
  }
  const jointZ = new THREE.Mesh(new THREE.BoxGeometry(YARD_W - 0.2, 0.01, 0.05), jointMaterial);
  jointZ.position.set(YARD_X, LEVELS.yard - 0.004, YARD_Z);
  jointZ.userData.noOutline = true;
  group.add(jointZ);

  // Yellow hatching in front of the service door: the loading mark.
  const hatchMaterial = toon({ color: 0xd8b23c, emissive: 0xd8b23c, emissiveIntensity: 0.16 });
  for (let i = 0; i < 7; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.008, 1.7), hatchMaterial);
    stripe.position.set(0.9 + i * 0.42, LEVELS.yard + 0.004, z0 - 0.95);
    stripe.rotation.y = 0.6;
    stripe.userData.noOutline = true;
    group.add(stripe);
  }

  const put = (mesh, name, outline = true) => {
    mesh.name = name;
    if (outline) addOutline(mesh, OUT);
    group.add(mesh);
    return mesh;
  };

  /* --------------------------------------------------------- the truck -- */

  // A Japanese cab-over: a short, square, flat-fronted cab with the box hard
  // behind it and nothing overhanging. The silhouette is the whole point, so
  // the cab is a plain rounded box and the windscreen is one dark panel.
  const truck = new THREE.Group();
  truck.name = 'deliveryTruck';
  // Nose towards the side street, rear doors facing back into the yard towards
  // the service door. Turned around, the tailgate ends up in the corner and the
  // unloading happens in front of the cab.
  truck.position.set(-2.0, 0, z0 - 2.6);
  truck.rotation.y = 0;

  const W = 1.9;
  const cabH = 1.75;
  const boxH = 2.15;
  const boxLen = 3.1;
  const cabLen = 1.5;

  // The cab sits hard against the front of the box. It used to be a metre and a
  // half clear of it, which read as two separate vehicles.
  const CAB_FRONT = 0.02 - 0.1 - cabLen; // 0.1 m gap behind the box face
  const cabCentre = CAB_FRONT + cabLen / 2;

  const chassis = new THREE.Mesh(
    roundedBox(boxLen + cabLen + 0.14, 0.22, W - 0.16, 0.03),
    darkMetal,
  );
  chassis.position.set((CAB_FRONT + boxLen + 0.02) / 2, 0.5, 0);
  truck.add(chassis);

  const cab = new THREE.Mesh(roundedBox(cabLen, cabH, W, 0.06), white);
  cab.position.set(cabCentre, 0.62 + cabH / 2, 0);
  addOutline(cab, { thickness: OUTLINE.hero, color: 0x1a1c29 });
  truck.add(cab);

  // The windscreen: one dark panel, tilted a little.
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.24, 0.78),
    toon({ color: 0x1a2230, emissive: 0x2a3a52, emissiveIntensity: 0.2 }),
  );
  screen.position.set(CAB_FRONT - 0.01, 0.62 + cabH - 0.52, 0);
  screen.rotation.y = -Math.PI / 2;
  screen.userData.noOutline = true;
  truck.add(screen);

  // Bumper, headlights and mirrors.
  const bumper = new THREE.Mesh(roundedBox(0.16, 0.28, W - 0.06, 0.03), toon({ color: 0xb6bcc8 }));
  bumper.position.set(CAB_FRONT - 0.09, 0.52, 0);
  truck.add(bumper);
  const headlights = [];
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(
      roundedBox(0.08, 0.2, 0.32, 0.02),
      toon({ color: 0xffffff, emissive: 0xfff0d0, emissiveIntensity: 2.2 }),
    );
    lamp.position.set(CAB_FRONT - 0.05, 0.72, side * (W / 2 - 0.28));
    lamp.userData.noOutline = true;
    truck.add(lamp);
    headlights.push(lamp);

    const mirror = new THREE.Mesh(roundedBox(0.06, 0.34, 0.12, 0.02), darkMetal);
    mirror.position.set(cabCentre - 0.62, 0.62 + cabH - 0.2, side * (W / 2 + 0.14));
    truck.add(mirror);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 6), darkMetal);
    stalk.rotation.x = Math.PI / 2;
    stalk.position.set(cabCentre - 0.62, 0.62 + cabH - 0.2, side * (W / 2 + 0.07));
    truck.add(stalk);
  }

  // The refrigerated box, with the shop's own livery down each side.
  const livery = liverySide();
  const boxMaterial = [
    white, white, white, white,
    toon({ color: 0xffffff, map: livery }),
    toon({ color: 0xffffff, map: livery }),
  ];
  const box = new THREE.Mesh(roundedBox(boxLen, boxH, W, 0.05), boxMaterial);
  box.position.set(boxLen / 2 + 0.02, 0.62 + boxH / 2, 0);
  addOutline(box, { thickness: OUTLINE.hero, color: 0x1a1c29 });
  truck.add(box);

  // Rear doors, standing open: two flat panels swung out either side.
  for (const side of [-1, 1]) {
    const door = new THREE.Mesh(roundedBox(0.06, boxH - 0.2, W / 2 - 0.04, 0.02), white);
    door.position.set(boxLen + 0.02, 0.62 + boxH / 2, side * (W / 2 - 0.05));
    door.rotation.y = side * 1.35;
    addOutline(door, OUT);
    truck.add(door);
  }
  // The dark inside of the box, so the open doors read as an opening.
  const hold = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.2, boxH - 0.3),
    toon({ color: 0x2b3040 }),
  );
  hold.position.set(boxLen - 0.02, 0.62 + boxH / 2, 0);
  hold.rotation.y = Math.PI / 2;
  hold.userData.noOutline = true;
  truck.add(hold);

  // Tail lights and the hazard lamps.
  const hazards = [];
  const tailLights = [];
  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(
      roundedBox(0.07, 0.22, 0.3, 0.02),
      toon({ color: 0xffffff, emissive: 0xd93b34, emissiveIntensity: 1.8 }),
    );
    tail.position.set(boxLen + 0.03, 0.78, side * (W / 2 - 0.26));
    tail.userData.noOutline = true;
    truck.add(tail);
    tailLights.push(tail);

    const hazard = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.13, 0.13),
      toon({ color: 0xffffff, emissive: 0xffa62b, emissiveIntensity: 1.2 }),
    );
    hazard.position.set(boxLen + 0.03, 1.05, side * (W / 2 - 0.26));
    hazard.userData.noOutline = true;
    truck.add(hazard);
    hazards.push(hazard);
  }

  // Wheels: four visible, black with a pale hub.
  for (const dx of [cabCentre - 0.15, boxLen / 2 - 0.75]) {
    for (const side of [-1, 1]) {
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 16), toon({ color: 0x14161c }));
      tyre.rotation.x = Math.PI / 2;
      tyre.position.set(dx, 0.36, side * (W / 2 - 0.06));
      truck.add(tyre);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.26, 12), metal);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(dx, 0.36, side * (W / 2 - 0.06));
      hub.userData.noOutline = true;
      truck.add(hub);
    }
  }
  group.add(truck);

  /* -------------------------------------------------- hand truck & crates */

  // A blue platform hand truck between the tailgate and the service door, with
  // the delivery stacked on it.
  // Behind the tailgate, on the path from the truck to the service door. It
  // used to sit in front of the cab, which is where nothing is ever unloaded.
  const cartX = 1.9;
  const cartZ = z0 - 2.8;
  const cart = new THREE.Group();
  cart.position.set(cartX, 0, cartZ);
  cart.name = 'handTruck';

  const deck = new THREE.Mesh(roundedBox(0.62, 0.06, 0.94, 0.02), toon({ color: 0x2f5f9e }));
  deck.position.y = 0.16;
  addOutline(deck, OUT);
  cart.add(deck);
  for (const [dx, dz] of [[-0.24, -0.4], [0.24, -0.4], [-0.24, 0.4], [0.24, 0.4]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10), darkMetal);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(dx, 0.07, dz);
    cart.add(wheel);
  }
  const handle = new THREE.Mesh(roundedBox(0.06, 0.9, 0.06, 0.02), toon({ color: 0x2f5f9e }));
  handle.position.set(0, 0.62, -0.44);
  cart.add(handle);

  // The load: food crates in the shop's colours, with a cardboard box on top.
  const crateColours = [0x2f5f9e, 0xd9a441, 0xe4e8ef, 0x3f8f6f];
  for (let i = 0; i < 4; i++) {
    const crate = new THREE.Mesh(
      roundedBox(0.52, 0.22, 0.7, 0.02),
      toon({ color: crateColours[i % crateColours.length] }),
    );
    crate.position.set(cartX + (i % 2 === 0 ? -0.02 : 0.03), 0.31 + i * 0.22, cartZ + (i % 2 ? 0.02 : -0.02));
    crate.rotation.y = (i - 2) * 0.05;
    addOutline(crate, OUT);
    group.add(crate);
  }
  const carton = new THREE.Mesh(roundedBox(0.44, 0.32, 0.56, 0.02), toon({ color: 0xa9834f }));
  carton.position.set(cartX + 0.02, 1.32, cartZ - 0.02);
  carton.rotation.y = 0.12;
  addOutline(carton, OUT);
  group.add(carton);
  group.add(cart);

  // A neat stack of empties beside the door.
  for (let i = 0; i < 3; i++) {
    const empty = new THREE.Mesh(roundedBox(0.56, 0.2, 0.72, 0.02), toon({ color: 0x2f5f9e }));
    empty.position.set(cartX + 1.5, 0.1 + i * 0.2, cartZ - 0.3);
    empty.rotation.y = (i - 1) * 0.04;
    addOutline(empty, OUT);
    group.add(empty);
  }

  /* ------------------------------------------------------ service door -- */

  // A steel staff door on the shop's back wall, with the one lamp that lights
  // this whole yard.
  const doorW = 0.98;
  const doorH = 2.05;
  const doorX = 2.2;
  const door = new THREE.Mesh(roundedBox(doorW, doorH, 0.09, 0.02), toon({ color: 0x4a505e }));
  door.position.set(doorX, doorH / 2, z0 + 0.06);
  addOutline(door, { thickness: OUTLINE.hero, color: 0x1a1c29 });
  group.add(door);

  const window = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.44),
    toon({ color: 0x2a3240, emissive: 0x6a7a92, emissiveIntensity: 0.25 }),
  );
  window.position.set(doorX, 1.55, z0 + 0.115);
  window.userData.noOutline = true;
  group.add(window);

  const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), metal);
  handleBar.rotation.z = Math.PI / 2;
  handleBar.position.set(doorX + 0.32, 1.05, z0 + 0.14);
  group.add(handleBar);

  // The step, and the bulkhead lamp above it.
  const step = new THREE.Mesh(roundedBox(1.4, 0.14, 0.5, 0.02), toon({ color: PALETTE.concrete, map: concrete() }));
  step.position.set(doorX, LEVELS.yard + 0.07, z0 - 0.28);
  addOutline(step, OUT);
  group.add(step);

  const shade = new THREE.Mesh(roundedBox(0.34, 0.16, 0.22, 0.03), darkMetal);
  shade.position.set(doorX, 2.5, z0 - 0.12);
  group.add(shade);
  const bulb = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.05, 0.14),
    toon({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 3.2 }),
  );
  bulb.position.set(doorX, 2.42, z0 - 0.12);
  bulb.userData.noOutline = true;
  group.add(bulb);

  /* ------------------------------------------------------------ clutter -- */

  // Dumpster against the wall.
  const dumpster = new THREE.Mesh(roundedBox(1.5, 1.05, 0.9, 0.04), toon({ color: 0x25405e }));
  dumpster.position.set(-1.6, LEVELS.yard + 0.52, z0 - 0.85);
  put(dumpster, 'dumpster');
  const lid = new THREE.Mesh(roundedBox(1.56, 0.09, 0.96, 0.03), toon({ color: 0x1c3350 }));
  lid.position.set(-1.6, LEVELS.yard + 1.09, z0 - 0.85);
  lid.rotation.x = -0.12;
  group.add(lid);
  for (const dx of [-0.58, 0.58]) {
    const caster = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10), darkMetal);
    caster.rotation.z = Math.PI / 2;
    caster.position.set(-1.6 + dx, LEVELS.yard + 0.08, z0 - 0.5);
    group.add(caster);
  }

  // Flattened cardboard, tied in a bundle.
  for (let i = 0; i < 3; i++) {
    const bundle = new THREE.Mesh(roundedBox(0.9, 0.34, 0.6, 0.02), toon({ color: 0xa9834f }));
    bundle.position.set(-3.9, LEVELS.yard + 0.18 + i * 0.35, z0 - 0.9 + i * 0.1);
    bundle.rotation.y = (i - 1) * 0.14;
    addOutline(bundle, OUT);
    group.add(bundle);
  }

  // Meter boxes and a run of pipe up the wall.
  for (const [y, w, h] of [[1.35, 0.36, 0.5], [0.75, 0.44, 0.34]]) {
    const meter = new THREE.Mesh(roundedBox(w, h, 0.16, 0.02), toon({ color: 0xc3c9d4 }));
    meter.position.set(4.2, LEVELS.yard + y, z0 - 0.08);
    put(meter, 'meterBox');
  }
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8), toon({ color: 0x8d94a6 }));
  pipe.position.set(4.75, LEVELS.yard + 1.25, z0 - 0.1);
  group.add(pipe);

  /* ---------------------------------------------------- staff bicycles -- */

  // A little corrugated shelter over two bicycles, which is what every back
  // entrance in the country has.
  // Back-left of the yard, against the side-street boundary. It used to stand
  // outside the shop's west glazing, where it blocked the window, and the truck
  // reversed into it.
  const shelterX = -5.3;
  const shelterZ = z0 - 4.6;
  const roof = new THREE.Mesh(roundedBox(2.6, 0.05, 1.9, 0.02), toon({ color: 0x9aa6b8 }));
  roof.position.set(shelterX, LEVELS.yard + 2.05, shelterZ);
  roof.rotation.z = 0.07;
  addOutline(roof, OUT);
  group.add(roof);
  for (const [dx, dz] of [[-1.2, -0.85], [1.2, -0.85], [-1.2, 0.85], [1.2, 0.85]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.0, 8), metal);
    post.position.set(shelterX + dx, LEVELS.yard + 1.0, shelterZ + dz);
    group.add(post);
  }
  const groundsheet = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.9),
    toon({ color: 0x3a4152, map: paving() }),
  );
  groundsheet.rotation.x = -Math.PI / 2;
  groundsheet.position.set(shelterX, LEVELS.yard - 0.004, shelterZ);
  groundsheet.userData.noOutline = true;
  group.add(groundsheet);

  for (const dz of [-0.45, 0.45]) {
    const bike = new THREE.Group();
    bike.position.set(shelterX, LEVELS.yard, shelterZ + dz);
    bike.rotation.y = 0.02;
    for (const dx of [-0.5, 0.5]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.022, 6, 18), darkMetal);
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(dx, 0.3, 0);
      bike.add(wheel);
    }
    const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.95, 6), toon({ color: dz < 0 ? 0x3f5f8f : 0x8f3f4f }));
    frame.rotation.z = Math.PI / 2;
    frame.position.set(0, 0.56, 0);
    bike.add(frame);
    const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 6), darkMetal);
    bars.position.set(-0.42, 0.82, 0);
    bike.add(bars);
    const saddle = new THREE.Mesh(roundedBox(0.22, 0.05, 0.1, 0.02), darkMetal);
    saddle.position.set(0.34, 0.84, 0);
    bike.add(saddle);
    group.add(bike);
  }

  return { group, hazards, tailLights, headlights };
}
