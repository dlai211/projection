"""Full repair. Deleted after it runs."""
import io, sys
ROOT = r"c:\Users\laiji\VSCode\projection\shop\\"

def sub(path, a, b):
    s = io.open(ROOT + path, encoding="utf-8").read()
    if a not in s:
        print("NOT FOUND", path, "->", a[:95].replace("\n", " | ")); sys.exit(1)
    io.open(ROOT + path, "w", encoding="utf-8").write(s.replace(a, b, 1))
    print("  %-14s ok" % path)

# =========================================================== signage: arrow ==
sub("js/signage.js", "/** The white P painted inside a parking bay. */",
'''/**
 * A Japanese road arrow: long, thin, and straight. Drawn flat on a canvas and
 * used as a texture on a zero-thickness plane — the earlier version built these
 * out of a box and a cone, which gave them a visible thickness and a contour
 * and made them read as objects lying on the road.
 */
export function roadArrow() {
  return cached('roadArrow', () => {
    const element = sheet(256, 512, (context) => {
      context.clearRect(0, 0, 256, 512);
      context.fillStyle = '#ffffff';
      // A 4.5 m arrow at 256x512: shaft plus a wide, blunt head.
      context.fillRect(104, 190, 48, 300);
      context.beginPath();
      context.moveTo(128, 26);
      context.lineTo(212, 200);
      context.lineTo(44, 200);
      context.closePath();
      context.fill();
    });
    return toTexture(element);
  });
}

/** The white P painted inside a parking bay. */''')

# ============================================================ ground: bays ==
sub("js/config.js",
    "  parking: { z0: 5.15, d: 2.3, w: 2.6, gap: 0.3, first: 0.6, bays: 3 },",
    """  /**
   * Parallel bays on the shop's side of the one-way street: the long side runs
   * WITH the road, because the running lane is only about 3.5 m and a car
   * cannot nose into a bay across it.
   */
  parking: { z0: 5.2, d: 2.1, w: 5.2, gap: 0.4, first: 0.7, bays: 2 },""")

# ======================================================= props: guardrail ====
sub("js/props.js", """  // Either side of the crossing, never across it — the rail used to run
  // straight through the zebra and barricade the way over.
  railRun(-12.2, STREET.crosswalk.x0 - 0.9);
  railRun(STREET.crosswalk.x1 + 0.9, 2.6);""",
"""  // ONE short run, on the pavement, east of the shop's crossing.
  //
  // There used to be a second run starting at x = -12.2. The side street
  // occupies x = -13..-7, so that run began in the middle of the carriageway
  // and carried on across the side street's own crossing — a fence down the
  // centre of a road, which is exactly as wrong as it sounds. Street furniture
  // goes on the pavement, and both crossing mouths stay clear.
  railRun(STREET.crosswalk.x1 + 0.9, 4.4);""")

# ==================================================== props: traffic lights ==
old_signal_start = "  /* ------------------------------------------------------- traffic signal */"
s = io.open(ROOT + "js/props.js", encoding="utf-8").read()
a = s.index(old_signal_start)
b = s.index("  /* ------------------------------------------------------- alley interior */")
s = s[:a] + '''  /* ------------------------------------------------------- traffic signals */

  /**
   * At the junction, where they belong. They used to stand at the far east end
   * of the street, a long way from any traffic they could possibly control.
   *
   * Two heads on one mast, at right angles, because the two streets meet here:
   * one faces back down the side street, one faces back down the one-way. Each
   * hangs over the lane it governs.
   */
  const junction = { x: -6.6, z: 4.6 };
  const signal = new THREE.Group();
  signal.name = 'trafficSignals';
  signal.position.set(junction.x, 0, junction.z);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 4.4, 10), metal);
  mast.position.y = 2.2;
  addOutline(mast, { thickness: OUTLINE.hero, color: 0x1a1c29 });
  signal.add(mast);

  /** Builds one three-lamp head, hung under an arm and facing `yaw`. */
  const head = (armLength, yaw, height) => {
    const rig = new THREE.Group();
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
      lamp.position.set(armLength - 0.3 + i * 0.3, height - 0.12, 0.105);
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
      lamp.position.set(armLength * 0.25, height - 1.38 + i * 0.2, 0.085);
      lamp.userData.noOutline = true;
      rig.add(lamp);
      pedLamps[key] = lamp;
    }

    signal.add(rig);
    return { lamps, pedLamps };
  };

  // Facing back down the side street (traffic arrives heading +z), and facing
  // back down the one-way (traffic arrives heading +x).
  const headSideStreet = head(1.5, Math.PI, 4.1);
  const headMainStreet = head(1.7, -Math.PI / 2, 3.5);

  group.add(signal);

  /* ------------------------------------------------------------ road signs */

  /**
   * Three plates on posts, each where a driver would actually look for it:
   * the one-way plate at the mouth of the one-way street, the parking plate
   * beside the bays, and the 止まれ triangle at the stop line.
   */
  const signPost = (x, z, height, yaw, kind, size = 0.62, plateRotation = 0) => {
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

  // 一方通行 — at the mouth of the one-way street, facing oncoming traffic.
  signPost(-11.4, 4.2, 2.5, -Math.PI / 2, 'oneway');
  // P — beside the parallel bays on the shop's frontage.
  signPost(3.4, 4.2, 2.4, Math.PI, 'parking', 0.56);
  // 止まれ — at the stop line, where the side street meets the junction.
  signPost(-8.4, 1.4, 2.4, Math.PI, 'stop', 0.62, Math.PI);

''' + s[b:]
io.open(ROOT + "js/props.js", "w", encoding="utf-8").write(s)
print("  props.js       ok  signals + road signs")

sub("js/props.js", "import { poster } from './signage.js';",
    "import { poster, roadSign } from './signage.js';")
sub("js/props.js", "  return { group, lamps, signal: { lamps, cycle: MOTION.signal } };",
    """  return {
    group,
    signal: {
      main: headMainStreet,
      side: headSideStreet,
      cycle: MOTION.signal,
    },
  };""")
