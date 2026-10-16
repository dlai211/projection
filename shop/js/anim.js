/**
 * anim.js — everything that moves once the scene is built.
 *
 * Nothing here builds geometry; it only drives objects other modules handed
 * back. Keeping that split is what stops merged geometry from silently becoming
 * un-animatable later: anything that moves was built as its own mesh from the
 * start, and this file is the full list of what those are.
 *
 * The door cycle is the one to get right. Doors opening for nobody is uncanny if
 * it happens often, so they are rare and slow — and the part that actually sells
 * it is that the doorway spills a soft rectangle of warm light onto the wet road
 * while they are open, and stops when they close.
 */

import { MOTION, LIGHTS } from './config.js';

/** Deterministic-ish pacing, seeded once so a reload is not identical. */
function between(range) {
  return range.min + Math.random() * (range.max - range.min);
}

export function buildAnim({ door, lights, props }) {
  const leaves = door.leaves;

  let doorState = 'closed';
  let doorTimer = between(MOTION.door.closedFor);
  let doorOpen = 0; // 0 closed, 1 fully open
  let skew = 0;

  /* ------------------------------------------------------- sign flicker -- */

  const flickers = [];
  function scheduleFlicker(target, settings, base) {
    flickers.push({
      target,
      base,
      settings,
      until: 0,
      next: between({ min: 3, max: 14 }),
    });
  }

  function tickFlicker(entry, elapsed, dt) {
    if (elapsed > entry.next && entry.until === 0 && Math.random() < entry.settings.chance) {
      entry.until = elapsed + between(entry.settings);
      entry.next = entry.until + between({ min: 4, max: 18 });
    }
    if (entry.until > 0) {
      // A failing tube stutters rather than fading.
      const on = Math.random() > 0.42;
      entry.target.emissiveIntensity = on ? entry.base * 0.25 : entry.base;
      if (elapsed > entry.until) {
        entry.until = 0;
        entry.target.emissiveIntensity = entry.base;
      }
    } else {
      entry.target.emissiveIntensity = entry.base;
    }
  }

  // The distant signal cycles on a slow loop. It is the only thing in frame on
  // a fixed rhythm, which is what makes the rest of the scene feel unhurried
  // rather than frozen.
  let signalPhase = 'green';
  let signalTimer = MOTION.signal.green;

  function tickSignal(dt) {
    const signal = props?.signal;
    if (!signal?.main) return;
    signalTimer -= dt;
    if (signalTimer <= 0) {
      if (signalPhase === 'green') { signalPhase = 'amber'; signalTimer = MOTION.signal.amber; }
      else if (signalPhase === 'amber') { signalPhase = 'red'; signalTimer = MOTION.signal.red; }
      else { signalPhase = 'green'; signalTimer = MOTION.signal.green; }
    }
    // Both heads show the same aspect: they govern the same junction.
    for (const rig of [signal.main, signal.side]) {
      for (const [key, lamp] of Object.entries(rig.lamps)) {
        lamp.material.emissiveIntensity = key === signalPhase ? 1.4 : 0.07;
      }
      // The pedestrian aspect is the opposite of the traffic one.
      rig.pedLamps.walk.material.emissiveIntensity = signalPhase === 'red' ? 1.3 : 0.08;
      rig.pedLamps.stop.material.emissiveIntensity = signalPhase === 'red' ? 0.08 : 1.3;
    }
  }

  /* ------------------------------------------------------------------- */

  return {
    /** Called once so callers do not have to know the flicker internals. */
    register(signMaterials, interiorPanel) {
      if (signMaterials.fasciaSouth) {
        scheduleFlicker(signMaterials.fasciaSouth.material, MOTION.signFlicker, 0.5);
      }
      if (signMaterials.pylonMaterial) {
        scheduleFlicker(signMaterials.pylonMaterial, MOTION.signFlicker, 1.15);
      }
      if (interiorPanel) {
        scheduleFlicker(interiorPanel.material, MOTION.interiorFlicker, interiorPanel.base ?? 2.0);
      }
    },

    update(elapsed, dt, camera) {
      /* ------------------------------------------------------------ door */

      if (doorState === 'closed') {
        doorTimer -= dt;
        if (doorTimer <= 0) {
          doorState = 'opening';
          skew = MOTION.door.skew;
        }
      } else if (doorState === 'open') {
        doorTimer -= dt;
        if (doorTimer <= 0) doorState = 'closing';
      }

      const speed = MOTION.door.speed;
      if (doorState === 'opening') {
        doorOpen = Math.min(1, doorOpen + dt * speed);
        if (doorOpen >= 1) { doorState = 'open'; doorTimer = MOTION.door.openFor; }
      } else if (doorState === 'closing') {
        doorOpen = Math.max(0, doorOpen - dt * speed);
        if (doorOpen <= 0) { doorState = 'closed'; doorTimer = between(MOTION.door.closedFor); }
      }

      // A tenth of a second of offset between the leaves: real sliding doors
      // never move in perfect unison, and in unison they read as one animation.
      for (let i = 0; i < leaves.length; i++) {
        const leaf = leaves[i];
        const lag = i === 0 ? 0 : skew;
        const t = Math.max(0, Math.min(1, (doorOpen - lag) / (1 - lag || 1)));
        // Ease, so the doors do not start and stop like a lift.
        const eased = t * t * (3 - 2 * t);
        leaf.position.x = leaf.userData.closedX + (leaf.userData.openX - leaf.userData.closedX) * eased;
        if (leaf.userData.stile) leaf.userData.stile.position.x = leaf.position.x + (leaf.userData.closedX < 0 ? 0.24 : -0.24) * (1 - eased);
      }

      // The spill. This is the whole point of the door opening at all.
      if (lights?.doorway) {
        const target = doorOpen * LIGHTS.interiorSpill.intensity * 0.55;
        lights.doorway.intensity += (target - lights.doorway.intensity) * Math.min(1, dt * 3.5);
      }

      /* --------------------------------------------------------- flicker */

      for (const entry of flickers) tickFlicker(entry, elapsed, dt);
      tickSignal(dt);
    },

    get doorOpen() {
      return doorOpen;
    },
  };
}
